"use client";
import Link from "next/link";
import type { StressResponse } from "@/lib/api";
import { formatCr0, formatPct } from "@/lib/format";
import { Prov } from "@/components/data/Prov";
import { tipProps } from "@/lib/tooltip";

/** Largest kiln dependency and what a 30-day outage there costs, own plant plus the grinding units it feeds. */
export function Concentration({ res, supplies }: { res: StressResponse | null; supplies: string[] }) {
  if (!res) return <Shell><div className="h-[10rem] animate-pulse rounded-md bg-border" /></Shell>;
  const total = res.total_lost_revenue.value ?? 0;
  const parts = [
    { id: res.plant_id, name: `${res.short_name} (kiln)`, v: res.own_lost_revenue, cls: "bg-accent" },
    ...res.children.map((c, i) => ({ id: c.plant_id, name: c.short_name, v: c.lost_revenue, cls: i === 0 ? "bg-series-slate" : "bg-series-aqua" })),
  ];
  return (
    <Shell>
      <p className="text-body text-ink2">
        <span className="font-semibold text-ink">{res.short_name}</span> is the only clinker source for {supplies.join(" and ")}. A{" "}
        {res.days}-day shutdown there puts
      </p>
      <p className="tabular flex items-baseline gap-2">
        <Prov v={res.total_lost_revenue} className="text-figure font-bold text-ink">{formatCr0(total)}</Prov>
        <span className="text-small text-ink2">of revenue at risk across {parts.length} plants</span>
      </p>
      <p className="text-micro tracking-normal text-muted">
        <Prov v={res.pct_company_revenue}>{formatPct(res.pct_company_revenue.value, false)}</Prov> of company revenue. Grinding units keep running for{" "}
        <Prov v={res.buffer_days}>{res.buffer_days.value} days</Prov> on stored clinker, then stop.
      </p>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-sm" role="img" aria-label={parts.map((p) => `${p.name} ${formatCr0(p.v.value)}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.id} className={`h-full ${p.cls}`} style={{ width: `${(100 * (p.v.value ?? 0)) / (total || 1)}%` }} {...tipProps(`${p.name}: ${formatCr0(p.v.value)}`)} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-micro tracking-normal text-ink2">
        {parts.map((p) => (
          <li key={p.id} className="inline-flex items-center gap-1">
            <span aria-hidden className={`inline-block size-2 rounded-pill ${p.cls}`} />{p.name} <Prov v={p.v} className="tabular text-ink">{formatCr0(p.v.value)}</Prov>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1 border-t hairline pt-3 text-small text-ink2">
        {res.children.map((c) => (
          <li key={c.plant_id}>
            <span className="font-medium text-ink">{c.short_name}</span>{" "}
            {c.covered_by_buffer ? "rides it out on stored clinker." : <>stops on day <span className="tabular">{c.stops_on_day}</span> and loses <span className="tabular">{c.lost_days.value}</span> days of output.</>}
          </li>
        ))}
      </ul>
      <Link href="/network" className="mt-auto text-small font-medium text-accent hover:underline">Run a stress test on the network →</Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="conc-h" data-tour="concentration" className="flex h-full flex-col gap-3 rounded-lg border border-border-strong bg-surface p-5 shadow-card">
      <h2 id="conc-h" className="text-h3 font-semibold text-ink">Concentration</h2>
      {children}
    </section>
  );
}
