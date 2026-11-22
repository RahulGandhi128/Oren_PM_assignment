import type { components } from "./api-types";

export type Value = components["schemas"]["Value"];
export type Plant = components["schemas"]["Plant"];
export type Edge = components["schemas"]["Edge"];
export type Network = components["schemas"]["Network"];
export type PlantExposure = components["schemas"]["PlantExposure"];
export type ExposureResponse = components["schemas"]["ExposureResponse"];
export type SummaryResponse = components["schemas"]["SummaryResponse"];
export type StressResponse = components["schemas"]["StressResponse"];
export type Assumption = components["schemas"]["Assumption"];
export type Catalog = components["schemas"]["Catalog"];
export type CatalogSource = components["schemas"]["CatalogSource"];
export type Preset = components["schemas"]["Preset"];
export type SensitivityResponse = components["schemas"]["SensitivityResponse"];
export type SensitivityRow = components["schemas"]["SensitivityRow"];
export type RangeSensitivityResponse = components["schemas"]["RangeSensitivityResponse"];
export type RangeSensitivityRow = components["schemas"]["RangeSensitivityRow"];
export type Health = components["schemas"]["Health"];

type Overrides = Record<string, number>;

/** The API's 422 message (e.g. an assumption out of range), so the UI can show it. */
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function handle<T>(path: string, r: Response): Promise<T> {
  if (r.ok) return r.json() as Promise<T>;
  let msg = `${path}: HTTP ${r.status}`;
  try {
    const body = await r.json();
    if (typeof body.detail === "string") msg = body.detail;
    else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join("; ");
  } catch { /* keep default */ }
  throw new ApiError(r.status, msg);
}

const get = <T,>(path: string) => fetch(path).then((r) => handle<T>(path, r));
const post = <T,>(path: string, body: unknown, signal?: AbortSignal) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal })
    .then((r) => handle<T>(path, r));

export const api = {
  plants: () => get<Plant[]>("/api/plants"),
  network: () => get<Network>("/api/network"),
  assumptions: () => get<Assumption[]>("/api/assumptions"),
  sources: () => get<{ sources: Record<string, unknown>[] }>("/api/sources"),
  catalog: () => get<Catalog>("/api/catalog"),
  presets: () => get<Preset[]>("/api/presets"),
  health: () => get<Health>("/api/health"),
  /** Tornado: 2040 total with each assumption at its min and max, others at Central (official set). */
  rangeSensitivity: () => get<RangeSensitivityResponse>("/api/sensitivity"),
  sensitivity: (overrides: Overrides = {}, signal?: AbortSignal) => post<SensitivityResponse>("/api/sensitivity", { overrides }, signal),
  exposure: (horizon: "today" | "2040", overrides: Overrides = {}) =>
    post<ExposureResponse>("/api/exposure", { horizon, overrides }),
  summary: (overrides: Overrides = {}, signal?: AbortSignal) => post<SummaryResponse>("/api/summary", { overrides }, signal),
  stress: (plant_id: string, days: number, overrides: Overrides = {}, signal?: AbortSignal) =>
    post<StressResponse>("/api/stress", { plant_id, days, overrides }, signal),
};

/** Data export (physical risk only). The same overrides the app is showing; the server computes the same set ID. */
export const EXPORT_TABLES = ["exposure", "hazards", "assumptions", "sources"] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];
export function exportUrl(what: "xlsx" | ExportTable, overrides: Overrides = {}): string {
  const base = what === "xlsx" ? "/api/export.xlsx" : `/api/export/${what}.csv`;
  return Object.keys(overrides).length ? `${base}?overrides=${encodeURIComponent(JSON.stringify(overrides))}` : base;
}
