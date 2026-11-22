"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { components } from "@/lib/api-types";
import type { Value } from "@/lib/api";
import { formatCount, formatCr, formatDays, formatInt, formatMt, formatNum1, formatPct } from "@/lib/format";
import { useIssues, worstSeverity } from "@/lib/issues";
import { useWhen } from "@/lib/when";
import { useExposureBoth } from "@/lib/exposure";
import { useOverrides } from "@/lib/store";
import { Prov } from "@/components/data/Prov";
import { HazardIcon } from "@/components/data/HazardIcon";
import { HeatSeries } from "@/components/charts/HeatSeries";

type Detail = components["schemas"]["PlantDetail"];

const ROW_TINT = { danger: "bg-quality-danger-soft", warning: "bg-quality-warning-soft", info: "" } as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-micro uppercase text-muted">{label}</dt>
      <dd className="flex items-center gap-2 text-body text-ink">{children}</dd>
    </div>
  );
}

const SCENARIO_LABEL = {
  optimistic: "Optimistic (SSP1-2.6)",
  business_as_usual: "Business-as-usual (SSP3-7.0)",
  pessimistic: "Pessimistic (SSP5-8.5)",
} as const;

function HazardCard({ hazard, title, figure, caption, v, children }: {
  hazard: "heat" | "water" | "flood" | "coastal"; title: string; figure: React.ReactNode; caption: string; v: Value; children?: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border hairline bg-surface p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-micro uppercase text-muted"><HazardIcon hazard={hazard} /> {title}</h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 font-display text-figure tabular"><Prov v={v} className="inline-flex flex-wrap items-baseline gap-x-2">{figure}</Prov></p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-ink2">
        {caption}
      </p>
      {children && <p className="mt-3 text-small text-ink2">{children}</p>}
    </article>
  );
}


