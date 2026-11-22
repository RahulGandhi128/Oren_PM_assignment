"use client";
import Link from "next/link";
import { DownloadDataButton } from "@/components/data/DownloadData";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, type Network, type Plant, type PlantExposure, type Value } from "@/lib/api";
import { BAND_STYLE } from "@/lib/bands";
import { useExposureBoth } from "@/lib/exposure";
import { useWhen } from "@/lib/when";
import { formatCr, formatDays, formatMt, formatNum1, formatPct, num } from "@/lib/format";
import { MapPanel } from "@/components/map/MapPanel";
import type { MapGeometry } from "@/components/map/geo";
import { Prov } from "@/components/data/Prov";

type SortKey = "name" | "revenue" | "risk" | "heat" | "rx" | "water" | "flood";

export function PlantsView({ geometry }: { geometry: MapGeometry }) {
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const { data: exposure, error: exError } = useExposureBoth();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "risk", dir: -1 });
  const router = useRouter();
  const [when] = useWhen();
  const y40 = when === "2040";
  const yearSub = y40 ? "2040" : "now";

  useEffect(() => {
    Promise.all([api.plants(), api.network()])
      .then(([p, n]) => { setPlants(p); setNetwork(n); })
      .catch((e) => setError(String(e)));
  }, []);

  const ex = useMemo(() => {
    const now: Record<string, PlantExposure> = {}, y: Record<string, PlantExposure> = {};
    for (const r of exposure?.now.plants ?? []) now[r.plant_id] = r;
    for (const r of exposure?.y2040.plants ?? []) y[r.plant_id] = r;
    return { now, y };
  }, [exposure]);

  const rows = useMemo(() => {
    if (!plants) return [];
    const val = (p: Plant): number | string =>
      sort.key === "revenue" ? num(p.revenue) : sort.key === "name" ? p.short_name
        : sort.key === "risk" ? ((y40 ? ex.y : ex.now)[p.id]?.total_revenue_at_risk.value ?? -1)
        : sort.key === "heat" ? ((y40 ? p.climate?.heat_days_40c_2040 : p.climate?.heat_days_40c_today)?.value ?? -1)
        : sort.key === "rx" ? (p.climate?.rx1day_change_pct.value ?? -999)
        : sort.key === "water" ? ((y40 ? p.climate?.water_stress_2040 : p.climate?.water_stress_today)?.value ?? -1)
        : (p.climate?.riverine_flood.value ?? -1);
    return [...plants].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [plants, sort, ex, y40]);

  const byId = useMemo(() => new Map((plants ?? []).map((p) => [p.id, p])), [plants]);
  const go = (id: string) => router.push(`/plants/${id}`);
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));

  const dependency = (p: Plant) => {
    if (!network) return null;
    const out = network.edges.filter((e) => e.from_id === p.id);
    const inn = network.edges.find((e) => e.to_id === p.id);
    if (out.length) return `Supplies ${out.map((e) => byId.get(e.to_id)?.short_name).join(" & ")}`;
    if (inn) return `Clinker from ${byId.get(inn.from_id)?.short_name}`;
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-micro uppercase text-muted">Plants · physical risk</p>
          <h1 className="max-w-[30ch] font-display text-h1">
            Nine plants across nine states. Two kilns feed three grinding units, so one outage can travel.
          </h1>
        </div>
        <DownloadDataButton />
      </header>

      {(error || exError) && <p className="text-small text-prov-placeholder">Could not load plant data: {error ?? exError}</p>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <MapPanel geometry={geometry} plants={plants} edges={network?.edges ?? null} exposure={exposure}
          active={active} onHover={setActive} onSelect={go} className="self-start" />

        <section aria-label="Plant list" data-tour="plants-table" className="self-start overflow-x-auto rounded-lg border border-border-strong bg-surface shadow-card">
          <table className="w-full text-small">
            <thead className="border-b hairline bg-surface2 text-left">
              <tr>
                <Th label="Plant" k="name" sort={sort} onSort={toggleSort} />
                <Th label="Revenue FY26" k="revenue" sort={sort} onSort={toggleSort} align="right" />
                <Th label="Physical risk a year" sub={yearSub} k="risk" sort={sort} onSort={toggleSort} align="right" />
                <Th label="Days ≥40 °C" sub={yearSub} k="heat" sort={sort} onSort={toggleSort} align="right" />
                <Th label="Water stress" sub={`${yearSub}, 0–5`} k="water" sort={sort} onSort={toggleSort} align="right" />
                <Th label="River flood" sub={y40 ? "score 0–5 · wettest day" : "score 0–5"} k="flood" sort={sort} onSort={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {plants
                ? rows.map((p) => {
                    const r = (y40 ? ex.y : ex.now)[p.id];
                    const ws = y40 ? p.climate?.water_stress_2040 : p.climate?.water_stress_today;
                    return (
                    <tr key={p.id} onMouseEnter={() => setActive(p.id)} onMouseLeave={() => setActive(null)}
                      className={`border-b hairline transition-colors last:border-b-0 ${active === p.id ? "bg-accent-soft" : ""}`}>
                      <td className="px-2 py-2">
                        <Link href={`/plants/${p.id}`} onFocus={() => setActive(p.id)} onBlur={() => setActive(null)} className="whitespace-nowrap font-medium text-ink hover:text-accent">
                          {p.short_name}
                        </Link>
                        <div className="min-w-[9rem] text-micro tracking-normal text-muted">{[p.state, p.type === "integrated" ? "Integrated" : "Grinding"].join(" · ")}{dependency(p) ? <><br />{dependency(p)}</> : null}</div>
                      </td>
                      <td className="tabular whitespace-nowrap px-2 py-2 text-right text-ink"><Prov v={p.revenue}>{formatCr(p.revenue.value)}</Prov></td>
                      <td className="tabular whitespace-nowrap px-2 py-2 text-right text-ink">
                        {r ? (
                          <span className="inline-flex flex-col items-end">
                            <Prov v={r.total_revenue_at_risk} className="font-semibold text-ink">{crShort(r.total_revenue_at_risk.value)}</Prov>
                            <span className="inline-flex items-center gap-1 text-micro tracking-normal text-muted">
                              <span aria-hidden className={`inline-block h-2 w-2 rounded-pill ${BAND_STYLE[r.band].bg}`} />{r.band}
                            </span>
                          </span>
                        ) : "…"}
                      </td>
                      <ClimateCell v={y40 ? p.climate?.heat_days_40c_2040 : p.climate?.heat_days_40c_today} fmt={formatDays} />
                      <ClimateCell v={ws} fmt={formatNum1} sub={ws?.label ? SHORT_CAT[ws.label] ?? ws.label : null} />
                      <ClimateCell v={p.climate?.riverine_flood} fmt={formatNum1}
                        sub={y40 && p.climate?.rx1day_change_pct ? <>wettest day <Prov v={p.climate.rx1day_change_pct} extra="Change in the wettest day of the year by 2040; scales the 2040 flood probability">{formatPct(p.climate.rx1day_change_pct.value)}</Prov></> : null} />
                    </tr>
                  ); })
                : Array.from({ length: 9 }, (_, i) => (
                    <tr key={i} className="border-b hairline"><td colSpan={6} className="px-3 py-3"><div className="h-4 animate-pulse rounded-sm bg-border" /></td></tr>
                  ))}
            </tbody>
          </table>
          {network && (
            <p className="border-t hairline px-2 py-2 text-micro tracking-normal text-muted">
              Clinker flows: {network.edges.map((e) => `${byId.get(e.from_id)?.short_name} → ${byId.get(e.to_id)?.short_name} ${formatMt(e.clinker.value)}`).join(" · ")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

const crShort = (v: number | null) => (v == null ? "—" : `₹${v.toFixed(1)} cr`);

const SHORT_CAT: Record<string, string> = {
  Low: "Low", "Low-Medium": "Low–Med", "Medium-High": "Med–High", High: "High", "Extremely High": "Ext. high", "Arid & low water use": "Arid",
};

function ClimateCell({ v, fmt, sub }: { v?: Value | null; fmt: (x: number | null) => string; sub?: React.ReactNode }) {
  if (!v) return <td className="px-2 py-2 text-right text-muted">—</td>;
  return (
    <td className="tabular whitespace-nowrap px-2 py-2 text-right text-ink">
      <span className="inline-flex items-center justify-end gap-1">
        <Prov v={v} extra={v.range ? `Climate models range from ${fmt(v.range[0])} to ${fmt(v.range[1])}.` : v.label}>{fmt(v.value)}</Prov>
      </span>
      {sub && <span className="block text-micro tracking-normal text-muted">{sub}</span>}
    </td>
  );
}

function Th({ label, sub, k, sort, onSort, align = "left" }: {
  label: string; sub?: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  const on = sort.key === k;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`px-2 py-2 align-bottom font-medium ${align === "right" ? "text-right" : ""}`}>
      <button onClick={() => onSort(k)} className={`inline-flex flex-col text-micro uppercase ${align === "right" ? "items-end" : "items-start"} ${on ? "text-ink" : "text-muted"} hover:text-ink`}>
        <span>{label}<span aria-hidden>{on ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</span></span>
        {sub && <span className="normal-case tracking-normal text-muted">{sub}</span>}
      </button>
    </th>
  );
}
