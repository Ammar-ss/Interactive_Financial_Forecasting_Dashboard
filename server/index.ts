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

  const safeGet = (p: any, ...rest: any[]) =>
    app.get(normalizePath(p), ...rest);
  const safePost = (p: any, ...rest: any[]) =>
    app.post(normalizePath(p), ...rest);
  const safeUse = (p: any, ...rest: any[]) =>
    app.use(normalizePath(p), ...rest);

  // Example API routes
  safeGet("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  safeGet("/api/demo", handleDemo);

  // Stock ML routes
  safeGet("/api/stocks/historical", getHistorical);
  safePost("/api/stocks/train", trainAndPredict);

  // Dataset upload / management
  safePost("/api/datasets/upload", uploadDataset);
  safeGet("/api/datasets", listDatasets);

  return app;
}
