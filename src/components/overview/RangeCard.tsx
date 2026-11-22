"use client";
import type { SummaryResponse } from "@/lib/api";
import { formatCr0 } from "@/lib/format";
import { Prov } from "@/components/data/Prov";
import { tipProps } from "@/lib/tooltip";
import type { When } from "@/lib/when";

/** Company revenue at risk for the selected year: Conservative–Central–Severe on one bar. */
export function RangeCard({ s, custom, when }: { s: SummaryResponse; custom: boolean; when: When }) {
  const r = s.preset_range;
  const k = when === "2040" ? "2040" : "today";
  const yearLabel = when === "2040" ? "the 2040" : "today's";
  const lo = r.conservative[k].value ?? 0, mid = r.central[k].value ?? 0, hi = r.severe[k].value ?? 0;
  const yours = (when === "2040" ? s.future : s.today).revenue_at_risk.value ?? 0;
  const max = Math.max(hi, yours) * 1.06;
  const x = (v: number) => `${(100 * v) / max}%`;

  return (
    <section aria-labelledby="range-h" data-tour="range" className="flex flex-col gap-4 rounded-lg border border-border-strong bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="range-h" className="text-h3 font-semibold text-ink">How sure is {yearLabel} figure?</h2>
        <span className="text-micro tracking-normal text-muted">₹ crore a year</span>
      </div>
      <div className="relative mt-2 h-6" role="img"
        aria-label={`${when === "2040" ? "2040" : "Today's"} revenue at risk: Conservative ${formatCr0(lo)}, Central ${formatCr0(mid)}, Severe ${formatCr0(hi)}`}>
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-chart-grid" />
        <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-accent-soft ring-1 ring-border-strong" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
        {[["Conservative", lo], ["Severe", hi]].map(([label, v]) => (
          <span key={label as string} {...tipProps(`${label} preset: ${formatCr0(v as number)} a year ${when === "2040" ? "in 2040" : "now"}`)}
            className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-ink2" style={{ left: x(v as number) }} />
        ))}
        <span {...tipProps(`Central (official): ${formatCr0(mid)} a year ${when === "2040" ? "in 2040" : "now"}`)}
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-surface bg-accent" style={{ left: x(mid) }} />
        {custom && Math.abs(yours - mid) > 0.5 && (
          <span {...tipProps(`Your assumptions: ${formatCr0(yours)} a year ${when === "2040" ? "in 2040" : "now"}`)}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-surface bg-quality-warning" style={{ left: x(yours) }} />
        )}
      </div>
      <div className="relative h-[2.25rem] text-micro tracking-normal">
        <Lbl at={x(lo)} align="start" name="Conservative" v={<Prov v={r.conservative[k]}>{formatCr0(lo)}</Prov>} />
        <Lbl at={x(mid)} align="center" name="Central" v={<Prov v={r.central[k]}>{formatCr0(mid)}</Prov>} strong />
        <Lbl at={x(hi)} align="end" name="Severe" v={<Prov v={r.severe[k]}>{formatCr0(hi)}</Prov>} />
      </div>
    </section>
  );
}

function Lbl({ at, align, name, v, strong = false }: { at: string; align: "start" | "center" | "end"; name: string; v: React.ReactNode; strong?: boolean }) {
  const t = align === "start" ? "translateX(0)" : align === "end" ? "translateX(-100%)" : "translateX(-50%)";
  return (
    <span className={`absolute top-0 flex flex-col whitespace-nowrap ${align === "end" ? "items-end" : align === "center" ? "items-center" : "items-start"}`} style={{ left: at, transform: t }}>
      <span className={strong ? "font-semibold text-ink" : "text-muted"}>{name}</span>
      <span className={`tabular ${strong ? "font-semibold text-ink" : "text-ink2"}`}>{v}</span>
    </span>
  );
}
