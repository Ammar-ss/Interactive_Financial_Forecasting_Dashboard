import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";

import { useDataset } from "@/context/DatasetContext";
import type { HistoricalResponse, TrainResponseBody } from "@shared/api";
import { apiFetch } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from "recharts";

const ranges = ["1mo", "3mo", "6mo", "1y", "2y", "5y"] as const;
const intervals = ["1d", "1wk", "1mo"] as const;

const modelColors: Record<string, string> = {
  actual: "#94a3b8", // slate-400
  ma: "#7c3aed", // violet-600
  ema: "#0ea5e9", // sky-500
  lr: "#ef4444", // red-500
  sarima: "#059669", // emerald-600
  lstm: "#f59e0b", // amber-500
};

export default function Index() {
  const { dataset, company, setCompany, setDataset } = useDataset();
  const [symbol, setSymbol] = useState(company ?? "AAPL");
  const [range, setRange] = useState<(typeof ranges)[number]>("1y");
  const [interval, setInterval] = useState<(typeof intervals)[number]>("1d");
  const [useMA, setUseMA] = useState(true);
  const [useEMA, setUseEMA] = useState(true);
  const [useLR, setUseLR] = useState(true);
  const [useSARIMA, setUseSARIMA] = useState(false);
  const [useLSTM, setUseLSTM] = useState(false);
  const [sarimaSeasonal, setSarimaSeasonal] = useState(5);
  const [lstmLookback, setLstmLookback] = useState(3);
  const [windowSize, setWindowSize] = useState(10);

  const [loading, setLoading] = useState(false);
  const [lastModels, setLastModels] = useState<string[]>([]);
  const [hist, setHist] = useState<HistoricalResponse | null>(null);
  const [train, setTrain] = useState<TrainResponseBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<any>(null);

  useEffect(() => {
    // reflect context company into local symbol
    setSymbol(company);
    // initial load
    runAll();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const runAll = async () => {
    setLoading(true);
    setError(null);
    setErrorDetail(null);
    try {
      const qs = new URLSearchParams({ symbol, range, interval, dataset });
      const modelsArray = [
        useMA && "ma",
        useEMA && "ema",
        useLR && "lr",
        useSARIMA && "sarima",
        useLSTM && "lstm",
      ].filter(Boolean) as string[];
      setLastModels(modelsArray);
      // Fetch historical first, then train — this gives clearer errors and avoids Promise.all hiding which request failed
      let h: any = null;
      let t: any = null;
      try {
        h = await apiFetch(`/api/stocks/historical?${qs.toString()}`);
        if (h?.error) throw new Error(h.error);
        setHist(h as HistoricalResponse);
      } catch (err: any) {
        throw new Error(`Historical fetch failed: ${err?.message || err}`);
      }

      try {
        t = await apiFetch(`/api/stocks/train`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol,
            range,
            interval,
            dataset,
            models: modelsArray,
            window: windowSize,
            sarimaSeasonal,
            lstmLookback,
          }),
        });
        if (t?.error) throw new Error(t.error);
        setTrain(t as TrainResponseBody);
      } catch (err: any) {
        throw new Error(`Training request failed: ${err?.message || err}`);
      }
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong";
      setError(msg);
      // Prefer structured details if provided by apiFetch
      const detail = e?.details ?? (e?.stack ? { name: e.name, message: e.message, stack: e.stack } : e);
      setErrorDetail(detail);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!train) return [] as any[];
    const keys = Object.keys(train.predictions || {});
    const rows = (train.data || []).map((d, idx) => {
      const row: any = {
        date: new Date(d.date).toISOString().slice(0, 10),
        actual: d.close,
      };
      keys.forEach((k) => {
        const p = train.predictions as any;
        row[k] = p[k][idx]?.predicted ?? null;
      });
      return row;
    });

    // append next-day prediction point if available
    try {
      const last = (train.data || [])[train.data.length - 1];
      if (last && train.nextDayPrediction) {
        const lastDate = new Date(last.date);
        let stepDays = 1;
        if (interval === "1wk") stepDays = 7;
        else if (interval === "1mo") stepDays = 30;
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + stepDays);
        const nextDateStr = nextDate.toISOString().slice(0, 10);
        const nextRow: any = { date: nextDateStr, actual: null };
        Object.keys(train.nextDayPrediction).forEach((k) => {
          const v = (train.nextDayPrediction as any)[k];
          nextRow[k] = typeof v === "number" ? v : null;
        });
        rows.push(nextRow);
      }
    } catch (e) {
      // ignore
    }

    return rows;
  }, [train, interval]);

  const nextPredSummary = useMemo(() => {
    if (!train) return [] as { name: string; value: number }[];
    return Object.entries(train.nextDayPrediction).map(([k, v]) => ({
      name: k.toUpperCase(),
      value: v,
    }));
  }, [train]);

  return (
    <div className="container py-10">
      <section className="grid md:grid-cols-[1fr_380px] gap-6">
        <Card className="md:col-span-2 bg-card/80">
          <CardHeader>
            <CardTitle className="text-2xl">
              Predict future prices with built-in ML models
            </CardTitle>
            <CardDescription>
              Fetch market data, train models, evaluate accuracy, and visualize
              forecasts — all done here and developed by Ammar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-32">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Select value={symbol} onValueChange={(v) => setSymbol(String(v))}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XAU">XAU (Gold)</SelectItem>
                        <SelectItem value="XAG">XAG (Silver)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-40">
                    <Label htmlFor="dataset">Dataset</Label>
                    <Select value={dataset as string} onValueChange={(v) => setDataset(v as any)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yahoo">Yahoo Finance (INR)</SelectItem>
                        <SelectItem value="worldbank">World Bank (sample)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Range</Label>
                    <Select
                      value={range}
                      onValueChange={(v) => setRange(v as any)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ranges.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Interval</Label>
                    <Select
                      value={interval}
                      onValueChange={(v) => setInterval(v as any)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {intervals.map((i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1" />
                  <div className="w-40">
                    <Label htmlFor="window">Window</Label>
                    <Input
                      id="window"
                      type="number"
                      min={2}
                      max={60}
                      value={windowSize}
                      onChange={(e) =>
                        setWindowSize(parseInt(e.target.value || "1", 10))
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="csvfile"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={async (e) => {
                        const f = (e.target as HTMLInputElement).files?.[0];
                        if (!f) return;
                        setUploadFileName(f.name);
                        const txt = await f.text();
                        (window as any).__latestCSV = txt;
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="csvfile"
                      className="inline-flex items-center cursor-pointer px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      Choose CSV
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={async () => {
                          const txt = (window as any).__latestCSV;
                          if (!txt) {
                            setError("No CSV selected");
                            return;
                          }
                          setUploading(true);
                          try {
                            try {
                              const j = await apiFetch(`/api/datasets/upload`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  key: uploadKey || dataset,
                                  csv: txt,
                                }),
                              });
                              setError(null);
                              setUploadFileName("");
                              // refresh uploaded list
                              const list = await apiFetch(`/api/datasets`);
                              setUploadedKeys(list.keys || []);
                              // auto-select the uploaded dataset and reload
                              setDataset(uploadKey || dataset);
                              await runAll();
                            } catch (err: any) {
                              throw err;
                            }
                          } catch (err: any) {
                            setError(err?.message || "Upload failed");
                            setErrorDetail(err);
                          } finally {
                            setUploading(false);
                          }
                        }}
                        disabled={uploading}
                        className="h-10 px-4"
                      >
                        {uploading ? "Uploading..." : "Upload CSV"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={async () => {
                          const txt = (window as any).__latestCSV;
                          if (!txt) {
                            setError("No CSV selected for test");
                            return;
                          }
                          setLoading(true);
                          try {
                            const r = await apiFetch(`/api/debug/echo`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ key: uploadKey || dataset, csv: txt }),
                            });
                            setError(null);
                            setErrorDetail(r);
                          } catch (err: any) {
                            setError(err?.message || "Echo failed");
                            setErrorDetail(err?.details ?? err);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="h-10 px-3"
                      >
                        Test Upload (echo)
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={async () => {
                          // Fetch metals (XAU/XAG) from server and upload as a dataset for training convenience
                          setLoading(true);
                          setError(null);
                          try {
                            const ds = dataset as string;
                            const resp = await apiFetch(`/api/metals/history?dataset=${encodeURIComponent(ds)}`);
                            if (resp?.error) throw new Error(resp.error);
                            // resp.data is an object keyed by symbol
                            // Convert to a CSV with columns: date,open,high,low,close,volume,symbol
                            const parts: string[] = [];
                            parts.push(["date","open","high","low","close","volume","symbol"].join(","));
                            for (const sym of Object.keys(resp.data || {})) {
                              const arr = resp.data[sym] || [];
                              for (const row of arr) {
                                const date = row.date;
                                // use close as all OHLC values
                                const close = row.close ?? row.price_inr ?? row.price_usd ?? "";
                                const line = [date, close, close, close, close, 0, sym].join(",");
                                parts.push(line);
                              }
                            }
                            const csv = parts.join("\n");
                            const key = `metals_${ds}_${Date.now()}`;
                            await apiFetch(`/api/datasets/upload`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ key, csv }),
                            });
                            const list = await apiFetch(`/api/datasets`);
                            setUploadedKeys(list.keys || []);
                            setDataset(key);
                            // set symbol to selected symbol and run
                            await runAll();
                          } catch (err: any) {
                            setError(err?.message || "Failed to load metals");
                            setErrorDetail(err);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="h-10 px-4"
                      >
                        Load & Use Metals Data
                      </Button>

                      <Button
                        variant="outline"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const ds = dataset as string;
                            const r = await apiFetch(`/api/metals/fetch-and-store?dataset=${encodeURIComponent(ds)}`, { method: "POST" });
                            if (r?.error) throw new Error(r.error);
                            // show stored confirmation
                            setError(null);
                            setErrorDetail(null);
                            // refresh stored view by calling server stored endpoint
                            await apiFetch(`/api/metals/stored`);
                          } catch (err: any) {
                            setError(err?.message || "Failed to store on server");
                            setErrorDetail(err);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="h-10 px-3"
                      >
                        Fetch & Store (Server)
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={runAll}
                    disabled={loading}
                    className="h-10 px-6"
                  >
                    {loading ? "Running..." : "Run"}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ma"
                      checked={useMA}
                      onCheckedChange={setUseMA}
                    />
                    <Label htmlFor="ma" className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: modelColors.ma }}
                      />
                      Moving Average
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ema"
                      checked={useEMA}
                      onCheckedChange={setUseEMA}
                    />
                    <Label htmlFor="ema" className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: modelColors.ema }}
                      />
                      Exponential MA
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="lr"
                      checked={useLR}
                      onCheckedChange={setUseLR}
                    />
                    <Label htmlFor="lr" className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: modelColors.lr }}
                      />
                      Linear Regression
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="sarima"
                      checked={useSARIMA}
                      onCheckedChange={setUseSARIMA}
                    />
                    <Label htmlFor="sarima" className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: modelColors.sarima }}
                      />
                      SARIMA
                    </Label>
                    {useSARIMA && (
                      <div className="ml-3 flex items-center gap-2">
                        <Label className="text-xs">Seasonal</Label>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={sarimaSeasonal}
                          onChange={(e) =>
                            setSarimaSeasonal(
                              parseInt(e.target.value || "1", 10),
                            )
                          }
                          className="w-20 h-8"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="lstm"
                      checked={useLSTM}
                      onCheckedChange={setUseLSTM}
                    />
                    <Label htmlFor="lstm" className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: modelColors.lstm }}
                      />
                      LSTM
                    </Label>
                    {useLSTM && (
                      <div className="ml-3 flex items-center gap-2">
                        <Label className="text-xs">Lookback</Label>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={lstmLookback}
                          onChange={(e) =>
                            setLstmLookback(parseInt(e.target.value || "1", 10))
                          }
                          className="w-20 h-8"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {error ? (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-900 mb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">Error</div>
                        <div className="mt-1 text-sm whitespace-pre-wrap">
                          {error}
                        </div>
                        {errorDetail ? (
                          <details className="mt-2 text-xs text-muted-foreground">
                            <summary className="cursor-pointer">
                              Show details
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto text-xs bg-red-10 p-2 rounded">
                              {typeof errorDetail === "string"
                                ? errorDetail
                                : JSON.stringify(errorDetail, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                      <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard?.writeText(
                              typeof errorDetail === "string"
                                ? errorDetail
                                : JSON.stringify(errorDetail || error),
                            );
                          }}
                        >
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setError(null);
                            setErrorDetail(null);
                          }}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {uploadedKeys.length ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Uploaded datasets: {uploadedKeys.join(", ")}
                  </div>
                ) : null}

                <div className="h-[380px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ left: 12, right: 24, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        opacity={0.12}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 12 }}
                      />
                      <ReTooltip />
                      <Legend />
                      {train && (
                        <ReferenceLine
                          x={chartData[train.splitIndex]?.date}
                          stroke="#64748b"
                          strokeDasharray="4 4"
                          label={{ value: "Train/Test Split", fill: "#64748b" }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke={modelColors.actual}
                        dot={false}
                        name="Actual"
                        strokeWidth={1.5}
                      />
                      {train?.predictions?.ma && (
                        <Line
                          type="monotone"
                          dataKey="ma"
                          stroke={modelColors.ma}
                          dot={false}
                          name="MA"
                          strokeWidth={1.6}
                        />
                      )}
                      {train?.predictions?.ema && (
                        <Line
                          type="monotone"
                          dataKey="ema"
                          stroke={modelColors.ema}
                          dot={false}
                          name="EMA"
                          strokeWidth={1.6}
                        />
                      )}
                      {train?.predictions?.lr && (
                        <Line
                          type="monotone"
                          dataKey="lr"
                          stroke={modelColors.lr}
                          dot={false}
                          name="Linear Reg"
                          strokeWidth={1.6}
                        />
                      )}
                      {train?.predictions?.sarima && (
                        <Line
                          type="monotone"
                          dataKey="sarima"
                          stroke={modelColors.sarima}
                          dot={false}
                          name="SARIMA"
                          strokeWidth={1.6}
                        />
                      )}
                      {train?.predictions?.lstm && (
                        <Line
                          type="monotone"
                          dataKey="lstm"
                          stroke={modelColors.lstm}
                          dot={false}
                          name="LSTM"
                          strokeWidth={1.6}
                        />
                      )}

                      {/* Next-day markers */}
                      {train?.nextDayPrediction &&
                        (() => {
                          // compute next date as last row's date
                          const last = (train.data || [])[
                            train.data.length - 1
                          ];
                          if (!last) return null;
                          const lastDate = new Date(last.date);
                          let stepDays = 1;
                          if (interval === "1wk") stepDays = 7;
                          else if (interval === "1mo") stepDays = 30;
                          const nextDate = new Date(lastDate);
                          nextDate.setDate(nextDate.getDate() + stepDays);
                          const nextDateStr = nextDate
                            .toISOString()
                            .slice(0, 10);
                          return Object.entries(train.nextDayPrediction).map(
                            ([k, v]) => (
                              <ReferenceDot
                                key={k}
                                x={nextDateStr}
                                y={v as number}
                                r={4}
                                fill={(modelColors as any)[k] ?? "#000"}
                                stroke="none"
                              />
                            ),
                          );
                        })()}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <Tabs defaultValue="metrics" className="w-full">
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    <TabsTrigger value="next">Next Day</TabsTrigger>
                  </TabsList>
                  <TabsContent value="metrics" className="space-y-3">
                    {train ? (
                      (() => {
                        // compute client-side metrics for any model predictions missing in train.metrics
                        const metricsFromServer = train.metrics || {};
                        const combined: Record<string, any> = {
                          ...metricsFromServer,
                        };
                        const preds = train.predictions || {};
                        const actuals = (train.data || []).map((d) => d.close);

                        function computeClientMetrics(
                          yTrue: number[],
                          yPred: Array<number | null>,
                        ) {
                          const n = Math.min(yTrue.length, yPred.length);
                          let sse = 0;
                          let sae = 0;
                          let sc = 0;
                          let smape = 0;
                          for (let i = 0; i < n; i++) {
                            const yt = yTrue[i];
                            const yp =
                              yPred[i] == null ? NaN : Number(yPred[i]);
                            if (!isFinite(yp) || !isFinite(yt)) continue;
                            const err = yt - yp;
                            sse += err * err;
                            sae += Math.abs(err);
                            smape += Math.abs(err / yt);
                            sc++;
                          }
                          return {
                            rmse: sc ? Math.sqrt(sse / sc) : NaN,
                            mae: sc ? sae / sc : NaN,
                            mape: sc ? (smape / sc) * 100 : NaN,
                          };
                        }

                        // ensure models requested in last run are present
                        (lastModels || []).forEach((lm) => {
                          if (!combined[lm]) combined[lm] = null;
                        });

                        Object.keys(preds).forEach((k) => {
                          const srv = combined[k];
                          const needs =
                            !srv ||
                            !isFinite(Number(srv?.rmse)) ||
                            !isFinite(Number(srv?.mae)) ||
                            !isFinite(Number(srv?.mape));
                          if (needs) {
                            const pArr = (preds as any)[k].map(
                              (r: any) => r?.predicted ?? null,
                            );
                            combined[k] = computeClientMetrics(actuals, pArr);
                          }
                        });

                        return Object.entries(combined).map(([k, m]) => {
                          const safe = (v: any) =>
                            isFinite(Number(v)) ? Number(v).toFixed(2) : "—";
                          const mObj = m || { rmse: NaN, mae: NaN, mape: NaN };
                          return (
                            <Card key={k}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <span
                                      className="inline-block size-3 rounded-full"
                                      style={{
                                        backgroundColor:
                                          (modelColors as any)[k] ?? "#999",
                                      }}
                                    />
                                    {(k as string).toUpperCase()} Metrics
                                  </CardTitle>
                                  <Badge variant="outline">Test</Badge>
                                </div>
                                <CardDescription>
                                  Evaluation on hold-out data
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                  <div>
                                    <div className="text-muted-foreground">
                                      RMSE
                                    </div>
                                    <div className="font-semibold">
                                      {safe(mObj.rmse)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">
                                      MAE
                                    </div>
                                    <div className="font-semibold">
                                      {safe(mObj.mae)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">
                                      MAPE
                                    </div>
                                    <div className="font-semibold">
                                      {safe(mObj.mape)}
                                      {isFinite(Number(mObj.mape)) ? "%" : ""}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        });
                      })()
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Run the models to see metrics.
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="next">
                    <Card>
                      <CardHeader>
                        <CardTitle>Next-day prediction</CardTitle>
                        <CardDescription>
                          Values predicted from the end of the selected range
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {nextPredSummary.map((p) => (
                            <div
                              key={p.name}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block size-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      (modelColors as any)[
                                        p.name.toLowerCase()
                                      ] ?? "#999",
                                  }}
                                />
                                <span className="font-medium">{p.name}</span>
                              </div>
                              <span className="tabular-nums font-semibold">
                                ${""}
                                {p.value?.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
