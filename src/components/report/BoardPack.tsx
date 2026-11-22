"use client";
// The Report: one A4 page for board papers. Hidden on screen; rendered on request from the ⋯ menu, then printed
// (Print → Save as PDF gives the PDF). Greyscale-safe: bands are written out, colour is never the only cue.
import { useEffect, useState } from "react";
import { api, type ExposureResponse, type SummaryResponse } from "@/lib/api";
import { useBoardPack } from "@/lib/boardPack";
import { formatCount, formatCr0, formatPct } from "@/lib/format";
import { useOverrides } from "@/lib/store";

type Data = { s: SummaryResponse; ex: ExposureResponse; at: Date };
const WORD: Record<string, string> = { heat: "extreme heat", water: "water stress", flood: "river flooding", coastal: "coastal flooding" };
const HAZ_COLS = [["heat", "Heat"], ["water", "Water stress"], ["flood", "River flood"], ["coastal", "Coastal"]] as const;
const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function BoardPack() {
  const requested = useBoardPack((s) => s.requested);
  const overrides = useOverrides();
  const [data, setData] = useState<Data | null>(null);

  // Fetch fresh numbers for the assumptions in use, then print once the page has rendered.
  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    Promise.all([api.summary(overrides), api.exposure("2040", overrides)]).then(([s, ex]) => {
      if (!cancelled) setData({ s, ex, at: new Date() });
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new request should trigger a print
  }, [requested]);

  useEffect(() => {
    if (!data) return;
    const done = () => { document.body.classList.remove("print-board-pack"); window.removeEventListener("afterprint", done); };
    document.body.classList.add("print-board-pack");
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 50);
    return () => { clearTimeout(t); done(); };
  }, [data]);

  return <div id="board-pack">{data && <Sheet d={data} />}</div>;
}