export function PlantDetailView({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const issues = useIssues();
  const [when] = useWhen();
  const overrides = useOverrides();
  const { data: ex } = useExposureBoth();

  useEffect(() => {
    fetch(`/api/plants/${id}`)
      .then(async (r) => {
        if (r.status === 404) return setStatus("missing");
        if (!r.ok) return setStatus("error");
        setD(await r.json());
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  if (status === "missing")
    return (
      <section className="flex flex-col gap-4 py-8">
        <p className="text-micro uppercase text-muted">404</p>
        <h1 className="font-display text-h1">There is no plant {id}.</h1>
        <Link href="/plants" className="text-accent underline-offset-4 hover:underline">See all nine plants</Link>
      </section>
    );
  if (status === "error") return <p className="text-small text-quality-danger">Could not load plant {id}.</p>;
  if (!d) return <div className="flex flex-col gap-5"><div className="h-8 w-1/2 animate-pulse rounded-sm bg-border" /><div className="h-9 animate-pulse rounded-md bg-border" /></div>;

  const { plant: p, climate: c } = d;
  const placeholder = c.heat_days_40c_today.kind === "placeholder";
  const heat = when === "2040" ? c.heat_days_40c_2040 : c.heat_days_40c_today;
  const ws = when === "2040" ? c.water_stress_2040 : c.water_stress_today;
  const yrText = when === "2040" ? `2040 (${d.windows["2040"].join("–")} average)` : `now (${d.windows.today.join("–")} average)`;
  // Assets and people for the selected year: from the live engine run (honours changed assumptions),
  // falling back to the official set returned with the plant until it arrives.
  const live = (when === "2040" ? ex?.y2040 : ex?.now)?.plants.find((r) => r.plant_id === p.id)?.assets_people;
  const ap = live ?? d.assets_people[when === "2040" ? "2040" : "today"];
  const custom = Object.keys(overrides).length > 0;
  const sevOf = (flags: string[]) => worstSeverity(flags.map((f) => issues.get(f)).filter((i): i is NonNullable<typeof i> => Boolean(i)));

  return (
    <div className="flex flex-col gap-7">
      <Link href="/plants" className="text-small text-muted hover:text-ink">← All plants</Link>

      {/* 1. Header */}
      <header className="flex flex-col gap-3">
        <p className="text-micro uppercase text-muted">{p.id} · {p.type === "integrated" ? "Integrated plant (kiln)" : "Grinding unit"}</p>
        <h1 className="font-display text-h1">{p.name}</h1>
        <p className="text-body text-ink2">{p.town}, {p.state}{p.notes ? ` · ${p.notes}` : ""}</p>
        <dl className="mt-3 grid grid-cols-2 gap-5 rounded-lg border hairline bg-surface p-5 shadow-card sm:grid-cols-4 lg:grid-cols-7">
          <Fact label="Capacity"><Prov v={p.cement_capacity} className="tabular">{formatNum1(p.cement_capacity.value)} Mtpa</Prov></Fact>
          <Fact label="FY26 output"><Prov v={p.cement_output} className="tabular">{formatMt(p.cement_output.value)}</Prov></Fact>
          <Fact label="Revenue FY26"><Prov v={p.revenue} className="tabular">{formatCr(p.revenue.value)}</Prov></Fact>
          <Fact label="Asset value"><Prov v={p.asset_value} className="tabular">{formatCr(p.asset_value.value)}</Prov></Fact>
          <Fact label="Employees"><Prov v={p.employees} className="tabular">{formatInt(p.employees.value)}</Prov></Fact>
          <Fact label="Water source">{p.water_source}</Fact>
          <Fact label="Coastal">{p.coastal ? "Yes" : "No"}</Fact>
        </dl>
      </header>

      {/* 2. Assets and people */}
      <AssetsPeopleSection ap={ap} when={when} custom={custom && !live} />

      {/* 3. Climate signals */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-h2 font-medium">Climate signals</h2>
          <p className="text-micro tracking-normal text-muted">
            Climate models: {d.scenario_label} · Now = {d.windows.today.join("–")} · 2040 = {d.windows["2040"].join("–")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <HazardCard hazard="heat" title="Extreme heat"
            figure={<span className="text-ink">{formatDays(heat.value)}</span>}
            caption={`days a year at or above 40 °C, ${yrText}`}
            v={when === "2040" ? c.heat_days_40c_2040 : c.heat_days_40c_today}>
            {!placeholder && (
              <>Median of {c.per_model.length} climate models. The models range from{" "}
                <span className="tabular">{formatDays(heat.range?.[0] ?? null)}–{formatDays(heat.range?.[1] ?? null)}</span> days.
                On these days workers need rest cycles and equipment runs below rated output.</>
            )}
          </HazardCard>

          <HazardCard hazard="water" title="Water stress"
            figure={<span className="text-ink">{formatNum1(ws.value)}</span>}
            caption={`score out of 5: ${ws.label}, ${yrText}`}
            v={when === "2040" ? c.water_stress_2040 : c.water_stress_today}>
            How much of the basin&apos;s available water is already withdrawn (Aqueduct baseline water stress). The plant draws on{" "}
            <span className="font-medium text-ink">{p.water_source}</span>.{" "}
            {when === "2040" ? <>The 2040 value is the midpoint of Aqueduct&apos;s 2030 and 2050 values under {c.water_stress_scenario ?? "business-as-usual"}; other scenarios are in the table below.</>
              : <>This is Aqueduct&apos;s baseline (current) score.</>}
          </HazardCard>

          <HazardCard hazard="flood" title="Riverine flood"
            figure={<>{formatNum1(c.riverine_flood.value)}<span className="text-h2 text-muted"> / 5</span></>}
            caption={`Aqueduct riverine flood risk: ${c.riverine_flood.label ?? "—"}`}
            v={c.riverine_flood}>
            Current score from Aqueduct.
            {when === "2040" && (<>
              {" "}For 2040 the flood probability is scaled by the change in the wettest day of the year:{" "}
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <Prov v={c.rx1day_change_pct}>{formatPct(c.rx1day_change_pct.value)}</Prov>
              </span>
              {!placeholder && <> (median of models; models range {formatPct(c.rx1day_change_pct.range?.[0] ?? null)} to {formatPct(c.rx1day_change_pct.range?.[1] ?? null)}).</>}
            </>)}
          </HazardCard>

          <HazardCard hazard="coastal" title="Coastal flood / cyclone"
            figure={p.coastal ? <>{formatNum1(c.coastal_flood.value)}<span className="text-h2 text-muted"> / 5</span></> : <span className="text-muted">Not coastal</span>}
            caption={p.coastal ? `Aqueduct coastal flood risk: ${c.coastal_flood.label ?? "—"}` : "Applies only to plants marked coastal in the register"}
            v={c.coastal_flood}>
            {p.coastal
              ? "Current score from Aqueduct. For 2040 the probability is raised by an assumed uplift for sea-level rise and stronger cyclones (Phase 3)."
              : c.coastal_flood_aqueduct_score
                ? `Aqueduct gives this location a coastal flood score of ${formatNum1(c.coastal_flood_aqueduct_score)}, but the plant register marks it as not coastal, so it is not counted.`
                : "Inland plant; no coastal exposure."}
          </HazardCard>
        </div>

        {/* Water stress by scenario */}
        <div className="overflow-x-auto rounded-lg border hairline bg-surface shadow-card">
          <table className="w-full text-small">
            <caption className="px-3 pt-3 text-left text-micro uppercase text-muted">Water stress by Aqueduct scenario (score out of 5, two decimals so the category boundary is visible)</caption>
            <thead className="border-b hairline text-left text-micro uppercase text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Scenario</th>
                <th scope="col" className="px-3 py-2 font-medium">Now</th>
                <th scope="col" className="px-3 py-2 font-medium">2030</th>
                <th scope="col" className="px-3 py-2 font-medium">2040 (estimated)</th>
                <th scope="col" className="px-3 py-2 font-medium">2050</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {(["optimistic", "business_as_usual", "pessimistic"] as const).map((sc) => {
                const row = c.water_stress_by_scenario[sc] ?? {};
                const used = sc === "business_as_usual";
                return (
                  <tr key={sc} className={`border-b hairline last:border-b-0 ${used ? "bg-accent-soft" : ""}`}>
                    <td className="px-3 py-2">{SCENARIO_LABEL[sc]}{used && <span className="ml-2 text-micro uppercase text-accent">used for 2040</span>}</td>
                    <td className="px-3 py-2">{c.water_stress_today.value?.toFixed(2)} · {c.water_stress_today.label}</td>
                    {(["2030", "2040", "2050"] as const).map((y) => (
                      <td key={y} className="px-3 py-2">
                        {row[y] ? `${(row[y].score as number).toFixed(2)} · ${row[y].cat as string}` : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Heat time series */}
      {!placeholder && (
        <section className="flex flex-col gap-3 rounded-lg border hairline bg-surface p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-h3 font-medium">
            Days at or above 40 °C, 1980–2050
          </h2>
          <p className="text-small text-ink2">Line: median of the models. Band: lowest to highest model each year. Past years are model output, not measured weather.</p>
          <HeatSeries data={c.heat_series} windows={d.windows} />
        </section>
      )}

      {/* 5. Per-model table */}
      {!placeholder && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 font-medium">By climate model</h2>
          <p className="text-small text-ink2">Each model&apos;s own values, used as received. Flagged rows have an issue listed on the Issues &amp; notes page.</p>
          <div className="overflow-x-auto rounded-lg border hairline bg-surface shadow-card">
            <table className="w-full text-small">
              <thead className="border-b hairline bg-surface2 text-left text-micro uppercase text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Model</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Days ≥ 40 °C now</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">2040</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Wettest day now</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">2040</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Change</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Hottest day</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {c.per_model.map((m) => {
                  const sev = sevOf(m.flags);
                  return (
                    <tr key={m.model} className={`border-b hairline ${sev ? ROW_TINT[sev] : ""}`}>
                      <td className="px-3 py-2 font-mono text-small">{m.model}</td>
                      <td className="px-3 py-2 text-right">{formatDays(m.heat_days_40c_today)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatDays(m.heat_days_40c_2040)}
                        {m.years_used_2040 < 20 && <span className="text-muted"> ({m.years_used_2040} yrs)</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{formatNum1(m.rx1day_mm_today)} mm</td>
                      <td className="px-3 py-2 text-right">{formatNum1(m.rx1day_mm_2040)} mm</td>
                      <td className="px-3 py-2 text-right">{formatPct(m.rx1day_change_pct)}</td>
                      <td className={`px-3 py-2 text-right ${m.tmax_max_c > 55 ? "font-medium text-quality-danger" : ""}`}>{formatNum1(m.tmax_max_c)} °C</td>
                    </tr>
                  );
                })}
                <tr className="bg-surface2 font-medium">
                  <td className="px-3 py-2">Median of models</td>
                  <td className="px-3 py-2 text-right">{formatDays(c.heat_days_40c_today.value)}</td>
                  <td className="px-3 py-2 text-right">{formatDays(c.heat_days_40c_2040.value)}</td>
                  <td className="px-3 py-2 text-right">{formatNum1(c.rx1day_mm_today?.value ?? null)} mm</td>
                  <td className="px-3 py-2 text-right">{formatNum1(c.rx1day_mm_2040?.value ?? null)} mm</td>
                  <td className="px-3 py-2 text-right">{formatPct(c.rx1day_change_pct.value)}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 6. Dependencies */}
      <section className="flex flex-col gap-2">
        <h2 className="text-h3 font-medium">Clinker dependencies</h2>
        {d.supplies.length === 0 && d.supplied_by.length === 0 && (
          <p className="text-small text-ink2">Makes its own clinker and ships none to other Nimbus plants.</p>
        )}
        {d.supplies.map((l) => (
          <p key={l.plant_id} className="text-small text-ink2">
            Supplies <Link className="text-accent hover:underline" href={`/plants/${l.plant_id}`}>{l.short_name}</Link>{" "}
            {l.mode !== "unspecified" ? `by ${l.mode} ` : ""}(<Prov v={l.clinker} className="tabular">{formatMt(l.clinker.value)}</Prov> clinker a year)
          </p>
        ))}
        {d.supplied_by.map((l) => (
          <p key={l.plant_id} className="text-small text-ink2">
            Depends entirely on <Link className="text-accent hover:underline" href={`/plants/${l.plant_id}`}>{l.short_name}</Link> for
            clinker (<Prov v={l.clinker} className="tabular">{formatMt(l.clinker.value)}</Prov> a year{l.mode !== "unspecified" ? `, by ${l.mode}` : ""})
          </p>
        ))}
      </section>

      {/* 7. Inputs and sources */}
      <section className="flex flex-col gap-2">
        <h2 className="text-h3 font-medium">Inputs and sources</h2>
        <ul className="text-small text-ink2">
          <li>Plant facts: Nimbus plant register, <span className="font-mono">nimbus_cement_plants.csv</span> (FY2025-26).</li>
          <li>
            Climate: Open-Meteo Climate API, 7 CMIP6 HighResMIP models, daily 1950–2050, accessed 21 Nov 2026.
            {c.grid && <> Model grid cell: <span className="tabular">{String(c.grid.latitude)}°N, {String(c.grid.longitude)}°E, {String(c.grid.elevation_m)} m</span> (plant at {p.lat}°N, {p.lon}°E).</>}
          </li>
          <li>
            Water stress and flood: WRI Aqueduct 4.0 via the Water Risk Atlas point lookup, accessed 21 Nov 2026.
            {c.basin && <> Basin: {String(c.basin.major)} / {String(c.basin.minor)} (pfaf_id <span className="font-mono">{String(c.basin.pfaf_id)}</span>).</>}
          </li>
          <li><Link href="/issues" className="text-accent hover:underline">Issues &amp; notes</Link> lists every known data problem.</li>
        </ul>
      </section>
    </div>
  );
}


type AP = Detail["assets_people"][string];
const HAZ_WORD: Record<string, string> = { flood: "river flooding", coastal: "coastal flooding" };

/** Asset damage, high-risk location and worker heat-days for one plant, selected year. Separate measures. */
function AssetsPeopleSection({ ap, when, custom }: { ap: AP; when: "now" | "2040"; custom: boolean }) {
  const yr = when === "2040" ? "in 2040" : "now";
  const ratings = Object.entries(ap.location_ratings).filter(([, v]) => v);
  return (
    <section aria-labelledby="ap-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ap-h" className="text-h2 font-medium">Assets and people</h2>
        <p className="text-micro tracking-normal text-muted">Separate measures, {yr}. Not added to revenue at risk.{custom ? " Loading your assumptions…" : ""}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <article className="flex flex-col gap-2 rounded-lg border hairline bg-surface p-5 shadow-card">
          <p className="text-micro uppercase text-muted">Assets · expected damage a year</p>
          <p className="tabular text-figure font-semibold text-ink"><Prov v={ap.asset_damage}>{formatCr(ap.asset_damage.value)}</Prov></p>
          <p className="text-small text-ink2">
            From river and coastal floods, out of <Prov v={ap.asset_value} className="tabular">{formatCr(ap.asset_value.value)}</Prov> of assets.
          </p>
        </article>
        <article className={`flex flex-col gap-2 rounded-lg border bg-surface p-5 shadow-card ${ap.high_risk_location ? "border-risk-high" : "hairline"}`}>
          <p className="text-micro uppercase text-muted">Assets · high-risk location</p>
          <p className="tabular text-figure font-semibold text-ink">
            <Prov v={ap.assets_in_high_risk_locations}>{formatCr(ap.assets_in_high_risk_locations.value)}</Prov>
          </p>
          <p className="text-small text-ink2">
            {ap.high_risk_location
              ? <>Rated High for {ap.location_hazards.map((h) => HAZ_WORD[h] ?? h).join(" and ")}, so all of the plant&apos;s assets count.</>
              : <>Not in a High-rated flood or coastal location.</>}
          </p>
          <ul className="mt-auto flex flex-col gap-[0.125rem] text-micro tracking-normal text-muted">
            {ratings.map(([h, label]) => <li key={h}>{h === "flood" ? "River flood" : "Coastal flood"}: {label}</li>)}
            {when === "2040" && <li>Flood ratings exist for today only, so 2040 is the same.</li>}
          </ul>
        </article>
        <article className="flex flex-col gap-2 rounded-lg border hairline bg-surface p-5 shadow-card">
          <p className="text-micro uppercase text-muted">People · worker heat-days a year</p>
          <p className="tabular text-figure font-semibold text-ink"><Prov v={ap.worker_heat_days}>{formatCount(ap.worker_heat_days.value)}</Prov></p>
          <p className="text-small text-ink2">
            <Prov v={ap.employees} className="tabular">{formatInt(ap.employees.value)}</Prov> employees × days at or above 40 °C.
          </p>
          <p className="mt-auto text-micro tracking-normal text-muted">Exposure only, not health outcomes.</p>
        </article>
      </div>
    </section>
  );
}
