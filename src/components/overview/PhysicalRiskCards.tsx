"use client";
import type { SummaryResponse } from "@/lib/api";
import { formatCount, formatCr0, formatPct } from "@/lib/format";
import type { When } from "@/lib/when";
import { Prov } from "@/components/data/Prov";

type Card = { kicker: string; title: string; figure: React.ReactNode; sub: React.ReactNode; note?: string };

/** The four physical-risk measures for the selected year. Separate measures: never summed. */
export function PhysicalRiskCards({ s, when }: { s: SummaryResponse; when: When }) {
  const c = when === "2040" ? s.future : s.today;
  const yr = when === "2040" ? "in 2040" : "now";
  const damageShare = c.gross_block.value ? (100 * (c.asset_damage.value ?? 0)) / c.gross_block.value : null;

  const cards: Card[] = [
    {
      kicker: "Operations", title: "Revenue at risk a year",
      figure: <Prov v={c.revenue_at_risk}>{formatCr0(c.revenue_at_risk.value)}</Prov>,
      sub: <><Prov v={c.pct_revenue}>{formatPct(c.pct_revenue.value, false)}</Prov> of revenue · downtime from all four hazards</>,
    },
    {
      kicker: "Assets", title: "Expected damage a year",
      figure: <Prov v={c.asset_damage}>{formatCr0(c.asset_damage.value)}</Prov>,
      sub: <>{damageShare != null ? `${damageShare < 0.1 ? damageShare.toFixed(2) : damageShare.toFixed(1)}% of gross block` : ""} · river and coastal floods</>,
    },
    {
      kicker: "Assets", title: "In high-risk locations",
      figure: <Prov v={c.assets_in_high_risk_locations}>{formatCr0(c.assets_in_high_risk_locations.value)}</Prov>,
      sub: <><Prov v={c.assets_in_high_risk_share}>{formatPct(c.assets_in_high_risk_share.value, false)}</Prov> of gross block · {c.plants_in_high_risk_locations} of {c.plant_count} plants rated High for flooding</>,
      note: when === "2040" ? "Flood ratings exist for today only, so 2040 is the same." : undefined,
    },
    {
      kicker: "People", title: "Worker heat-days a year",
      figure: <Prov v={c.worker_heat_days}>{formatCount(c.worker_heat_days.value)}</Prov>,
      sub: <>{formatCount(c.employees.value)} employees × days at or above 40 °C</>,
      note: "Exposure only, not health outcomes.",
    },
  ];

  return (
    <section aria-labelledby="pr-h" data-tour="physical-cards" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pr-h" className="text-h3 font-semibold text-ink">Physical risk <span className="font-normal text-muted">· {yr}</span></h2>
        <p className="text-micro tracking-normal text-muted">Four separate measures. They are not added together.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((k) => (
          <div key={k.title} className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface p-4 shadow-card">
            <p className="flex flex-col gap-[0.125rem]">
              <span className="text-micro uppercase text-muted">{k.kicker}</span>
              <span className="text-small font-medium text-ink">{k.title}</span>
            </p>
            <p className="tabular text-figure font-semibold text-ink">{k.figure}</p>
            <p className="tabular text-micro tracking-normal text-ink2">{k.sub}</p>
            {k.note && <p className="mt-auto text-micro tracking-normal text-muted">{k.note}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
