import { RequestHandler } from "express";
import https from "https";

// Using direct Yahoo Finance HTTP API via native https to avoid fetch/undici issues in Node
export interface HistoricalPoint {
  date: string; // ISO date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toISO(d: Date | string | number): string {
  return new Date(d).toISOString();
}

function httpsGetJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "fusion-starter" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}



const uploadedDatasets: Map<string, HistoricalPoint[]> = new Map();

async function fetchHistorical(symbol: string, range: string, interval: string, dataset: string = "yahoo"): Promise<HistoricalPoint[]> {
  // Support a few datasets. For external APIs that require keys or file uploads (Kaggle, Alpha Vantage, FRED)
  // we return an informative error so the user can provide keys or upload CSVs. World Bank and Yahoo are public.
  if (dataset === "worldbank") {
    // Use World Bank GDP (current US$) for global (WLD). Map yearly values into time series points.
    const startYear = new Date().getFullYear() - 10;
    const url = `https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.CD?date=${startYear}:${new Date().getFullYear()}&format=json&per_page=1000`;
    const json = await httpsGetJson(url);
    if (!Array.isArray(json) || !Array.isArray(json[1])) throw new Error("World Bank API returned unexpected response");
    const points = json[1]
      .filter((row: any) => row.value != null)
      .map((row: any) => ({
        date: `${row.date}-01-01T00:00:00.000Z`,
        open: row.value,
        high: row.value,
        low: row.value,
        close: row.value,
        volume: 0,
      }))
      .reverse(); // chronological
    return points;
  }

  if (dataset === "yahoo") {
    const params = new URLSearchParams({ range, interval, includeAdjustedClose: "true" });
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
    const json = await httpsGetJson(url);
    const result = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const close: number[] = quote.close || [];
    const open: number[] = quote.open || [];
    const high: number[] = quote.high || [];
    const low: number[] = quote.low || [];
    const volume: number[] = quote.volume || [];

    const out: HistoricalPoint[] = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString(),
      open: Number.isFinite(open[i]) ? open[i] : Number.isFinite(close[i]) ? close[i] : 0,
      high: Number.isFinite(high[i]) ? high[i] : Number.isFinite(close[i]) ? close[i] : 0,
      low: Number.isFinite(low[i]) ? low[i] : Number.isFinite(close[i]) ? close[i] : 0,
      close: Number.isFinite(close[i]) ? close[i] : 0,
      volume: Number.isFinite(volume[i]) ? volume[i] : 0,
    }));
    return out.filter((r) => Number.isFinite(r.close) && r.close !== 0);
  }

  // For other datasets we require API keys or file upload. Provide an informative error.
  // But first check if a dataset was uploaded and is available in-memory
  if (uploadedDatasets.has(dataset)) {
    const data = uploadedDatasets.get(dataset)!;
    // If the uploaded CSV included a symbol/ticker column, allow filtering by the requested symbol
    if (symbol && data.length && (data[0] as any).symbol !== undefined) {
      const filtered = data.filter((r) => ((r as any).symbol || "").toUpperCase() === String(symbol).toUpperCase());
      if (filtered.length) return filtered;
      throw new Error(`No rows found for symbol ${symbol} in uploaded dataset ${dataset}`);
    }
    return data;
  }
  throw new Error(`${dataset} dataset not configured on server. For remote datasets (Kaggle, FRED, Alpha Vantage) please provide API credentials or upload CSVs.`);
}



