"use client";
import { geoMercator } from "d3-geo";
import { useMemo } from "react";
import type { Edge, Plant, PlantExposure } from "@/lib/api";
import type { MapGeometry } from "./geo";
import { HAZARD_LABEL, type Hazard } from "@/components/data/HazardIcon";
import { BAND_STYLE } from "@/lib/bands";
import { formatCr, formatPct, num } from "@/lib/format";

/**
 * Label placement, in map units relative to the plant dot. Hand-tuned so labels
 * never sit on a flow line. The eastern cluster (Baloda Bazar, Paradip, Durgapur)
 * is offset further out with short leader lines.
 */
const LABELS: Record<string, { dx: number; dy: number; anchor: "start" | "end" | "middle"; leader?: boolean }> = {
  P01: { dx: -16, dy: -10, anchor: "end" },
  P02: { dx: 0, dy: -18, anchor: "middle" },
  P03: { dx: -16, dy: 4, anchor: "end" },
  P04: { dx: -16, dy: 4, anchor: "end" },
  P05: { dx: 16, dy: 4, anchor: "start" },
  P06: { dx: -26, dy: -20, anchor: "end", leader: true },
  P07: { dx: -6, dy: 26, anchor: "start", leader: true },
  P08: { dx: 34, dy: 26, anchor: "start", leader: true },
  P09: { dx: 34, dy: -26, anchor: "start", leader: true },
};
const DEFAULT_LABEL = { dx: 14, dy: 4, anchor: "start" as const, leader: false };

type Props = {
  geometry: MapGeometry;
  plants: Plant[];
  edges: Edge[];
  /** Hazards to badge next to each label (from hazard data; empty until it is loaded). */
  hazardsByPlant?: Record<string, Hazard[]>;
  /** Fill/stroke class per plant (risk band). Without it, markers are neutral. */
  colorByPlant?: Record<string, { fill: string; stroke: string }>;
  /** Engine output per plant (now and 2040), shown together in the hover card. */
  exposureNow?: Record<string, PlantExposure>;
  exposure2040?: Record<string, PlantExposure>;
  /** Which horizon the marker colours show ("Now" or "2040"). */
  colourLabel?: string;
  activeId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  compact?: boolean;
};

