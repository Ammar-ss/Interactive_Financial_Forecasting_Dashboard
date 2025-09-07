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

// SARIMA-ish implementation (lightweight seasonal model)
// This implementation performs seasonal decomposition using a fixed seasonal period
// and applies a simple moving average to deseasonalized residuals for predictions.
export function sarima(values: number[], window: number, seasonalPeriod: number = 5): number[] {
  const n = values.length;
  if (!n) return [];
  // compute seasonal means
  const seasonalSums: number[] = new Array(seasonalPeriod).fill(0);
  const seasonalCounts: number[] = new Array(seasonalPeriod).fill(0);
  for (let i = 0; i < n; i++) {
    const idx = i % seasonalPeriod;
    seasonalSums[idx] += values[i];
    seasonalCounts[idx] += 1;
  }
  const seasonalMeans = seasonalSums.map((s, i) => (seasonalCounts[i] ? s / seasonalCounts[i] : 0));

  // deseasonalize
  const deseasonalized = values.map((v, i) => v - seasonalMeans[i % seasonalPeriod]);

  // smooth deseasonalized with moving average
  const smooth = movingAverage(deseasonalized, Math.max(2, window));

  // re-seasonalize
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = smooth[i];
    out.push(isFinite(s) ? s + seasonalMeans[i % seasonalPeriod] : NaN);
  }
  return out;
}

// Lightweight LSTM-like predictor (approximation)
// Trains a simple regression on lagged windows and applies a tanh activation to introduce non-linearity.
// Not a true LSTM but provides a learned non-linear autoregressive predictor usable in-browser/server.
export function lstmLike(values: number[], lookback: number): number[] {
  const n = values.length;
  if (n === 0) return [];
  const preds: number[] = new Array(n).fill(NaN);
  const m = Math.max(1, lookback);
  const X: number[][] = [];
  const Y: number[] = [];
  for (let i = m; i < n; i++) {
    const row: number[] = [];
    for (let j = i - m; j < i; j++) row.push(values[j]);
    X.push(row);
    Y.push(values[i]);
  }
  if (!X.length) return preds;
  const cols = X[0].length;
  // fit linear weights via normal equations (X^T X w = X^T Y)
  const XtX: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));
  const Xty: number[] = new Array(cols).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < cols; a++) {
      for (let b = 0; b < cols; b++) {
        XtX[a][b] += X[i][a] * X[i][b];
      }
      Xty[a] += X[i][a] * Y[i];
    }
  }
  // regularization
  const lambda = 1e-3;
  for (let i = 0; i < cols; i++) XtX[i][i] += lambda;
  // solve XtX * w = Xty with Gaussian elimination
  const mat = XtX.map((row) => row.slice());
  const rhs = Xty.slice();
  const w = new Array(cols).fill(0);
  // Gaussian elimination
  for (let i = 0; i < cols; i++) {
    // pivot
    let maxRow = i;
    for (let r = i + 1; r < cols; r++) if (Math.abs(mat[r][i]) > Math.abs(mat[maxRow][i])) maxRow = r;
    if (maxRow !== i) {
      const tmp = mat[i];
      mat[i] = mat[maxRow];
      mat[maxRow] = tmp;
      const tt = rhs[i];
      rhs[i] = rhs[maxRow];
      rhs[maxRow] = tt;
    }
    const pivot = mat[i][i];
    if (!pivot) continue;
    for (let c = i; c < cols; c++) mat[i][c] /= pivot;
    rhs[i] /= pivot;
    for (let r = 0; r < cols; r++) {
      if (r === i) continue;
      const factor = mat[r][i];
      for (let c = i; c < cols; c++) mat[r][c] -= factor * mat[i][c];
      rhs[r] -= factor * rhs[i];
    }
  }
  for (let i = 0; i < cols; i++) w[i] = rhs[i] || 0;

  // generate predictions: apply model to windows, then pass through tanh scaling
  for (let i = m; i < n; i++) {
    const window = values.slice(i - m, i);
    let pred = 0;
    for (let j = 0; j < cols; j++) pred += (window[j] || 0) * w[j];
    // non-linear squashing to avoid wild predictions
    const baseline = window.reduce((a, b) => a + b, 0) / window.length || 0;
    const adjusted = baseline + Math.tanh(pred - baseline) * Math.abs(pred - baseline);
    preds[i] = adjusted;
  }

  // first positions: fill with NaN
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
