import { apiFetch } from "./api";

export async function fetchMetalsHistory(options?: {
  symbols?: string; // comma separated, e.g. 'XAU,XAG'
  start?: string; // YYYY-MM-DD
  end?: string;
}) {
  const params = new URLSearchParams();
  if (options?.symbols) params.set("symbols", options.symbols);
  if (options?.start) params.set("start", options.start);
  if (options?.end) params.set("end", options.end);
  const url = `/api/metals/history${params.toString() ? `?${params.toString()}` : ""}`;
  return apiFetch(url);
}