function Sheet({ d }: { d: Data }) {
  const { s, ex } = d;
  const now = s.today, fut = s.future;
  const top = Object.entries(fut.by_hazard).sort((a, b) => (b[1].value ?? 0) - (a[1].value ?? 0)).slice(0, 2).map(([k]) => WORD[k] ?? k).join(" and ");
  const findings = s.findings.filter((f) => f.href !== "/").slice(0, 3);
  const plants = [...ex.plants].sort((a, b) => (b.total_revenue_at_risk.value ?? 0) - (a.total_revenue_at_risk.value ?? 0));
  const r = s.preset_range;

  const measures: [string, string, string][] = [
    ["Operations · revenue at risk a year", `${formatCr0(now.revenue_at_risk.value)} (${formatPct(now.pct_revenue.value, false)} of revenue)`, `${formatCr0(fut.revenue_at_risk.value)} (${formatPct(fut.pct_revenue.value, false)})`],
    ["Assets · expected damage a year", formatCr0(now.asset_damage.value), formatCr0(fut.asset_damage.value)],
    ["Assets in high-risk flood locations", `${formatCr0(now.assets_in_high_risk_locations.value)} (${formatPct(now.assets_in_high_risk_share.value, false)} of assets)`,
      `${formatCr0(fut.assets_in_high_risk_locations.value)} (${formatPct(fut.assets_in_high_risk_share.value, false)})`],
    ["People · worker heat-days a year", formatCount(now.worker_heat_days.value), formatCount(fut.worker_heat_days.value)],
  ];

  return (
    <article className="flex flex-col gap-4 text-ink" style={{ width: "calc(var(--hz-layout-a4-width) - 2 * var(--hz-layout-a4-margin))" }}>
      <header className="flex items-start justify-between gap-4 border-b border-ink pb-3">
        <div className="flex flex-col gap-1">
          <p className="text-micro uppercase text-ink2">Nimbus Cement · generated {when.format(d.at)}</p>
          <h1 className="font-display text-h1 leading-tight">Physical climate risk exposure</h1>
          <p className="text-small text-ink2">Physical risk only · transition risk not yet included</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- print-only, static asset */}
        <img src="/brand/oren-logo.png" alt="Oren" className="h-[2rem] w-auto" />
      </header>

      <p className="font-serif text-h1 leading-snug">
        Physical climate risk puts {formatCr0(fut.revenue_at_risk.value)} a year of revenue at risk by 2040,
        {" "}{formatPct(fut.pct_revenue.value, false)} of revenue, mostly from {top}. Today the figure is {formatCr0(now.revenue_at_risk.value)}.
      </p>

      <section className="flex flex-col gap-1">
        <h2 className="text-small font-semibold">Four measures of physical risk</h2>
        <table className="w-full border-collapse text-small">
          <thead>
            <tr className="border-b border-ink text-left text-micro uppercase text-ink2">
              <th className="py-1 pr-3 font-medium">Measure</th><th className="py-1 pr-3 font-medium">Now (2001–2020 climate)</th><th className="py-1 font-medium">2040 (2031–2050 climate)</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {measures.map(([m, a, b]) => (
              <tr key={m} className="border-b border-border-strong">
                <td className="whitespace-nowrap py-1 pr-3">{m}</td><td className="whitespace-nowrap py-1 pr-3">{a}</td>
                <td className="py-1">{b}{m.startsWith("Assets in high-risk") && <span className="text-micro tracking-normal text-ink2"> · no 2040 flood rating</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-micro tracking-normal text-ink2">
          Separate measures, not added together. Plausible range for 2040 revenue at risk: {formatCr0(r.conservative["2040"].value)} (Conservative) to {formatCr0(r.severe["2040"].value)} (Severe).
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-small font-semibold">Plants in 2040 · revenue at risk a year, ₹ crore</h2>
        <table className="w-full border-collapse text-micro tracking-normal">
          <thead>
            <tr className="border-b border-ink text-left uppercase text-ink2">
              <th className="py-1 pr-2 font-medium">Plant</th>
              {HAZ_COLS.map(([, l]) => <th key={l} className="py-1 pr-2 text-right font-medium">{l}</th>)}
              <th className="py-1 pr-2 text-right font-medium">From kiln</th>
              <th className="py-1 pr-2 text-right font-medium">Total</th>
              <th className="py-1 pr-2 text-right font-medium">% revenue</th>
              <th className="py-1 pr-2 font-medium">Band</th>
              <th className="py-1 font-medium">Flood location</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {plants.map((p) => (
              <tr key={p.plant_id} className="border-b border-border-strong">
                <td className="whitespace-nowrap py-[0.15rem] pr-2">{p.short_name} <span className="text-ink2">· {p.type === "integrated" ? "kiln" : "grinding"}</span></td>
                {HAZ_COLS.map(([k]) => <td key={k} className="py-[0.15rem] pr-2 text-right">{(p.hazards[k]?.revenue_at_risk.value ?? 0).toFixed(1)}</td>)}
                <td className="py-[0.15rem] pr-2 text-right">{(p.inherited_revenue_at_risk.value ?? 0).toFixed(1)}</td>
                <td className="py-[0.15rem] pr-2 text-right font-semibold">{(p.total_revenue_at_risk.value ?? 0).toFixed(1)}</td>
                <td className="py-[0.15rem] pr-2 text-right">{formatPct(p.pct_revenue.value, false)}</td>
                <td className="py-[0.15rem] pr-2">{p.band}</td>
                <td className="py-[0.15rem]">{p.assets_people.high_risk_location ? "High" : "—"}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1 pr-2">All plants</td>
              {HAZ_COLS.map(([k]) => <td key={k} className="py-1 pr-2 text-right">{(ex.plants.reduce((a, p) => a + (p.hazards[k]?.revenue_at_risk.value ?? 0), 0)).toFixed(1)}</td>)}
              <td className="py-1 pr-2 text-right">{(ex.company.inherited.value ?? 0).toFixed(1)}</td>
              <td className="py-1 pr-2 text-right">{(ex.company.revenue_at_risk.value ?? 0).toFixed(1)}</td>
              <td className="py-1 pr-2 text-right">{formatPct(ex.company.pct_revenue.value, false)}</td>
              <td className="py-1 pr-2" colSpan={2}>{ex.company.plants_high_or_severe} of {ex.company.plant_count} High or Severe</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-small font-semibold">Key findings</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-small">
          {findings.map((f) => <li key={f.kicker}><span className="font-semibold">{f.kicker}.</span> {f.text}</li>)}
        </ol>
      </section>

      <footer className="flex flex-col gap-1 border-t border-ink pt-2 text-micro tracking-normal text-ink2">
        <p>
          <span className="font-semibold text-ink">Method.</span> Climate: median of 7 climate models, {s.scenario_label}, averaged over
          {" "}{s.windows.today.join("–")} (now) and {s.windows["2040"].join("–")} (2040). Water stress and flood ratings: WRI Aqueduct 4.0;
          2040 water stress is the midpoint of 2030 and 2050. Each hazard becomes lost days through labelled assumptions; revenue at risk = lost days × revenue per day;
          asset damage = chance of a flood or coastal event × share damaged × asset value. Revenue, not profit.
        </p>
        <p><span className="font-semibold text-ink">Not included.</span> Transition risk, insurance, repair and energy costs, impairment, health costs.</p>
      </footer>
    </article>
  );
}
