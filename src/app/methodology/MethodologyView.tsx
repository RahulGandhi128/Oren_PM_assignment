"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAssumptionValue } from "@/lib/assumptions";
import { ProvenanceChip } from "@/components/data/ProvenanceChip";
import { DownloadDataButton } from "@/components/data/DownloadData";
import { AssumptionsEditor } from "./AssumptionsEditor";

export function MethodologyView() {
  return (
    <div className="flex flex-col gap-9">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <p className="text-micro uppercase text-muted">Methodology</p>
            <h1 className="max-w-[30ch] font-display text-h1">Climate risk has two parts; v1 measures physical risk.</h1>
            <p className="max-w-[70ch] text-body text-ink2">
              Real climate data plus labelled assumptions gives ₹ of physical risk, now and in 2040. Every step is here, and every assumption can be changed.
            </p>
          </div>
          <DownloadDataButton />
        </div>
        <div data-tour="risk-parts" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div id="physical-risk" className="flex flex-col gap-2 rounded-lg border-l-4 border border-accent bg-surface p-4 shadow-card">
            <p className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink">Physical risk</span>
              <span className="rounded-pill bg-accent px-2 py-[0.125rem] text-micro uppercase text-surface">Measured in v1</span>
            </p>
            <p className="text-small text-ink2">
              Loss from the climate itself: extreme heat, water stress, river floods and coastal events at the nine plants, and the
              knock-on effect when a kiln stops. Every number in this app, and everything below, is physical risk.
            </p>
          </div>
          <div id="transition-risk" className="flex scroll-mt-9 flex-col gap-2 rounded-lg border border-dashed border-border-strong bg-surface p-4">
            <p className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink">Transition risk</span>
              <span className="rounded-pill border border-border-strong px-2 py-[0.125rem] text-micro uppercase text-muted">Not measured in v1</span>
            </p>
            <p className="text-small text-ink2">
              Cost of the move to a low-carbon economy. For cement the main one is India&apos;s Carbon Credit Trading Scheme, which sets
              emission-intensity targets; missing them costs money. The plant register has each plant&apos;s current emissions, but measuring
              the cost also needs the notified target for each plant and a credit-price path, which the brief does not supply. It is the
              first candidate for v2; candidate sources are on the <Link href="/data" className="text-accent hover:underline">Data page</Link>.
            </p>
          </div>
        </div>
      </header>
      <Coverage />
      <HowItWorks />
      <Sources />
      <AssumptionsEditor />
      <Glossary />
    </div>
  );
}

/* ------------------------------------------------------------------ 1. How it works */

function A({ id, unit }: { id: string; unit?: string }) {
  const v = useAssumptionValue(id);
  return (
    <a href={`#${id}`} className="tabular inline-flex items-center gap-1 whitespace-nowrap border-b border-dashed border-prov-assumption text-ink hover:text-accent">
      {v ?? "…"}{unit ? ` ${unit}` : ""}
    </a>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: 1, title: "Hazard", kind: "data" as const, sources: ["openmeteo_climate", "aqueduct40"],
      body: <>What the climate does at each plant: days a year at or above 40 °C, the wettest day of the year, the basin&apos;s water-stress score, and river and coastal flood scores. Today and 2040. These come from Open-Meteo and WRI Aqueduct, so they are real data.</>,
    },
    {
      n: 2, title: "Disruption", kind: "assumption" as const, sources: [],
      body: <>What that does to operations. Each very hot day costs <A id="heat_loss_per_day_integrated" /> of a day&apos;s output at a kiln. High water stress means <A id="curtail_days_high" unit="days" /> of reduced running a year. A flood shuts a plant for <A id="flood_downtime_days" unit="days" />, with a small chance each year set by its flood score. These are our assumptions, and you can change them below.</>,
    },
    {
      n: 3, title: "Money", kind: "derived" as const, sources: ["plants_csv"],
      body: <>Lost days × revenue per day (revenue ÷ <A id="operating_days" /> operating days) = revenue at risk. Chance of a flood or cyclone × share of assets damaged × asset value = expected asset damage. Both are calculated, a year at a time.</>,
    },
    {
      n: 4, title: "Knock-on", kind: "derived" as const, sources: ["plants_csv"],
      body: <>Who else is hit. If a kiln floods for longer than its grinding units&apos; clinker stock lasts (<A id="buffer_days" unit="days" />), they stop too. Their lost revenue is added as inherited exposure. Heat and water losses are not passed on: kilns can catch up within the year.</>,
    },
  ];
  return (
    <section aria-labelledby="how" className="flex flex-col gap-4">
      <h2 id="how" className="font-display text-h2">How it works</h2>
      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.n} className="relative flex flex-col gap-2 rounded-lg border hairline bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <span className="text-micro uppercase text-muted">Step {s.n}</span>
              <ProvenanceChip kind={s.kind} sources={s.sources} />
            </div>
            <h3 className="font-display text-h3 text-ink">{s.title}</h3>
            <p className="text-small text-ink2">{s.body}</p>
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-h3 text-muted lg:-right-3 lg:bottom-auto lg:left-auto lg:top-1/2 lg:translate-x-0 lg:-translate-y-1/2">
                <span className="lg:hidden">↓</span><span className="hidden lg:inline">→</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="text-small text-muted">
        Per plant and hazard, expected annual loss = revenue at risk + expected asset damage. Plants are banded by revenue at risk as a share of their own revenue.
        Dashed figures are assumptions; click one to edit it.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ 2. Data sources */

