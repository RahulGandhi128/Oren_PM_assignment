"use client";
import Link from "next/link";
import type { SummaryResponse } from "@/lib/api";
import { formatCr0, formatPct } from "@/lib/format";
import type { When } from "@/lib/when";
import { Prov } from "@/components/data/Prov";

/** "Climate exposure": physical risk (measured, selected year) next to transition risk (not measured in v1). */
export function ExposureStrip({ s, when }: { s: SummaryResponse; when: When }) {
  const cur = when === "2040" ? s.future : s.today;
  const win = when === "2040" ? s.windows["2040"] : s.windows.today;
  return (
    <section aria-labelledby="exp-h" data-tour="exposure-strip" className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface p-4 shadow-card md:flex-row md:items-stretch md:gap-5">
      <div className="flex shrink-0 flex-col justify-center gap-1 md:w-[11rem]">
        <h2 id="exp-h" className="text-micro uppercase text-muted">Climate exposure</h2>
        <p className="text-small text-ink2">Nimbus Cement · {cur.plant_count} plants</p>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-md border-l-4 border-accent bg-surface2 px-4 py-3">
          <span className="text-small font-medium text-ink">Physical risk</span>
          <span className="tabular text-h2 font-semibold text-ink">
            <Prov v={cur.revenue_at_risk}>{formatCr0(cur.revenue_at_risk.value)}</Prov>
            <span className="text-small font-normal text-ink2"> revenue at risk a year {when === "2040" ? "in 2040" : "now"} · <Prov v={cur.pct_revenue}>{formatPct(cur.pct_revenue.value, false)}</Prov> of revenue</span>
          </span>
          <span className="text-micro tracking-normal text-muted">Plus assets and people, below · {win[0]}–{win[1]} average climate</span>
        </div>
        <Link href="/methodology#transition-risk"
          className="group flex flex-col gap-1 rounded-md border border-dashed border-border-strong px-4 py-3 transition-colors hover:border-ink2">
          <span className="text-small font-medium text-muted">Transition risk</span>
          <span className="text-h2 font-semibold text-muted">Not measured in v1</span>
          <span className="text-micro tracking-normal text-muted">
            Carbon-market and policy costs · <span className="text-accent group-hover:underline">What&apos;s missing →</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