export function IndiaMap({ geometry, plants, edges, hazardsByPlant = {}, colorByPlant = {}, exposureNow = {}, exposure2040 = {}, colourLabel = "2040", activeId = null, onHover, onSelect, compact = false }: Props) {
  const projection = useMemo(
    () => geoMercator().scale(geometry.scale).translate(geometry.translate),
    [geometry.scale, geometry.translate],
  );


  const maxRev = Math.max(...plants.map((p) => num(p.revenue)));
  const pts = useMemo(() => {
    const m = new Map<string, { x: number; y: number; r: number; p: Plant }>();
    for (const p of plants) {
      const [x, y] = projection([p.lon, p.lat])!;
      m.set(p.id, { x, y, r: 3 + 8 * Math.sqrt(num(p.revenue) / maxRev), p });
    }
    return m;
  }, [plants, projection, maxRev]);

  const maxMt = Math.max(...edges.map((e) => num(e.clinker)), 1);
  const linked = new Set<string>();
  if (activeId) for (const e of edges) if (e.from_id === activeId || e.to_id === activeId) linked.add(e.from_id).add(e.to_id);

  const hovered = activeId ? pts.get(activeId) : undefined;
  const nameOf = (id: string) => pts.get(id)?.p.short_name ?? id;

  return (
    <div className="relative">
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Map of India showing Nimbus Cement's nine plants and clinker flows from kilns to grinding units"
    >
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"
          markerUnits="userSpaceOnUse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-ink2" />
        </marker>
        <marker id="flow-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"
          markerUnits="userSpaceOnUse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-accent" />
        </marker>
      </defs>

      <path d={geometry.outline} className="fill-surface stroke-border-strong" strokeWidth={0.8} strokeLinejoin="round" />

      {/* Clinker flows: kiln → grinding unit, width by Mt shipped */}
      <g fill="none">
        {edges.map((e) => {
          const a = pts.get(e.from_id), b = pts.get(e.to_id);
          if (!a || !b) return null;
          const w = 1.2 + 3.6 * (num(e.clinker) / maxMt);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
          // control point bowed to the left of travel direction
          const cx = mx - (dy / len) * len * 0.22, cy = my + (dx / len) * len * 0.22;
          // stop short of the target ring so the arrowhead stays visible
          const tx = b.x - cx, ty = b.y - cy, tl = Math.hypot(tx, ty);
          const ex = b.x - (tx / tl) * (b.r + 3), ey = b.y - (ty / tl) * (b.r + 3);
          const sx = a.x + ((cx - a.x) / Math.hypot(cx - a.x, cy - a.y)) * (a.r + 1);
          const sy = a.y + ((cy - a.y) / Math.hypot(cx - a.x, cy - a.y)) * (a.r + 1);
          const active = activeId != null && (e.from_id === activeId || e.to_id === activeId);
          return (
            <path
              key={`${e.from_id}-${e.to_id}`}
              d={`M${sx},${sy} Q${cx},${cy} ${ex},${ey}`}
              strokeWidth={w}
              strokeLinecap="round"
              markerEnd={`url(#${active ? "flow-arrow-active" : "flow-arrow"})`}
              className={`flow-line transition-colors ${active ? "stroke-accent flow-line-active" : "stroke-ink2 opacity-60"}`}
            >
              <title>{`${a.p.short_name} → ${b.p.short_name}: ${num(e.clinker).toFixed(2)} Mt clinker a year (${e.mode})`}</title>
            </path>
          );
        })}
      </g>

      {/* Plants */}
      {[...pts.values()].map(({ x, y, r, p }) => {
        const kiln = p.type === "integrated";
        const c = colorByPlant[p.id];
        const L = LABELS[p.id] ?? DEFAULT_LABEL;
        const active = activeId === p.id;
        const dim = activeId != null && !active && !linked.has(p.id);
        const lx = x + L.dx, ly = y + L.dy;
        return (
          <g
            key={p.id}
            className={`cursor-pointer transition-opacity ${dim ? "opacity-40" : "opacity-100"}`}
            onMouseEnter={() => onHover?.(p.id)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onSelect?.(p.id)}
            onFocus={() => onHover?.(p.id)}
            onBlur={() => onHover?.(null)}
            onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && onSelect?.(p.id)}
            tabIndex={0}
            role="link"
            aria-label={`${p.name}, ${p.state}. ${kiln ? "Integrated plant (kiln)" : "Grinding unit"}.`}
          >
            {L.leader && (
              <line x1={x} y1={y} x2={lx + (L.anchor === "end" ? 3 : L.anchor === "start" ? -3 : 0)} y2={ly - 4}
                className="stroke-muted" strokeWidth={0.7} />
            )}
            {active && <circle cx={x} cy={y} r={r + 4} className="fill-none stroke-accent" strokeWidth={1.5} />}
            {kiln ? (
              <>
                <circle cx={x} cy={y} r={r + 0.9} className="fill-none stroke-surface" strokeWidth={1.5} />
                <circle cx={x} cy={y} r={r} className={`${c?.fill ?? "fill-ink2"} stroke-ink2`} strokeWidth={0.6} />
              </>
            ) : (
              <>
                <circle cx={x} cy={y} r={r - 1.2} className={`fill-surface ${c?.stroke ?? "stroke-ink2"}`} strokeWidth={2.4} />
                {/* hairline edges keep the pale Low band visible on the map fill */}
                <circle cx={x} cy={y} r={r} className="fill-none stroke-ink2" strokeWidth={0.5} />
                <circle cx={x} cy={y} r={r - 2.4} className="fill-none stroke-ink2" strokeWidth={0.5} />
              </>
            )}
            {!compact && (
              <>
                <text x={lx} y={ly} textAnchor={L.anchor}
                  className={`paint-stroke fill-ink stroke-bg text-micro tracking-normal ${active ? "font-semibold" : "font-medium"}`}
                  strokeWidth={3} strokeLinejoin="round">
                  {p.short_name}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
    {hovered && !compact && (
      <HoverCard
        plant={hovered.p}
        now={exposureNow[hovered.p.id]}
        then={exposure2040[hovered.p.id]}
        colourLabel={colourLabel}
        hazards={hazardsByPlant[hovered.p.id] ?? []}
        left={(hovered.x / geometry.width) * 100}
        top={(hovered.y / geometry.height) * 100}
        supplies={edges.filter((e) => e.from_id === hovered.p.id).map((e) => `${nameOf(e.to_id)} (${num(e.clinker).toFixed(2)} Mt)`)}
        suppliedBy={edges.filter((e) => e.to_id === hovered.p.id).map((e) => `${nameOf(e.from_id)} (${num(e.clinker).toFixed(2)} Mt)`)}
      />
    )}
    </div>
  );
}

function HoverCard({ plant, now, then, colourLabel, hazards, left, top, supplies, suppliedBy }: {
  plant: Plant; now?: PlantExposure; then?: PlantExposure; colourLabel: string; hazards: Hazard[]; left: number; top: number; supplies: string[]; suppliedBy: string[];
}) {
  const cur = colourLabel === "2040" ? then : now;
  const flipX = left > 55; // keep the card inside the map panel
  const flipY = top > 60;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-[17rem] rounded-md border hairline bg-surface p-3 text-small shadow-lift"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(${flipX ? "calc(-100% - var(--hz-space-4))" : "var(--hz-space-4)"}, ${flipY ? "calc(-100% + var(--hz-space-4))" : "calc(-1 * var(--hz-space-4))"})`,
      }}
    >
      <p className="font-medium text-ink">{plant.name}</p>
      <p className="text-micro tracking-normal text-muted">
        {plant.town}, {plant.state} · {plant.type === "integrated" ? "Integrated plant (kiln)" : "Grinding unit"}
      </p>
      {cur && (
        <div className="mt-2 flex flex-col gap-1 rounded-sm bg-surface2 px-2 py-1 text-micro tracking-normal text-ink">
          <span className="tabular">Revenue at risk a year ({colourLabel === "2040" ? "2040" : "now"}): <b>{formatCr(cur.total_revenue_at_risk.value)}</b></span>
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-pill ${BAND_STYLE[cur.band].bg}`} aria-hidden />{cur.band} band
            <span className="tabular text-muted">· {formatPct(cur.pct_revenue.value, false)} of plant revenue</span>
          </span>
        </div>
      )}
      {hazards.length > 0 && (
        <p className="mt-1 text-micro tracking-normal text-ink2">Main hazards: {hazards.map((h) => HAZARD_LABEL[h].toLowerCase()).join(", ")}</p>
      )}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-micro tracking-normal">
        <dt className="text-muted">Revenue FY26</dt>
        <dd className="tabular flex items-center justify-between gap-2 text-ink">{formatCr(plant.revenue.value)}</dd>
        <dt className="text-muted">Asset value</dt>
        <dd className="tabular flex items-center justify-between gap-2 text-ink">{formatCr(plant.asset_value.value)}</dd>
        <dt className="text-muted">Water</dt>
        <dd className="text-ink">{plant.water_source}</dd>
        <dt className="text-muted">Coastal</dt>
        <dd className="text-ink">{plant.coastal ? "Yes" : "No"}</dd>
        {supplies.length > 0 && (<><dt className="text-muted">Supplies</dt><dd className="text-ink">{supplies.join(", ")}</dd></>)}
        {suppliedBy.length > 0 && (<><dt className="text-muted">Clinker from</dt><dd className="text-ink">{suppliedBy.join(", ")}</dd></>)}
      </dl>
      <p className="mt-2 text-micro tracking-normal text-accent">Click for plant detail →</p>
    </div>
  );
}
