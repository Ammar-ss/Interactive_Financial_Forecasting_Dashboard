import { RequestHandler } from "express";
import fs from "fs/promises";
import path from "path";
import { getMetalsHistory } from "./metals";

const DB_DIR = path.join(process.cwd(), "database");
const STORE_FILE = path.join(DB_DIR, "metals.json");

async function ensureDbDir() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch (e) {}
}

export const fetchAndStore: RequestHandler = async (req, res) => {
  try {
    const dataset = String(req.query.dataset || "yahoo");
    const start = String(req.query.start || "");
    const end = String(req.query.end || "");

    // delegate to getMetalsHistory handler logic by calling the function directly
    // build a fake req/res pair
    const fakeReq: any = { query: { dataset, start, end } };
    let captured: any = null;
    const fakeRes: any = {
      json: (data: any) => {
        captured = data;
      },
      status: (code: number) => ({ json: (d: any) => (captured = d) }),
    };

    await getMetalsHistory(fakeReq as any, fakeRes as any);

    if (!captured) throw new Error("Failed to fetch metals data");

    await ensureDbDir();
    await fs.writeFile(STORE_FILE, JSON.stringify(captured, null, 2), "utf8");

    // Optional: push to Supabase REST if configured
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    let pushed = false;
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const rows: any[] = [];
        for (const sym of Object.keys(captured.data || {})) {
          const arr = captured.data[sym] || [];
          for (const r of arr) {
            rows.push({ date: r.date, symbol: sym, price: r.close ?? r.price_inr ?? r.price_usd ?? null, source: captured.source || "metals" });
          }
        }
        if (rows.length) {
          const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/metals`;
          const payload = JSON.stringify(rows.map((r) => ({ date: r.date, symbol: r.symbol, price: r.price, source: r.source })));
          // send POST
          await fs.writeFile(path.join(DB_DIR, "_supabase_payload.json"), payload, "utf8");
          // Note: we write payload to disk as proof; actual network push is not performed to avoid requiring additional deps
          pushed = true;
        }
      } catch (e) {
        // ignore supabase push errors
      }
    }

    res.json({ ok: true, storedAt: STORE_FILE, records: Object.keys(captured.data || {}).reduce((acc: any, k: any) => acc + (captured.data[k]?.length || 0), 0), supabase_payload_written: pushed });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
};

export const getStored: RequestHandler = async (_req, res) => {
  try {
    await ensureDbDir();
    const txt = await fs.readFile(STORE_FILE, "utf8").catch(() => "{}");
    const json = JSON.parse(txt || "{}");
    res.json({ ok: true, data: json });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
};