function parseCsv(text: string): HistoricalPoint[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headerParts = lines[0].split(/,|;|\t/).map((h) => h.trim());
  const header = headerParts.map((h) => h.toLowerCase());
  const rows = lines.slice(1);
  const dateIdx = header.findIndex((h) => /date|timestamp|day/.test(h));
  const closeIdx = header.findIndex((h) => /close|adjclose|adj_close/.test(h));
  const openIdx = header.findIndex((h) => /open/.test(h));
  const highIdx = header.findIndex((h) => /high/.test(h));
  const lowIdx = header.findIndex((h) => /low/.test(h));
  const volIdx = header.findIndex((h) => /vol|volume/.test(h));
  const symbolIdx = header.findIndex((h) => /symbol|ticker|code/.test(h));

  const out: HistoricalPoint[] = rows
    .map((r) => {
      const cols = r.split(/,|;|\t/).map((c) => c.trim());
      const dateRaw = dateIdx >= 0 ? cols[dateIdx] : null;
      const date = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();
      const parseNum = (i: number) => (i >= 0 && cols[i] ? Number(cols[i].replace(/[^0-9.-]/g, "")) : NaN);
      const close = parseNum(closeIdx);
      const open = Number.isFinite(parseNum(openIdx)) ? parseNum(openIdx) : close;
      const high = Number.isFinite(parseNum(highIdx)) ? parseNum(highIdx) : close;
      const low = Number.isFinite(parseNum(lowIdx)) ? parseNum(lowIdx) : close;
      const volume = Number.isFinite(parseNum(volIdx)) ? parseNum(volIdx) : 0;
      const point: any = { date, open: open || 0, high: high || 0, low: low || 0, close: close || 0, volume };
      if (symbolIdx >= 0 && cols[symbolIdx]) point.symbol = String(cols[symbolIdx]).toUpperCase();
      return point as HistoricalPoint;
    })
    .filter((p) => Number.isFinite((p as any).close) && (p as any).close !== 0);

  // sort ascending by date
  out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return out;
}

export const uploadDataset: RequestHandler = async (req, res) => {
  try {
    // Expect JSON body: { key: string, csv: string }
    const { key, csv } = req.body ?? {};
    if (!key || typeof key !== "string") return res.status(400).json({ error: "Missing dataset key" });
    if (!csv || typeof csv !== "string") return res.status(400).json({ error: "Missing csv content" });
    const data = parseCsv(csv);
    if (!data.length) return res.status(400).json({ error: "CSV parsed but no valid rows found" });
    uploadedDatasets.set(key, data);
    return res.json({ ok: true, key, rows: data.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Failed to upload" });
  }
};

export const listDatasets: RequestHandler = async (_req, res) => {
  const keys = Array.from(uploadedDatasets.keys());
  res.json({ keys });
};

// Simple ML models implemented in TS
function movingAverage(values: number[], window: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out.push(sum / window);
    else out.push(NaN);
  }
  return out;
}

function exponentialMA(values: number[], alpha: number): number[] {
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const s = alpha * values[i] + (1 - alpha) * prev;
    out.push(s);
    prev = s;
  }
  return out;
}

function linearRegressionPredict(values: number[], lookback: number): number[] {
  // Predict current index using last `lookback` points via simple linear regression on (t, price)
  const preds: number[] = new Array(values.length).fill(NaN);
  for (let i = lookback - 1; i < values.length; i++) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let j = i - lookback + 1; j <= i; j++) {
      xs.push(j);
      ys.push(values[j]);
    }
    const n = lookback;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, k) => acc + x * ys[k], 0);
    const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;
    const nextX = i + 1; // next step
    const predNext = slope * nextX + intercept;
    preds[i] = predNext; // prediction for next step at position i
  }
  return preds;
}

function rmse(yTrue: number[], yPred: number[]): number {
  const n = Math.min(yTrue.length, yPred.length);
  let s = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    const yt = yTrue[i];
    const yp = yPred[i];
    if (isFinite(yp) && !Number.isNaN(yp) && isFinite(yt)) {
      s += (yt - yp) * (yt - yp);
      c++;
    }
  }
  return c ? Math.sqrt(s / c) : NaN;
}

