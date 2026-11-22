"use client";
import Link from "next/link";
import type { RangeSensitivityResponse } from "@/lib/api";
import { formatCr0 } from "@/lib/format";
import { tipProps } from "@/lib/tooltip";
import { HazardIcon, type Hazard } from "@/components/data/HazardIcon";

const HAZARD_OF_GROUP: Record<string, Hazard | null> = {
  Heat: "heat", "Water stress": "water", "Riverine flood": "flood", "Coastal flood / cyclone": "coastal",
};
const GROUP_NAME: Record<string, string> = {
  Heat: "Heat", "Water stress": "Water stress", "Riverine flood": "River flood", "Coastal flood / cyclone": "Coastal flood",
  "Clinker network": "Clinker supply", General: "General",
};
/** Short, plain description of what each assumption sets (falls back to its full label). */
const PLAIN: Record<string, string> = {
  curtail_days_extremely_high: "Days cut back where stress is extremely high",
  curtail_days_high: "Days cut back where stress is high",
  curtail_days_medium_high: "Days cut back where stress is medium-high",
  curtail_days_low_medium: "Days cut back where stress is low-medium",
  source_factor_groundwater: "Extra impact on groundwater plants",
  source_factor_river: "Extra impact on river-fed plants",
  source_factor_canal: "Extra impact on canal-fed plants",
  source_factor_desalinated: "Extra impact on seawater plants",
  heat_loss_per_day_integrated: "Output lost on each very hot day (kilns)",
  heat_loss_per_day_grinding: "Output lost on each very hot day (grinding)",
  flood_downtime_days: "Days stopped by each flood",
  operating_days: "Working days in a year",
  clinker_buffer_days: "Days of clinker stock at grinding units",
};
const plain = (id: string, label: string) => PLAIN[id] ?? label;

/** Tornado: how far the 2040 total moves when one assumption goes from its min to its max (others at Central). */
export function Tornado({ data, top = 5 }: { data: RangeSensitivityResponse | null; top?: number }) {
  return (
    <section aria-labelledby="tor-h" data-tour="tornado" className="flex h-full flex-col gap-3 rounded-lg border border-border-strong bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tor-h" className="text-h3 font-semibold text-ink">Which assumptions move the answer</h2>
        <span className="inline-flex items-center gap-3 text-micro tracking-normal text-ink2">
          <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block size-2 rounded-sm bg-chart-low" />Set low</span>
          <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block size-2 rounded-sm bg-chart-high" />Set high</span>
        </span>
      </div>
      {!data ? <div className="h-[10rem] animate-pulse rounded-md bg-border" /> : <Bars data={data} top={top} />}
    </section>
  );
}

function Bars({ data, top }: { data: RangeSensitivityResponse; top: number }) {
  const rows = data.rows.slice(0, top);
  const c = data.central_total;
  const lo = Math.min(c, ...rows.map((r) => Math.min(r.total_at_min, r.total_at_max)));
  const hi = Math.max(c, ...rows.map((r) => Math.max(r.total_at_min, r.total_at_max)));
  const pad = (hi - lo) * 0.02;
  const x = (v: number) => `${(100 * (v - lo + pad)) / (hi - lo + 2 * pad)}%`;
  const seg = (a: number, b: number) => ({ left: x(Math.min(a, b)), width: `calc(${x(Math.max(a, b))} - ${x(Math.min(a, b))})` });
  return (
    <>
      <div className="relative flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3">
            <Link href={`/methodology#${r.id}`} className="group min-w-0 leading-tight">
              <span className="flex items-center gap-1 text-small font-medium text-ink group-hover:text-accent">
                {HAZARD_OF_GROUP[r.group] && <HazardIcon hazard={HAZARD_OF_GROUP[r.group] as Hazard} size={12} />}
                {GROUP_NAME[r.group] ?? r.group}
              </span>
              <span className="line-clamp-2 text-micro tracking-normal text-muted">{plain(r.id, r.label)}</span>
            </Link>
            <div className="relative h-6" {...tipProps(`${GROUP_NAME[r.group] ?? r.group}: ${plain(r.id, r.label).toLowerCase()}\nSet low: ${formatCr0(r.total_at_min)} · set high: ${formatCr0(r.total_at_max)}`)}>
              <span aria-hidden className="absolute top-1 bottom-1 rounded-l-sm bg-chart-low" style={seg(c, r.total_at_min)} />
              <span aria-hidden className="absolute top-1 bottom-1 rounded-r-sm bg-chart-high" style={seg(c, r.total_at_max)} />
              <span className="tabular absolute top-1/2 -translate-y-1/2 pr-1 text-micro tracking-normal text-ink2" style={{ right: `calc(100% - ${x(Math.min(r.total_at_min, r.total_at_max))})` }}>{Math.round(Math.min(r.total_at_min, r.total_at_max))}</span>
              <span className="tabular absolute top-1/2 -translate-y-1/2 pl-1 text-micro tracking-normal text-ink2" style={{ left: x(Math.max(r.total_at_min, r.total_at_max)) }}>{Math.round(Math.max(r.total_at_min, r.total_at_max))}</span>
            </div>
          </div>
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-[calc(min(11rem,40%)+var(--hz-space-3))]">
          <span className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-ink" style={{ left: x(c) }} />
        </div>
      </div>
      <p className="text-micro tracking-normal text-muted">
        2040 revenue at risk, ₹ crore a year. The line is the official figure, <span className="tabular">{formatCr0(c)}</span>.
        Each bar shows how far one assumption can move it. Click one to change it.
      </p>
    </>
  );
}
