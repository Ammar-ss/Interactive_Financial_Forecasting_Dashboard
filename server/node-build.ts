import path from "path";

// sanitize any environment placeholder values before importing server modules
for (const k of Object.keys(process.env)) {
  const v = process.env[k] ?? "";
  if (typeof v === "string") {
    if (v.includes("${")) {
      process.env[k] = v.replace(/\$\{[^}]*\}/g, "");
    }
    // If an env var contains an absolute URL, blank it out to avoid accidental use as an Express route
    if (/^https?:\/\//i.test(process.env[k] || "")) {
      process.env[k] = "";
    }
  }
}

(async () => {
  try {
    // Import express first and monkeypatch its registration methods to avoid throws from path-to-regexp
    const expressModule = await import("express");
    const express = expressModule.default ?? expressModule;

    // Patch get/post/use on application prototype to catch and log errors during route registration
    try {
      const appProto: any = express.application;
      ['get', 'post', 'use', 'all'].forEach((method) => {
        const orig = appProto[method];
        if (typeof orig === 'function') {
          appProto[method] = function patchedRegister(path: any, ...handlers: any[]) {
            try {
              return orig.call(this, path, ...handlers);
            } catch (err: any) {
              try {
                console.error(`Route registration error for [${method}]`, String(path));
                console.error(err && err.stack ? err.stack : err);
              } catch (e) {}
              // swallow registration error to keep server starting; do not register this route
              return this;
            }
          };
        }
      });
    } catch (e) {
      // ignore
    }

    const { createServer } = await import("./index");

    const app = createServer();
    const port = process.env.PORT || 3000;

    // In production, serve the built SPA files
    const __dirname = import.meta.dirname;
    const distPath = path.join(__dirname, "../spa");

    // Serve static files
    app.use(express.static(distPath));

    // Handle React Router - serve index.html for all non-API routes
    app.get("*", (req: any, res: any) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }

      res.sendFile(path.join(distPath, "index.html"));
    });

    app.listen(port, () => {
      console.log(`🚀 Fusion Starter server running on port ${port}`);
      console.log(`📱 Frontend: http://localhost:${port}`);
      console.log(`🔧 API: http://localhost:${port}/api`);
    });
  } catch (err: any) {
    try {
      console.error('Server startup failed:', err && err.stack ? err.stack : err);
      // Dump some environment variables that might contain route templates
      const interesting = ['DEBUG_URL','PING_MESSAGE','NODE_ENV','PORT'];
      const envDump: Record<string,string> = {};
      interesting.forEach((k) => { envDump[k] = process.env[k] ?? ''; });
      console.error('Env snapshot for debugging:', JSON.stringify(envDump, null, 2));
    } catch (e) {}
    // rethrow to make process exit with non-zero code
    throw err;
  }
})();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
