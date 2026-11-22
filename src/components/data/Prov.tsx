"use client";
import type { Value } from "@/lib/api";
import { useAssumptionDefaults } from "@/lib/assumptions";
import { tipProps } from "@/lib/tooltip";

type ProvLike = Pick<Value, "kind" | "source_ids"> & { note?: string | null };

export const SOURCE_NAMES: Record<string, string> = {
  plants_csv: "Nimbus plant register (FY2025-26)",
  openmeteo_climate: "Open-Meteo Climate API, CMIP6 HighResMIP, 7 models",
  osm_india: "OpenStreetMap India boundary",
  aqueduct40: "WRI Aqueduct 4.0",
};
/** Plain names for hover text. */
const SOURCE_PLAIN: Record<string, string> = {
  plants_csv: "the plant register",
  openmeteo_climate: "climate models",
  osm_india: "OpenStreetMap",
  aqueduct40: "WRI water and flood data",
};

/** True when the value moves if someone changes an assumption. */
export const isAssumptionDriven = (v: ProvLike) => v.kind === "assumption" || v.source_ids.some((s) => s.startsWith("asm."));

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Hover text in plain words: where the number comes from, and whether it depends on assumptions. */
export function useProvText(v: ProvLike | null | undefined, extra?: string | null): string {
  const asm = useAssumptionDefaults();
  if (!v) return extra ?? "";
  const label = (id: string) => asm?.find((a) => a.id === id)?.label ?? id;
  const src = [...new Set(v.source_ids.filter((s) => !s.startsWith("asm.")).map((s) => SOURCE_PLAIN[s] ?? s))];
  const asms = v.source_ids.filter((s) => s.startsWith("asm."));
  const lines: string[] = [];
  if (v.kind === "placeholder") lines.push("Missing in the source data.");
  else if (v.kind === "assumption") lines.push("An assumption. You can change it in Methodology.");
  else if (v.kind === "data") lines.push(`From ${list(src)}.`);
  else lines.push(src.length ? `Calculated from ${list(src)}.` : "Calculated.");
  if (v.kind !== "assumption" && asms.length === 1) lines.push(`Depends on one assumption (${label(asms[0].slice(4)).toLowerCase()}). Change it in Methodology.`);
  else if (v.kind !== "assumption" && asms.length > 1) lines.push(`Depends on ${asms.length} assumptions. Change them in Methodology.`);
  if (v.note) lines.push(v.note);
  if (extra) lines.push(extra);
  return lines.join("\n");
}

/**
 * Wraps a shown number. Assumption-driven values get a dotted underline; every value gets a
 * tooltip with its provenance. Placeholders are underlined in the placeholder colour.
 */
export function Prov({ v, extra, children, className = "" }: { v: ProvLike | null | undefined; extra?: string | null; children: React.ReactNode; className?: string }) {
  const text = useProvText(v, extra);
  if (!v) return <>{children}</>;
  const line = v.kind === "placeholder" ? "underline decoration-dotted decoration-prov-placeholder decoration-2 underline-offset-4"
    : isAssumptionDriven(v) ? "underline decoration-dotted decoration-prov-assumption underline-offset-4" : "";
  return (
    <span tabIndex={line ? 0 : undefined} className={`cursor-help rounded-sm outline-offset-2 ${line} ${className}`} {...tipProps(text)}>
      {children}
    </span>
  );
}
