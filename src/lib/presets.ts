"use client";
import { useEffect, useState } from "react";
import { api, type Preset } from "./api";

let cache: Promise<Preset[]> | null = null;

export function usePresets(): Preset[] | null {
  const [p, setP] = useState<Preset[] | null>(null);
  useEffect(() => {
    cache ??= api.presets();
    cache.then(setP).catch(() => { cache = null; });
  }, []);
  return p;
}

export type ActiveSet = Preset["id"] | "custom";

/** Which set the current overrides correspond to. Central (official) = no overrides. */
export function activeSet(overrides: Record<string, number>, presets: Preset[] | null): ActiveSet {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return "central";
  for (const p of presets ?? []) {
    const pk = Object.keys(p.overrides);
    if (pk.length === keys.length && pk.every((k) => overrides[k] === p.overrides[k])) return p.id;
  }
  return "custom";
}

export const SET_LABEL: Record<ActiveSet, string> = {
  central: "Central (official)",
  conservative: "Conservative preset",
  severe: "Severe preset",
  custom: "Custom",
};