type Src = { id: string; name: string; used_for: string; resolution?: string; version?: string; accessed?: string; url?: string | null; licence?: string };

function Sources() {
  const [rows, setRows] = useState<Src[] | null>(null);
  useEffect(() => { api.sources().then((d) => setRows(d.sources as unknown as Src[])).catch(() => setRows([])); }, []);
  return (
    <section id="sources" aria-labelledby="sources-h" className="flex scroll-mt-9 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sources-h" className="font-display text-h2">Data sources</h2>
        <Link href="/data" className="text-small text-accent underline-offset-4 hover:underline">Developer detail: requests, samples, files →</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border hairline bg-surface shadow-card">
        <table className="w-full text-small">
          <thead className="border-b hairline bg-surface2 text-left text-micro uppercase text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Source</th>
              <th scope="col" className="px-3 py-2 font-medium">What we use it for</th>
              <th scope="col" className="px-3 py-2 font-medium">Resolution</th>
              <th scope="col" className="px-3 py-2 font-medium">Version</th>
              <th scope="col" className="px-3 py-2 font-medium">Downloaded</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((s) => (
              <tr key={s.id} className="border-b hairline align-top last:border-b-0">
                <td className="px-3 py-3">
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-accent">{s.name} ↗</a>
                    : <span className="font-medium text-ink">{s.name}</span>}
                  {s.licence && <div className="text-micro tracking-normal text-muted">{s.licence}</div>}
                </td>
                <td className="px-3 py-3 text-ink2">{s.used_for}</td>
                <td className="px-3 py-3 text-ink2">{s.resolution ?? "—"}</td>
                <td className="px-3 py-3 text-ink2">{s.version ?? "—"}</td>
                <td className="tabular whitespace-nowrap px-3 py-3 text-ink2">{s.accessed ?? "—"}</td>
              </tr>
            ))}
            {!rows && <tr><td colSpan={5} className="px-3 py-4"><div className="h-4 animate-pulse rounded-sm bg-border" /></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 5. Glossary */

function Glossary() {
  const terms: [string, string][] = [
    ["Expected annual loss", "The average loss a year once rare events are weighted by their chance: revenue at risk plus expected asset damage."],
    ["Revenue at risk", "Revenue lost in an average year because of downtime: lost days × revenue per day."],
    ["Expected asset damage", "Chance of a flood or coastal event in a year × share of assets damaged × asset value."],
    ["Water stress score", "WRI Aqueduct's 0–5 score for how much of a basin's renewable water is already withdrawn. 4–5 is Extremely High (more than 80%)."],
    ["Wettest day (Rx1day)", "The largest one-day rainfall in a year. A rise to 2040 raises the chance of river flooding."],
    ["Riverine / coastal flood score", "Aqueduct's 0–5 scores for the share of people exposed to river or coastal flooding in the basin. Used as a proxy for a plant's flood chance."],
    ["Clinker", "The intermediate product a kiln makes from limestone. Ground with gypsum and other materials, it becomes cement."],
    ["Integrated plant", "A plant with its own kiln that makes clinker and grinds it into cement."],
    ["Grinding unit", "A plant without a kiln. It grinds clinker shipped from an integrated plant, so it stops if that supply stops for longer than its stock lasts."],
    ["Clinker buffer", "Days of clinker stock a grinding unit holds."],
    ["Inherited exposure", "Revenue a grinding unit loses because its kiln is shut, counted at the grinding unit."],
    ["Risk band", "Low, Moderate, High or Severe, from a plant's revenue at risk as a share of its own revenue."],
    ["Today / 2040", "Averages over 2001–2020 and 2031–2050."],
  ];
  return (
    <section id="glossary" aria-labelledby="glo-h" className="flex scroll-mt-9 flex-col gap-4">
      <h2 id="glo-h" className="font-display text-h2">Glossary</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        {terms.map(([t, d]) => (
          <div key={t}>
            <dt className="text-small font-medium text-ink">{t}</dt>
            <dd className="text-small text-ink2">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}


/* ------------------------------------------------------------------ What physical risk covers in v1 */

type Cover = "yes" | "partial" | "no";
const COVER_BADGE: Record<Cover, { mark: string; label: string; cls: string }> = {
  yes:     { mark: "✓", label: "Covered",      cls: "border-delta-down-border bg-delta-down-bg text-delta-down-text" },
  partial: { mark: "◐", label: "Partly",       cls: "border-quality-warning bg-quality-warning-soft text-prov-assumption" },
  no:      { mark: "✕", label: "Not in v1",    cls: "border-border-strong bg-surface2 text-muted" },
};

function Coverage() {
  const rows: { area: string; cover: Cover; scope: string; measures: string }[] = [
    { area: "Operations", cover: "yes", scope: "Downtime",
      measures: "Revenue at risk a year from heat, water stress, river floods and coastal events, including grinding units that stop when their kiln floods." },
    { area: "Assets", cover: "yes", scope: "Acute damage",
      measures: "Expected flood and coastal damage a year, and the value of assets at plants whose own location is rated High for river or coastal flooding." },
    { area: "People", cover: "partial", scope: "Heat exposure only",
      measures: "Worker heat-days: employees × days a year at or above 40 °C. Health outcomes, productivity and safety incidents are not modelled." },
    { area: "Costs, insurance, valuation", cover: "no", scope: "Not measured",
      measures: "No cost, insurance or balance-sheet effects. See the list below." },
  ];
  const notIn = [
    ["Insurance", "Premiums, cover limits, deductibles and what would be recovered after a loss."],
    ["Repair and energy costs", "Repair bills after an event, and extra cooling, power or trucked water during heat and drought."],
    ["Impairment", "Write-downs of plant value, or effects on valuation, from rising climate risk."],
    ["Health costs", "Medical, absence and compensation costs from heat stress on workers."],
  ];
  return (
    <section id="coverage" aria-labelledby="cov-h" data-tour="coverage" className="flex scroll-mt-9 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="cov-h" className="font-display text-h2">What physical risk covers in v1</h2>
        <p className="max-w-[75ch] text-small text-ink2">
          Four separate measures across operations, assets and people. They are reported side by side and never added into one total.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border hairline bg-surface shadow-card">
        <table className="w-full text-small">
          <thead className="border-b hairline text-left text-micro uppercase text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Area</th>
              <th scope="col" className="px-4 py-3 font-medium">In v1</th>
              <th scope="col" className="px-4 py-3 font-medium">What is measured</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = COVER_BADGE[r.cover];
              return (
                <tr key={r.area} className="border-b hairline align-top last:border-b-0">
                  <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-ink">{r.area}</th>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-pill border px-2 py-[0.125rem] text-micro font-medium ${b.cls}`}>
                      <span aria-hidden>{b.mark}</span> {r.scope}
                      <span className="sr-only"> ({b.label})</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink2">{r.measures}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-h3 font-medium text-ink">Not in v1</h3>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          {notIn.map(([t, d]) => (
            <li key={t} className="flex gap-3 border-t hairline pt-3">
              <span aria-hidden className="mt-[0.125rem] text-muted">✕</span>
              <span className="flex flex-col">
                <span className="font-medium text-ink">{t}</span>
                <span className="text-small text-ink2">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
