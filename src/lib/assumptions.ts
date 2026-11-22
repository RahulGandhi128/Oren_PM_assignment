"use client";
import { useEffect, useState } from "react";
import { api, type Assumption } from "./api";
import { useOverrides } from "./store";

let cache: Promise<Assumption[]> | null = null;

/** Defaults from /api/assumptions (fetched once per page load). */
export function useAssumptionDefaults(): Assumption[] | null {
  const [a, setA] = useState<Assumption[] | null>(null);
  useEffect(() => {
    cache ??= api.assumptions();
    cache.then(setA).catch(() => { cache = null; });
  }, []);
  return a;
}

/** Current value of an assumption: session override if set, else default. */
export function useAssumptionValue(id: string): number | null {
  const defaults = useAssumptionDefaults();
  const overrides = useOverrides();
  if (id in overrides) return overrides[id];
  return defaults?.find((x) => x.id === id)?.value ?? null;
}

/** Input step for an assumption, from its unit and range. */
export function stepFor(a: Assumption): number {
  if (a.unit.startsWith("probability")) return 0.001;
  if (a.unit.startsWith("fraction")) return 0.01;
  if (a.unit.startsWith("days") || a.unit === "days/year") return 1;
  return 0.1;
}
