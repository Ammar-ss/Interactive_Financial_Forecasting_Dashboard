import path from "path";

// sanitize any environment placeholder values before importing server modules
for (const k of Object.keys(process.env)) {
  const v = process.env[k] ?? "";
  if (typeof v === "string" && v.includes("${")) {
    process.env[k] = v.replace(/\$\{[^}]*\}/g, "");
  }
}

(async () => {
  try {
    const [{ createServer }, express] = await Promise.all([
      import("./index"),
      import("express"),
    ]);
    const app = createServer();
    const port = process.env.PORT || 3000;

    // In production, serve the built SPA files
    const __dirname = import.meta.dirname;
    const distPath = path.join(__dirname, "../spa");

    // Serve static files
    app.use(express.static(distPath));

    // Handle React Router - serve index.html for all non-API routes
    app.get("*", (req, res) => {
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
      console.error(
        "Server startup failed:",
        err && err.stack ? err.stack : err,
      );
      // Dump some environment variables that might contain route templates
      const interesting = ["DEBUG_URL", "PING_MESSAGE", "NODE_ENV", "PORT"];
      const envDump: Record<string, string> = {};
      interesting.forEach((k) => {
        envDump[k] = process.env[k] ?? "";
      });
      console.error(
        "Env snapshot for debugging:",
        JSON.stringify(envDump, null, 2),
      );
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
