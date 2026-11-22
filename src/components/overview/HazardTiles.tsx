"use client";
import type { SummaryResponse } from "@/lib/api";
import type { Both } from "@/lib/exposure";
import type { When } from "@/lib/when";
import { formatCr0 } from "@/lib/format";
import { HazardIcon, type Hazard } from "@/components/data/HazardIcon";
import { Prov } from "@/components/data/Prov";
import { tipProps } from "@/lib/tooltip";

const HAZARDS: { key: Hazard; label: string; bg: string }[] = [
  { key: "heat", label: "Extreme heat", bg: "bg-hazard-heat" },
  { key: "water", label: "Water stress", bg: "bg-hazard-water" },
  { key: "flood", label: "River flood", bg: "bg-hazard-flood" },
  { key: "coastal", label: "Coastal flood / cyclone", bg: "bg-hazard-coastal" },
];

/** One tile per hazard for the selected year: company ₹ at risk, its share of the total, and the plant that carries most of it. */
export function HazardTiles({ s, ex, when }: { s: SummaryResponse; ex: Both; when: When }) {
  const totals = when === "2040" ? s.future : s.today;
  const plants = (when === "2040" ? ex.y2040 : ex.now).plants;
  const yr = when === "2040" ? "in 2040" : "now";
  const total = totals.revenue_at_risk.value ?? 0;

  return (
    <section aria-label="By hazard" data-tour="hazards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {HAZARDS.map((h) => {
        const v = totals.by_hazard[h.key];
        const val = v?.value ?? 0;
        const share = total > 0 ? (100 * val) / total : 0;
        const top = [...plants].sort((p, q) => (q.hazards[h.key]?.revenue_at_risk.value ?? 0) - (p.hazards[h.key]?.revenue_at_risk.value ?? 0))[0];
        const topV = top?.hazards[h.key]?.revenue_at_risk.value ?? 0;
        return (
          <article key={h.key} className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface p-4 shadow-card">
            <h3 className="flex items-center gap-2 text-small font-semibold text-ink"><HazardIcon hazard={h.key} size={14} />{h.label}</h3>
            <p className="tabular"><Prov v={v} className="text-figure font-bold text-ink">{formatCr0(val)}</Prov></p>
            <div className="h-2 w-full overflow-hidden rounded-pill bg-chart-grid" {...tipProps(`${h.label}: ${Math.round(share)}% of company revenue at risk ${yr}`)}>
              <div className={`h-full rounded-pill ${h.bg}`} style={{ width: `${share}%` }} />
            </div>
            <p className="text-micro tracking-normal text-muted">{Math.round(share)}% of the total {yr}</p>
            <p className="border-t hairline pt-2 text-small text-ink2">
              {topV > 0.05 && top ? <>Most at <span className="font-medium text-ink">{top.short_name}</span> · <Prov v={top.hazards[h.key]?.revenue_at_risk} className="tabular">{formatCr0(topV)}</Prov></> : "No plant materially exposed"}
            </p>
          </article>
        );
      })}
    </section>
  );
}
