"use client";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWhen } from "@/lib/when";
import type { Edge, Plant, PlantExposure } from "@/lib/api";
import { BAND_STYLE, BANDS } from "@/lib/bands";
import { useAssumptionValue } from "@/lib/assumptions";
import type { Both } from "@/lib/exposure";
import type { Hazard } from "@/components/data/HazardIcon";
import { Prov } from "@/components/data/Prov";
import { IndiaMap } from "./IndiaMap";
import type { MapGeometry } from "./geo";

export type MapWhen = "now" | "2040";

/** Map card with its own Now | 2040 switch, legend and an Enlarge button. */
export function MapPanel({ geometry, plants, edges, exposure, active, onHover, onSelect, legend = "full", className = "", mapClass = "max-w-2xl" }: {
  geometry: MapGeometry; plants: Plant[] | null; edges: Edge[] | null; exposure: Both | null;
  active: string | null; onHover: (id: string | null) => void; onSelect: (id: string) => void;
  legend?: "full" | "short"; className?: string; mapClass?: string;
}) {
  // Follows the page's Now / 2040 tab; the local switch can still override it until the tab changes.
  const [lead] = useWhen();
  const [when, setWhen] = useState<MapWhen>(lead);
  useEffect(() => setWhen(lead), [lead]);
  const [big, setBig] = useState(false);
  const style = useMemo(() => {
    const colors: Record<string, { fill: string; stroke: string }> = {};
    const hazards: Record<string, Hazard[]> = {};
    const now: Record<string, PlantExposure> = {}, y2040: Record<string, PlantExposure> = {};
    if (exposure) {
      for (const r of exposure.now.plants) now[r.plant_id] = r;
      for (const r of exposure.y2040.plants) y2040[r.plant_id] = r;
      for (const r of (when === "2040" ? exposure.y2040 : exposure.now).plants) {
        colors[r.plant_id] = BAND_STYLE[r.band];
        hazards[r.plant_id] = r.exposed_hazards;
      }
    }
    return { colors, hazards, now, y2040 };
  }, [exposure, when]);

  const ready = plants && edges;
  const map = (onPick: (id: string) => void) => ready && (
    <IndiaMap geometry={geometry} plants={plants} edges={edges} activeId={active} onHover={onHover} onSelect={onPick}
      colorByPlant={style.colors} hazardsByPlant={style.hazards} exposureNow={style.now} exposure2040={style.y2040} colourLabel={when === "2040" ? "2040" : "Now"} />
  );
  const whenLabel = when === "2040" ? "2040" : "now";

  return (
    <section aria-label="Map" data-tour="plants-map" className={`flex flex-col gap-2 rounded-lg border border-border-strong bg-surface p-4 shadow-card ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ColourSwitch value={when} onChange={setWhen} />
        {ready && (
          <button onClick={() => setBig(true)} aria-haspopup="dialog"
            className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface px-2 py-1 text-small text-ink hover:border-ink">
            <ExpandIcon /> Enlarge
          </button>
        )}
      </div>
      {ready ? <div className={`mx-auto w-full ${mapClass}`}>{map(onSelect)}</div> : <div className="aspect-[56/62] w-full animate-pulse rounded-md bg-border" />}
      <MapLegend when={whenLabel} short={legend === "short"} />
      {big && ready && (
        <MapDialog onClose={() => setBig(false)} title={`Nimbus Cement plants · risk band, ${whenLabel}`} switcher={<ColourSwitch value={when} onChange={setWhen} />}>
          {map((id) => { setBig(false); onSelect(id); })}
          <MapLegend when={whenLabel} />
        </MapDialog>
      )}
    </section>
  );
}

function ColourSwitch({ value, onChange }: { value: MapWhen; onChange: (w: MapWhen) => void }) {
  return (
    <div className="inline-flex items-center gap-2 text-small text-muted">
      <ToggleGroup.Root type="single" value={value} onValueChange={(v) => v && onChange(v as MapWhen)} aria-label="Map year"
        className="inline-flex rounded-md border border-border-strong p-[2px]">
        {(["now", "2040"] as const).map((w) => (
          <ToggleGroup.Item key={w} value={w}
            className="rounded-sm px-2 py-[2px] text-small text-muted transition-colors hover:text-ink data-[state=on]:bg-accent data-[state=on]:text-surface">
            {w === "now" ? "Now" : "2040"}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}

function MapLegend({ when, short = false }: { when: string; short?: boolean }) {
  const [mod, high, sev] = [useAssumptionValue("band_moderate_pct"), useAssumptionValue("band_high_pct"), useAssumptionValue("band_severe_pct")];
  return (
    <div className="mt-3 flex flex-col gap-2 border-t hairline pt-3 text-micro tracking-normal text-ink2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-muted">Risk band, {when}</span>
        {BANDS.map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" className={`${BAND_STYLE[b].fill} stroke-ink2`} strokeWidth="0.6" /></svg>
            {b}
          </span>
        ))}
        <Prov v={{ kind: "derived", source_ids: ["plants_csv", "openmeteo_climate", "aqueduct40", "asm.band_moderate_pct", "asm.band_high_pct", "asm.band_severe_pct"] }}
          extra={`Based on the share of a plant's revenue at risk each year: Moderate from ${mod ?? "…"}%, High from ${high ?? "…"}%, Severe from ${sev ?? "…"}%.`}>
          <span className="text-muted">How bands work</span>
        </Prov>
      </div>
      {!short && <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="inline-flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" className="fill-ink2" /></svg>
          Integrated plant (kiln)
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4" className="fill-surface stroke-ink2" strokeWidth="2" /></svg>
          Grinding unit
        </span>
        <span>Size = revenue</span>
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden><path d="M1 5 H19" className="stroke-ink2" strokeWidth="3" /></svg>
          Clinker flow (width = Mt a year)
        </span>
      </div>
      </>}
      <span className="text-muted">{short ? "Size = revenue · lines = clinker flows · " : ""}Map: OpenStreetMap India boundary.</span>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="fill-none stroke-ink" strokeWidth={1.4} strokeLinecap="round">
      <path d="M7 1h4v4M5 11H1V7M11 1L7 5M1 11l4-4" />
    </svg>
  );
}

/** Full-screen map. Esc or the close button closes it; focus returns to the page. */
function MapDialog({ title, onClose, switcher, children }: { title: string; onClose: () => void; switcher?: React.ReactNode; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; prev?.focus(); };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-5xl flex-col gap-2 overflow-auto rounded-lg bg-surface2 p-4 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-h3 text-ink">{title}</h2>
          {switcher}
          <button ref={closeRef} onClick={onClose} className="rounded-pill border border-border-strong bg-surface px-3 py-1 text-small text-ink hover:border-ink">Close ✕</button>
        </div>
        <div className="mx-auto w-full max-w-[min(100%,calc((100vh-14rem)*0.9))]">{children}</div>
      </div>
    </div>
  );
}
