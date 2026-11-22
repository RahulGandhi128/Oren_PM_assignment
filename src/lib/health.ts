"use client";
import { useEffect, useState } from "react";
import { api, type Health } from "./api";

let cache: Promise<Health> | null = null;

/** /api/health, fetched once per page load: data build time and source download date. */
export function useHealth(): Health | null {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    cache ??= api.health();
    cache.then(setH).catch(() => { cache = null; });
  }, []);
  return h;
}

const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const long = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const dataDateShort = (iso: string | null | undefined) => (iso ? short.format(new Date(iso)) : "…");
export const dataDateLong = (iso: string | null | undefined) => (iso ? long.format(new Date(iso)) : "…");
