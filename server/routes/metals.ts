import { RequestHandler } from "express";
import https from "https";

// Simple in-memory cache with TTL
const cache = new Map<string, { ts: number; data: any }>();
const TTL = 1000 * 60 * 5; // 5 minutes

function httpsGetJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "fusion-starter" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400)
              return reject(new Error(`HTTP ${res.statusCode}`));
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function cacheKey(keyParts: string[]) {
  return keyParts.join("|");
}

export const getMetalsHistory: RequestHandler = async (req, res) => {
  try {
    const raw = String(req.query.symbols ?? "XAU,XAG");
    const symbols = raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const start = String(req.query.start || "");
    const end = String(req.query.end || "");

    const apiKey = process.env.METALS_API_KEY;

    const key = cacheKey(["metals", symbols.join(","), start, end, apiKey ? "metalsapi" : "yahoo"]);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL) {
      return res.json({ cached: true, source: cached.data.source, data: cached.data.data });
    }

    // If METALS_API_KEY is present, use Metals-API (rates in USD), then convert to INR using exchangerate.host timeseries
    if (apiKey) {
      // Build timeseries query
      const today = new Date();
      const defaultStart = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
      const s = start || defaultStart.toISOString().slice(0, 10);
      const e = end || today.toISOString().slice(0, 10);

      const symbolsParam = symbols.join(",");
      const metalsUrl = `https://metals-api.com/api/timeseries?access_key=${encodeURIComponent(
        apiKey,
      )}&start_date=${s}&end_date=${e}&base=USD&symbols=${encodeURIComponent(symbolsParam)}`;

      const metalsJson = await httpsGetJson(metalsUrl);
      if (!metalsJson || !metalsJson.rates) {
        throw new Error("Unexpected response from Metals API");
      }

      // Fetch USD->INR timeseries to convert
      const fxUrl = `https://api.exchangerate.host/timeseries?start_date=${s}&end_date=${e}&base=USD&symbols=INR`;
      const fxJson = await httpsGetJson(fxUrl);
      if (!fxJson || !fxJson.rates) {
        throw new Error("Unexpected response from FX API");
      }

      // Build timeline
      const dates = Object.keys(metalsJson.rates).sort();
      const out: Record<string, { date: string; symbol: string; price_usd: number | null; price_inr: number | null }[]> = {};
      for (const sym of symbols) out[sym] = [];

      for (const d of dates) {
        const dayRates = metalsJson.rates[d] || {};
        const fxRate = (fxJson.rates[d] && fxJson.rates[d].INR) || null;
        for (const sym of symbols) {
          const val = typeof dayRates[sym] === "number" ? dayRates[sym] : null;
          const price_inr = val !== null && fxRate ? Number((val * fxRate).toFixed(4)) : null;
          out[sym].push({ date: d, symbol: sym, price_usd: val, price_inr });
        }
      }

      const payload = { source: "metals-api+exchangerate.host", data: out };
      cache.set(key, { ts: Date.now(), data: payload });
      return res.json(payload);
    }

    // Fallback: use Yahoo Finance public chart API for INR tickers (e.g. XAUINR=X)
    // Map requested symbols to Yahoo tickers
    const yahooMap: Record<string, string> = {
      XAU: "XAUINR=X",
      XAG: "XAGINR=X",
      GOLD: "XAUINR=X",
      SILVER: "XAGINR=X",
    };

    const today2 = new Date();
    const defaultStart2 = new Date(today2.getTime() - 365 * 24 * 60 * 60 * 1000);
    const s2 = start || defaultStart2.toISOString().slice(0, 10);
    const e2 = end || today2.toISOString().slice(0, 10);

    // Yahoo chart API uses epoch seconds for period1/period2
    const period1 = Math.floor(new Date(s2 + "T00:00:00Z").getTime() / 1000);
    const period2 = Math.floor(new Date(e2 + "T23:59:59Z").getTime() / 1000);

    const out: Record<string, { date: string; close: number }[]> = {};

    for (const sym of symbols) {
      const ticker = yahooMap[sym] || `${sym}INR=X`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;
      try {
        const json = await httpsGetJson(url);
        const result = json?.chart?.result?.[0];
        const timestamps: number[] = result?.timestamp || [];
        const quote = result?.indicators?.quote?.[0] || {};
        const close: number[] = quote.close || [];
        const rows = timestamps.map((ts: number, i: number) => ({ date: new Date(ts * 1000).toISOString(), close: Number.isFinite(close[i]) ? close[i] : null }));
        out[sym] = rows.filter((r) => r.close !== null);
      } catch (err) {
        out[sym] = [];
      }
    }

    const payload = { source: "yahoo", data: out };
    cache.set(key, { ts: Date.now(), data: payload });
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch metals data" });
  }
};
