import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  getHistorical,
  trainAndPredict,
  uploadDataset,
  listDatasets,
} from "./routes/stocks";
import { getMetalsHistory } from "./routes/metals";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper to sanitize any route path strings that may contain template placeholders
  function normalizePath(p: any) {
    if (typeof p !== "string") return p;
    // Remove any ${...} placeholders that may have leaked into route strings (safety)
    const cleaned = p.replace(/\$\{[^}]*\}/g, "").replace(/\/+/g, "/");
    return cleaned === "" ? "/" : cleaned;
  }

  function safeRegister(
    method: "get" | "post" | "use",
    p: any,
    ...rest: any[]
  ) {
    try {
      const orig = p;
      const normalized = normalizePath(p);
      // further guard: if normalized looks like a URL or contains an empty param token, replace with '/'
      if (typeof normalized === "string") {
        if (
          /^https?:\/\//i.test(normalized) ||
          /\:[\/\\]/.test(normalized) ||
          /\/:$/.test(normalized) ||
          normalized.includes("}:${")
        ) {
          console.warn(
            "sanitize route:",
            orig,
            "->",
            normalized,
            "-> / (replaced)",
          );
          // register at root to avoid path-to-regexp issues
          (app as any)[method]("/", ...rest);
          return;
        }
      }
      // Register normally
      (app as any)[method](normalized as any, ...rest);
    } catch (err: any) {
      // Log and continue
      try {
        console.error(
          "Failed to register route",
          p,
          err && err.stack ? err.stack : err,
        );
      } catch (e) {}
    }
  }

  // Example API routes
  safeRegister("get", "/api/ping", (_req: any, res: any) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  safeRegister("get", "/api/demo", handleDemo);

  // Stock ML routes
  safeRegister("get", "/api/stocks/historical", getHistorical);
  safeRegister("post", "/api/stocks/train", trainAndPredict);

  // Dataset upload / management
  safeRegister("post", "/api/datasets/upload", uploadDataset);
  safeRegister("get", "/api/datasets", listDatasets);

  // Metals (gold/silver) historical data
  safeRegister("get", "/api/metals/history", getMetalsHistory);

  return app;
}
