"use client";
// Resolved token values for JS consumers (Recharts, d3/SVG map) that need literal colours.
import { useEffect, useState } from "react";
import { tokens } from "./tokens";

export type ThemeMode = "light" | "dark";

export function resolveTokens(mode: ThemeMode = "light") {
  return {
    ...tokens,
    ui: tokens.color[mode],
    risk: tokens.color.risk,
    hazard: tokens.color.hazard,
    provenance: tokens.color.provenance,
    chart: tokens.color.chart,
    quality: tokens.color.quality,
  };
}

export function useTokens() {
  const [mode, setMode] = useState<ThemeMode>("light");
  useEffect(() => {
    const read = () => setMode(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return resolveTokens(mode);
}
