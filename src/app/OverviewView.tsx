"use client";
import { useEffect, useMemo, useState } from "react";
import { api, type Network, type Plant, type RangeSensitivityResponse, type StressResponse, type SummaryResponse } from "@/lib/api";
import { useExposureBoth } from "@/lib/exposure";
import { formatCr0, formatPct } from "@/lib/format";
import { useOverrides } from "@/lib/store";
import { useWhen } from "@/lib/when";
import { Prov } from "@/components/data/Prov";
import { ExposureStrip } from "@/components/overview/ExposureStrip";
import { RangeCard } from "@/components/overview/RangeCard";
import { PhysicalRiskCards } from "@/components/overview/PhysicalRiskCards";
import { HazardTiles } from "@/components/overview/HazardTiles";
import { Concentration } from "@/components/overview/Concentration";
import { Tornado } from "@/components/overview/Tornado";
import { FindingCards } from "@/components/overview/FindingCards";

const OUTAGE_DAYS = 30; // same outage length as the key finding and the Network page headline

export function OverviewView() {
  const overrides = useOverrides();
  const [when] = useWhen();
  const { data: ex } = useExposureBoth();
  const [s, setS] = useState<SummaryResponse | null>(null);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [tornado, setTornado] = useState<RangeSensitivityResponse | null>(null);
  const [conc, setConc] = useState<StressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.plants(), api.network()]).then(([p, n]) => { setPlants(p); setNetwork(n); }).catch((e) => setError(String(e.message ?? e)));
    api.rangeSensitivity().then(setTornado).catch(() => {});
  }, []);
  useEffect(() => {
    const ctl = new AbortController();
    api.summary(overrides, ctl.signal).then(setS).catch((e) => e.name !== "AbortError" && setError(String(e.message ?? e)));
    return () => ctl.abort();
  }, [overrides]);

  // Largest kiln dependency: the kiln whose 30-day outage costs its grinding units the most revenue.
  const kilns = useMemo(() => (network ? [...new Set(network.edges.map((e) => e.from_id))] : []), [network]);
  useEffect(() => {
    if (!kilns.length) return;
    const ctl = new AbortController();
    Promise.all(kilns.map((k) => api.stress(k, OUTAGE_DAYS, overrides, ctl.signal)))
      .then((rs) => {
        // Rank by what the kiln's outage costs *other* plants (the dependency), not by its own size.
        const downstream = (r: StressResponse) => r.children.reduce((a, c) => a + (c.lost_revenue.value ?? 0), 0);
        setConc(rs.reduce((a, b) => (downstream(b) > downstream(a) ? b : a)));
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [kilns, overrides]);

  if (error) return <p className="text-small text-prov-placeholder">Could not load the overview: {error}</p>;
  if (!s) return <div className="h-[10rem] animate-pulse rounded-lg bg-border" />;

  const cur = when === "2040" ? s.future : s.today;
  const WORD: Record<string, string> = { heat: "extreme heat", water: "water stress", flood: "river flooding", coastal: "coastal flooding" };
  const topTwo = Object.entries(cur.by_hazard).sort((a, b) => (b[1].value ?? 0) - (a[1].value ?? 0)).slice(0, 2).map(([k]) => WORD[k] ?? k).join(" and ");
  const custom = Object.keys(overrides).length > 0;
  const nameOf = (id: string) => plants?.find((p) => p.id === id)?.short_name ?? id;
  const supplies = conc && network ? network.edges.filter((e) => e.from_id === conc.plant_id).map((e) => nameOf(e.to_id)) : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Climate exposure: physical (measured) | transition (not in v1) */}
      <ExposureStrip s={s} when={when} />

      {/* a. Hero */}
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1.35fr_1fr]">
        <header data-tour="headline" className="flex flex-col gap-3">
          <p className="text-micro uppercase text-muted">Physical risk only · transition risk not yet included</p>
          <h1 className="font-serif text-serif text-ink">
            Physical climate risk puts <Prov v={cur.revenue_at_risk} className="tabular">{formatCr0(cur.revenue_at_risk.value)}</Prov> a year at risk{when === "2040" ? " by 2040" : " now"},{" "}
            <Prov v={cur.pct_revenue} className="tabular">{formatPct(cur.pct_revenue.value, false)}</Prov> of revenue, mostly from {topTwo}.
          </h1>
          <p className="tabular text-small text-ink2">
            {cur.plants_high_or_severe} of {cur.plant_count} plants in the High or Severe band ·{" "}
            {when === "2040" ? <>2040 = average climate of {s.windows["2040"].join("–")}</> : <>now = average climate of {s.windows.today.join("–")}</>}
          </p>
        </header>
        <RangeCard s={s} custom={custom} when={when} />
      </div>

      {/* Physical risk: operations, assets (damage, locations), people */}
      <PhysicalRiskCards s={s} when={when} />

      {/* b. Hazards */}
      {ex && <HazardTiles s={s} ex={ex} when={when} />}

      {/* c. Concentration | sensitivity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_3fr]">
        <Concentration res={conc} supplies={supplies} />
        <Tornado data={tornado} />
      </div>

      {/* d. Findings */}
      <FindingCards findings={s.findings.filter((x) => x.href !== "/")} />
    </div>
  );
}