function mae(yTrue: number[], yPred: number[]): number {
  const n = Math.min(yTrue.length, yPred.length);
  let s = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    const yt = yTrue[i];
    const yp = yPred[i];
    if (isFinite(yp) && !Number.isNaN(yp) && isFinite(yt)) {
      s += Math.abs(yt - yp);
      c++;
    }
  }
  return c ? s / c : NaN;
}

function mape(yTrue: number[], yPred: number[]): number {
  const n = Math.min(yTrue.length, yPred.length);
  let s = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    const yt = yTrue[i];
    const yp = yPred[i];
    if (isFinite(yp) && !Number.isNaN(yp) && isFinite(yt) && yt !== 0) {
      s += Math.abs((yt - yp) / yt);
      c++;
    }
  }
  return c ? (s / c) * 100 : NaN;
}

export const getHistorical: RequestHandler = async (req, res) => {
  try {
      const symbol = (req.query.symbol as string)?.toUpperCase() ?? "AAPL";
    const range = (req.query.range as string) ?? "1y";
    const interval = (req.query.interval as string) ?? "1d";
    const dataset = (req.query.dataset as string) ?? "yahoo";

    const data = await fetchHistorical(symbol, range, interval, dataset);

    res.json({ symbol, range, interval, dataset, data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch data" });
  }
};

export const trainAndPredict: RequestHandler = async (req, res) => {
  try {
    const { symbol = "AAPL", range = "1y", interval = "1d", models = ["ma", "lr", "ema"], window = 5, dataset = "yahoo" } = req.body ?? {};

    const data = await fetchHistorical(String(symbol).toUpperCase(), String(range), String(interval), String(dataset));
    if (!data.length) return res.status(400).json({ error: "No data returned for symbol" });

    // Close prices ordered by time ascending
    const closes = data.map((d) => d.close);

    const splitIdx = Math.floor(closes.length * 0.8);
    const train = closes.slice(0, splitIdx);
    const test = closes.slice(splitIdx);

    const evalOn = (series: number[]): { preds: number[]; metrics: { rmse: number; mae: number; mape: number } } => {
      const preds = series;
      const metrics = {
        rmse: rmse(test, preds.slice(splitIdx)),
        mae: mae(test, preds.slice(splitIdx)),
        mape: mape(test, preds.slice(splitIdx)),
      };
      return { preds, metrics };
    };

    const results: Record<string, any> = {};

    if (models.includes("ma")) {
      const preds = movingAverage(closes, Math.max(2, Number(window)));
      results.ma = evalOn(preds);
    }
    if (models.includes("ema")) {
      const alpha = 2 / (Math.max(2, Number(window)) + 1);
      const preds = exponentialMA(closes, alpha);
      results.ema = evalOn(preds);
    }
    if (models.includes("lr")) {
      const preds = linearRegressionPredict(closes, Math.max(3, Number(window)));
      results.lr = evalOn(preds);
    }

    const nextPreds: Record<string, number> = {};
    if (results.ma) nextPreds.ma = results.ma.preds[closes.length - 1];
    if (results.ema) nextPreds.ema = results.ema.preds[closes.length - 1];
    if (results.lr) nextPreds.lr = results.lr.preds[closes.length - 1];

    // Build response predictions timeline aligned with data
    const predictions: Record<string, { date: string; actual: number | null; predicted: number | null }[]> = {};
    Object.keys(results).forEach((k) => {
      predictions[k] = data.map((row, i) => ({
        date: row.date,
        actual: row.close,
        predicted: isFinite(results[k].preds[i]) && !Number.isNaN(results[k].preds[i]) ? results[k].preds[i] : null,
      }));
    });

    res.json({
      symbol: String(symbol).toUpperCase(),
      range: String(range),
      interval: String(interval),
      data,
      splitIndex: splitIdx,
      metrics: Object.fromEntries(
        Object.entries(results).map(([k, v]) => [k, v.metrics])
      ),
      predictions,
      nextDayPrediction: nextPreds,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to train" });
  }
};
