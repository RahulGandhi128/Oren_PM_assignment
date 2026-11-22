"use client";
import { useEffect, useState } from "react";
import { api, type ExposureResponse } from "./api";
import { useOverrides } from "./store";

export type Both = { now: ExposureResponse; y2040: ExposureResponse };

/** Engine output for now and 2040 together, with the session's overrides. */
export function useExposureBoth(): { data: Both | null; error: string | null } {
  const overrides = useOverrides();
  const [data, setData] = useState<Both | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([api.exposure("today", overrides), api.exposure("2040", overrides)])
      .then(([now, y2040]) => live && (setData({ now, y2040 }), setError(null)))
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => { live = false; };
  }, [overrides]);
  return { data, error };
}
