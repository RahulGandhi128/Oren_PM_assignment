import type { components } from "./api-types";

export type Band = components["schemas"]["PlantExposure"]["band"];
export const BANDS: Band[] = ["Low", "Moderate", "High", "Severe"];

/** Literal class names so Tailwind generates them. Colours come from tokens.color.risk. */
export const BAND_STYLE: Record<Band, { fill: string; stroke: string; bg: string }> = {
  Low: { fill: "fill-risk-low", stroke: "stroke-risk-low", bg: "bg-risk-low" },
  Moderate: { fill: "fill-risk-moderate", stroke: "stroke-risk-moderate", bg: "bg-risk-moderate" },
  High: { fill: "fill-risk-high", stroke: "stroke-risk-high", bg: "bg-risk-high" },
  Severe: { fill: "fill-risk-severe", stroke: "stroke-risk-severe", bg: "bg-risk-severe" },
};
