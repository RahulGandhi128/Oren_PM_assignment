"use client";
// Assumption set ID (audit trail, beta). Every combination of assumption values plus data version
// gets a short, deterministic ID, so a board number can be traced to the exact set that produced it.
// Sets can be saved to and loaded from a small JSON file; nothing is stored on a server.
import { useMemo } from "react";
import type { Assumption, Health } from "./api";
import { useAssumptionDefaults } from "./assumptions";
import { useHealth } from "./health";
import { activeSet, usePresets, type ActiveSet } from "./presets";
import { sha256Hex } from "./sha256";
import { useOverrides } from "./store";

export const SET_SHORT: Record<ActiveSet, string> = { central: "Central", conservative: "Conservative", severe: "Severe", custom: "Custom" };
export const SET_FILE_FORMAT = "horizon-assumption-set";
export const SET_FILE_VERSION = 1;

/** Every assumption at its effective value (override if set, else default). */
export function resolveValues(defaults: Assumption[], overrides: Record<string, number>): Record<string, number> {
  return Object.fromEntries(defaults.map((a) => [a.id, a.id in overrides ? overrides[a.id] : a.default]));
}

/**
 * Canonical text that is hashed: version tag, data build time, data download date, then every
 * assumption as id=value, sorted by id. ID = first 4 hex characters of its SHA-256, upper case.
 */
export function canonicalSet(values: Record<string, number>, health: Pick<Health, "data_generated_at" | "data_as_of">): string {
  const rows = Object.keys(values).sort().map((id) => `${id}=${values[id]}`);
  return [`horizon-set-v${SET_FILE_VERSION}`, `data=${health.data_generated_at ?? ""}`, `as_of=${health.data_as_of ?? ""}`, ...rows].join("\n");
}

export type AssumptionSetInfo = {
  set: ActiveSet;
  label: string;          // "Central"
  id: string;             // "A3F9"
  hash: string;           // full SHA-256, written to saved files
  values: Record<string, number>;
  overrides: Record<string, number>;
  health: Health;
};

export function useAssumptionSet(): AssumptionSetInfo | null {
  const defaults = useAssumptionDefaults();
  const presets = usePresets();
  const overrides = useOverrides();
  const health = useHealth();
  return useMemo(() => {
    if (!defaults || !health) return null;
    const values = resolveValues(defaults, overrides);
    const hash = sha256Hex(canonicalSet(values, health));
    const set = activeSet(overrides, presets);
    return { set, label: SET_SHORT[set], id: hash.slice(0, 4).toUpperCase(), hash, values, overrides, health };
  }, [defaults, presets, overrides, health]);
}

export type SavedSetFile = {
  format: typeof SET_FILE_FORMAT;
  version: number;
  set_id: string;
  set_hash: string;
  label: string;
  saved_version?: number;
  saved_by?: string;
  saved_at: string;
  data: { generated_at: string | null; as_of: string | null };
  overrides: Record<string, number>;
  assumptions: Record<string, number>;
  results?: { revenue_at_risk_cr: { now: number | null; "2040": number | null } };
  note: string;
};

export function buildSetFile(info: AssumptionSetInfo, saved: { version: number; by: string; at: string }, results?: SavedSetFile["results"]): SavedSetFile {
  return {
    format: SET_FILE_FORMAT,
    version: SET_FILE_VERSION,
    set_id: info.id,
    set_hash: info.hash,
    label: info.label,
    saved_version: saved.version,
    saved_by: saved.by,
    saved_at: saved.at,
    data: { generated_at: info.health.data_generated_at, as_of: info.health.data_as_of },
    overrides: info.overrides,
    assumptions: info.values,
    ...(results ? { results } : {}),
    note: "Horizon assumption set. Load it on the Methodology page to reproduce these numbers.",
  };
}

export type ParsedSet =
  | { ok: true; file: SavedSetFile; overrides: Record<string, number>; ignored: string[]; missing: string[]; dataMatches: boolean }
  | { ok: false; error: string };

/**
 * Reads a saved file into overrides against the current defaults. Uses the full list of values, so a
 * set reproduces exactly even if a default has changed since it was saved. Range checks are left to
 * the engine (the caller validates the result with the API before applying it).
 */
export function parseSetFile(text: string, defaults: Assumption[], health: Health): ParsedSet {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "This file is not valid JSON." }; }
  const f = raw as Partial<SavedSetFile>;
  if (!f || typeof f !== "object" || f.format !== SET_FILE_FORMAT) return { ok: false, error: "This is not a Horizon assumption set file." };
  if (f.version !== SET_FILE_VERSION) return { ok: false, error: `This file uses format version ${String(f.version)}; this app reads version ${SET_FILE_VERSION}.` };
  const values = f.assumptions;
  if (!values || typeof values !== "object") return { ok: false, error: "The file has no assumption values." };
  const known = new Map(defaults.map((a) => [a.id, a]));
  const overrides: Record<string, number> = {};
  const ignored: string[] = [];
  for (const [id, v] of Object.entries(values)) {
    const a = known.get(id);
    if (!a) { ignored.push(id); continue; }
    if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: `“${a.label}” has a value that is not a number.` };
    if (v !== a.default) overrides[id] = v;
  }
  const missing = defaults.filter((a) => !(a.id in values)).map((a) => a.label);
  const dataMatches = f.data?.generated_at === health.data_generated_at && f.data?.as_of === health.data_as_of;
  return { ok: true, file: f as SavedSetFile, overrides, ignored, missing, dataMatches };
}
