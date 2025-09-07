/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// Stock predictor shared types
export interface HistoricalPoint {
  date: string; // ISO date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalResponse {
  symbol: string;
  range: string;
  interval: string;
  data: HistoricalPoint[];
}

export type ModelKey = "ma" | "ema" | "lr";

export interface TrainRequestBody {
  symbol: string;
  range: string; // e.g. 1y, 6mo, 5d
  interval: string; // e.g. 1d, 1wk, 1mo
  models: ModelKey[];
  window?: number; // lookback
}

export interface Metrics {
  rmse: number;
  mae: number;
  mape: number; // percent
}

export interface PredictionPoint {
  date: string;
  actual: number | null;
  predicted: number | null;
}

export interface TrainResponseBody {
  symbol: string;
  range: string;
  interval: string;
  data: HistoricalPoint[];
  splitIndex: number;
  metrics: Record<ModelKey, Metrics> | Record<string, Metrics>;
  predictions: Record<ModelKey, PredictionPoint[]> | Record<string, PredictionPoint[]>;
  nextDayPrediction: Partial<Record<ModelKey, number>> & Record<string, number>;
}
