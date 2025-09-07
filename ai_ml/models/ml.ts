// ML utility functions for stock predictor

export function movingAverage(values: number[], window: number): number[] {
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

export function exponentialMA(values: number[], alpha: number): number[] {
  const out: number[] = [];
  if (!values.length) return out;
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const s = alpha * values[i] + (1 - alpha) * prev;
    out.push(s);
    prev = s;
  }
  return out;
}

export function linearRegressionPredict(values: number[], lookback: number): number[] {
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
    const nextX = i + 1;
    const predNext = slope * nextX + intercept;
    preds[i] = predNext;
  }
  return preds;
}

export function rmse(yTrue: number[], yPred: number[]): number {
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

export function mae(yTrue: number[], yPred: number[]): number {
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

export function mape(yTrue: number[], yPred: number[]): number {
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
