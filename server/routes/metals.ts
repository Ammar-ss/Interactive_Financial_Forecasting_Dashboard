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

// Only support two data sources: 'yahoo' (preferred for INR tickers) and 'worldbank' (macro examples)
export const getMetalsHistory: RequestHandler = async (req, res) => {
  try {
    const dataset = String(req.query.dataset || "yahoo").toLowerCase();
    if (!["yahoo", "worldbank"].includes(dataset)) {
      return res.status(400).json({ error: "Only 'yahoo' and 'worldbank' datasets are supported" });
    }

    // For metals we only allow XAU and XAG timeline
    const symbols = ["XAU", "XAG"];

    const start = String(req.query.start || "");
    const end = String(req.query.end || "");

    const key = cacheKey(["metals", dataset, symbols.join(","), start, end]);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL) {
      return res.json({ cached: true, source: cached.data.source, data: cached.data.data });
    }

    if (dataset === "worldbank") {
      // Return a simple synthetic series mapped from World Bank GDP as an example dataset
      const startYear = new Date().getFullYear() - 10;
      const url = `https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.CD?date=${startYear}:${new Date().getFullYear()}&format=json&per_page=1000`;
      const json = await httpsGetJson(url);
      if (!Array.isArray(json) || !Array.isArray(json[1]))
        throw new Error("World Bank API returned unexpected response");
      const points = json[1]
        .filter((row: any) => row.value != null)
        .map((row: any) => ({ date: `${row.date}-01-01T00:00:00.000Z`, value: row.value }))
        .reverse();
      const payload = { source: "worldbank", data: { WLD: points } };
      cache.set(key, { ts: Date.now(), data: payload });
      return res.json(payload);
    }

    // dataset === 'yahoo' (default)
    const today = new Date();
    const defaultStart = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const s = start || defaultStart.toISOString().slice(0, 10);
    const e = end || today.toISOString().slice(0, 10);

    const period1 = Math.floor(new Date(s + "T00:00:00Z").getTime() / 1000);
    const period2 = Math.floor(new Date(e + "T23:59:59Z").getTime() / 1000);

    const out: Record<string, { date: string; close: number }[]> = {};

    const yahooMap: Record<string, string> = {
      XAU: "XAUINR=X",
      XAG: "XAGINR=X",
    };

    for (const sym of symbols) {
      const ticker = yahooMap[sym];
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
