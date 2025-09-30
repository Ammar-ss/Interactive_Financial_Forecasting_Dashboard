import { RequestHandler } from "express";

export const echo: RequestHandler = async (req, res) => {
  try {
    // Return headers and the parsed body (if any)
    const headers = req.headers || {};
    const body = req.body;
    res.json({ ok: true, headers, body });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "echo failed" });
  }
};
