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
export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < 2) return out;
  for (let i = 0; i < values.length; i++) {
    if (i < period) continue;
    let gain = 0;
    let loss = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - values[j - 1];
      if (diff > 0) gain += diff;
      else loss += -diff;
    }
    const avgGain = gain / period;
    const avgLoss = loss / period;
    const rs = avgLoss === 0 ? (avgGain === 0 ? 0 : Infinity) : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

// Train a simple feed-forward network on windowed features. This is a lightweight
// approximation to an LSTM for demonstration and hyperparameter tuning in JS.
export function lstmWithFeatures(
  featureMatrix: number[][],
  targets: number[],
  lookback: number,
  layers = 1,
  units = 16,
  epochs = 50,
  lr = 0.01,
): number[] {
  // featureMatrix: array of rows (timepoints) each with featureCount features
  const n = featureMatrix.length;
  const featureCount = featureMatrix[0]?.length || 0;
  const windowSize = Math.max(1, lookback);
  const rows: number[][] = [];
  const ys: number[] = [];
  for (let i = windowSize; i < n; i++) {
    const row: number[] = [];
    for (let j = i - windowSize; j < i; j++) {
      row.push(...featureMatrix[j]);
    }
    rows.push(row);
    ys.push(targets[i]);
  }
  if (!rows.length) return new Array(n).fill(NaN);
  const inputDim = rows[0].length;

  // initialize weights for single hidden layer or stacked identical layers
  // architecture: input -> hidden (units) x layers -> output
  const rand = (a = 1) => (Math.random() * 2 - 1) * a;
  const W1 = Array.from({ length: units }, () => Array.from({ length: inputDim }, () => rand(0.01)));
  const b1 = new Array(units).fill(0);
  const Ws: number[][][] = [W1];
  const bs: number[][] = [b1];
  for (let l = 1; l < layers; l++) {
    Ws.push(Array.from({ length: units }, () => Array.from({ length: units }, () => rand(0.01))));
    bs.push(new Array(units).fill(0));
  }
  const Wo = Array.from({ length: units }, () => rand(0.01));
  let bo = 0;

  function forward(x: number[]) {
    // x: inputDim
    let h = new Array(units).fill(0);
    // first layer
    for (let i = 0; i < units; i++) {
      let s = 0;
      const Wi = Ws[0][i];
      for (let j = 0; j < inputDim; j++) s += Wi[j] * x[j];
      s += bs[0][i];
      h[i] = Math.tanh(s);
    }
    // further layers
    for (let l = 1; l < layers; l++) {
      const nh = new Array(units).fill(0);
      for (let i = 0; i < units; i++) {
        let s = 0;
        const Wi = Ws[l][i];
        for (let j = 0; j < units; j++) s += Wi[j] * h[j];
        s += bs[l][i];
        nh[i] = Math.tanh(s);
      }
      h = nh;
    }
    let out = 0;
    for (let i = 0; i < units; i++) out += Wo[i] * h[i];
    out += bo;
    return { out, h };
  }

  function trainEpoch() {
    // simple SGD over rows
    for (let idx = 0; idx < rows.length; idx++) {
      const x = rows[idx];
      const y = ys[idx];
      const res = forward(x);
      const pred = res.out;
      const err = pred - y;
      // gradients for output
      for (let i = 0; i < units; i++) {
        const grad = err * res.h[i];
        Wo[i] -= lr * grad;
      }
      bo -= lr * err;
      // backprop into hidden layers (approx)
      let dh = new Array(units).fill(0);
      for (let i = 0; i < units; i++) dh[i] = err * Wo[i] * (1 - res.h[i] * res.h[i]);
      // update final hidden layer weights
      for (let l = layers - 1; l >= 0; l--) {
        const prev = l === 0 ? x : null; // for simplicity, only update first layer using input
        for (let i = 0; i < units; i++) {
          // if first layer, input dim = inputDim
          if (l === 0) {
            for (let j = 0; j < inputDim; j++) {
              Ws[0][i][j] -= lr * dh[i] * x[j];
            }
          } else {
            // if deeper, skip precise gradients for brevity
            for (let j = 0; j < units; j++) {
              Ws[l][i][j] -= lr * dh[i] * (res.h[j] || 0);
            }
          }
          bs[l][i] -= lr * dh[i];
        }
      }
    }
  }

  for (let e = 0; e < epochs; e++) trainEpoch();

  const preds = new Array(n).fill(NaN);
  // fill predicted positions aligned with original series
  for (let i = windowSize; i < n; i++) {
    const x = rows[i - windowSize];
    const res = forward(x);
    preds[i] = res.out;
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
