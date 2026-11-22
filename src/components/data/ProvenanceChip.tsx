import type { Value } from "@/lib/api";

type Kind = Value["kind"];

const LABEL: Record<Kind, string> = { data: "Data", derived: "Derived", assumption: "Assumption", placeholder: "Placeholder" };
const GLYPH: Record<Kind, string> = { data: "●", derived: "◆", assumption: "◇", placeholder: "▨" };
const STYLE: Record<Kind, string> = {
  data: "bg-prov-data text-surface border-prov-data",
  derived: "bg-prov-derived text-surface border-prov-derived",
  assumption: "border-dashed border-prov-assumption text-prov-assumption",
  placeholder: "prov-striped border-prov-placeholder text-prov-placeholder",
};

const SOURCE_NAMES: Record<string, string> = {
  plants_csv: "Nimbus plant register (nimbus_cement_plants.csv, FY2025-26)",
  openmeteo_climate: "Open-Meteo Climate API, CMIP6 HighResMIP, 7 models (accessed 21 Nov 2026)",
  osm_india: "OpenStreetMap India boundary",
  aqueduct40: "WRI Aqueduct 4.0, Water Risk Atlas point lookup (accessed 21 Nov 2026)",
};

export function ProvenanceChip({ kind, sources = [], note, compact = false }: { kind: Kind; sources?: string[]; note?: string | null; compact?: boolean }) {
  const tip = [LABEL[kind], ...sources.map((s) => SOURCE_NAMES[s] ?? s), note].filter(Boolean).join("\n");
  if (compact) {
    return (
      <span title={tip} aria-label={`Provenance: ${tip}`}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-pill border text-micro leading-none ${STYLE[kind]}`}>
        <span aria-hidden>{GLYPH[kind]}</span>
      </span>
    );
  }
  return (
    <span
      title={tip}
      aria-label={`Provenance: ${tip}`}
      className={`inline-flex items-center gap-1 rounded-pill border px-2 text-micro uppercase leading-normal ${STYLE[kind]}`}
    >
      <span aria-hidden>{GLYPH[kind]}</span>
      {LABEL[kind]}
    </span>
  );
}
