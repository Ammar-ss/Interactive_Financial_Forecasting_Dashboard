import { RequestHandler } from "express";
// Using direct Yahoo Finance HTTP API to avoid SDK incompatibilities

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

async function fetchHistorical(symbol: string, range: string, interval: string): Promise<HistoricalPoint[]> {
  const params = new URLSearchParams({ range, interval, includeAdjustedClose: "true" });
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
  const resp = await fetch(url, { headers: { "User-Agent": "fusion-starter" } });
  if (!resp.ok) throw new Error(`Yahoo Finance error: ${resp.status}`);
  const json = await resp.json();
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

    const data = await fetchHistorical(symbol, range, interval);

    res.json({ symbol, range, interval, data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch data" });
  }
};

export const trainAndPredict: RequestHandler = async (req, res) => {
  try {
    const { symbol = "AAPL", range = "1y", interval = "1d", models = ["ma", "lr", "ema"], window = 5 } = req.body ?? {};

    const data = await fetchHistorical(String(symbol).toUpperCase(), String(range), String(interval));
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
