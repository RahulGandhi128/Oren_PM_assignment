"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Network, type Plant, type StressResponse } from "@/lib/api";
import { useAssumptionDefaults, useAssumptionValue } from "@/lib/assumptions";
import { BAND_STYLE } from "@/lib/bands";
import { formatCr, formatMt, formatPct, num } from "@/lib/format";
import { useExposureBoth, type Both } from "@/lib/exposure";
import { useWhen, type When } from "@/lib/when";
import { useHorizonStore, useOverrides } from "@/lib/store";
import { Prov } from "@/components/data/Prov";

const HEADLINE_DAYS = 30; // same outage length as the key finding

export function NetworkView() {
  const overrides = useOverrides();
  const [when] = useWhen();
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const { data: exposure } = useExposureBoth();
  const [headline, setHeadline] = useState<StressResponse | null>(null);
  const [selected, setSelected] = useState("P06");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.plants(), api.network()]).then(([p, n]) => { setPlants(p); setNetwork(n); }).catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    api.stress("P06", HEADLINE_DAYS, overrides).then(setHeadline).catch((e) => setError(String(e)));
  }, [overrides]);

  const byId = useMemo(() => new Map((plants ?? []).map((p) => [p.id, p])), [plants]);
  const kilns = network ? [...new Set(network.edges.map((e) => e.from_id))] : [];
  const units = network ? network.edges.map((e) => e.to_id) : [];
  const standalone = (plants ?? []).filter((p) => !kilns.includes(p.id) && !units.includes(p.id));

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <p className="text-micro uppercase text-muted">Clinker network</p>
        <h1 className="max-w-[34ch] font-display text-h1">
          Two kilns feed three grinding units. A {HEADLINE_DAYS}-day shutdown at Baloda Bazar puts{" "}
          {headline ? (
            <Prov v={headline.total_lost_revenue} className="tabular whitespace-nowrap">{formatCr(headline.total_lost_revenue.value)}</Prov>
          ) : "…"}{" "}
          of revenue at risk across {headline ? headline.children.length + 1 : 3} plants.
        </h1>
      </header>
      {error && <p className="text-small text-prov-placeholder">Could not load: {error}</p>}

      <section aria-labelledby="diagram-h" data-tour="network-diagram" className="flex flex-col gap-3 rounded-lg border hairline bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="diagram-h" className="font-display text-h2">Who supplies whom</h2>
          <p className="text-small text-muted">Arrow width = clinker shipped a year · circle size = revenue · colour = risk band {when === "2040" ? "in 2040" : "now"}</p>
        </div>
        {plants && network && exposure ? (
          <Diagram network={network} byId={byId} exposure={exposure} kilns={kilns} selected={selected} onSelect={setSelected} when={when} />
        ) : <div className="h-[18rem] animate-pulse rounded-md bg-border" />}
        {standalone.length > 0 && (
          <p className="text-small text-muted">
            Not in the network: {standalone.map((p) => p.short_name).join(", ")}. These integrated plants use all the clinker they make
            (clinker shipped = 0 in the register), so an outage there stays there.
          </p>
        )}
      </section>

      {plants && network && <StressTest plants={plants} network={network} selected={selected} onSelect={setSelected} />}

      <p className="text-small text-muted">
        Rail route disruption is not modelled in v1: a flooded line between a kiln and a grinding unit would also stop supply.
        See <Link href="/issues#limitations" className="text-accent hover:underline">limitations</Link>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Diagram */

function Diagram({ network, byId, exposure, kilns, selected, onSelect, when }: {
  network: Network; byId: Map<string, Plant>; exposure: Both; kilns: string[]; selected: string; onSelect: (id: string) => void; when: When;
}) {
  const W = 1000, H = 320, LX = 300, RX = 700;
  const units = network.edges.map((e) => e.to_id);
  const ky = (i: number) => (H / (kilns.length + 1)) * (i + 1);
  const uy = (i: number) => (H / (units.length + 1)) * (i + 1);
  const maxRev = Math.max(...[...byId.values()].map((p) => num(p.revenue)));
  const maxMt = Math.max(...network.edges.map((e) => num(e.clinker)));
  const r = (id: string) => 9 + 17 * Math.sqrt(num(byId.get(id)!.revenue) / maxRev);
  const band = (id: string) => exposure.y2040.plants.find((p) => p.plant_id === id)!.band;
  const bandNow = (id: string) => exposure.now.plants.find((p) => p.plant_id === id)!.band;
  const bands = (id: string) => `${when === "2040" ? band(id) : bandNow(id)} band`;
  const pos = new Map<string, [number, number]>([
    ...kilns.map((k, i) => [k, [LX, ky(i)]] as [string, [number, number]]),
    ...units.map((u, i) => [u, [RX, uy(i)]] as [string, [number, number]]),
  ]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-5xl" role="img"
      aria-label="Clinker network: Chittorgarh supplies Mundra; Baloda Bazar supplies Paradip and Durgapur">
      <defs>
        <marker id="net-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-ink2" />
        </marker>
      </defs>
      <text x={LX} y={18} textAnchor="middle" className="fill-muted text-micro uppercase">Kilns (integrated plants)</text>
      <text x={RX} y={18} textAnchor="middle" className="fill-muted text-micro uppercase">Grinding units</text>
      {network.edges.map((e) => {
        const [x1, y1] = pos.get(e.from_id)!, [x2, y2] = pos.get(e.to_id)!;
        const sx = x1 + r(e.from_id) + 2, ex = x2 - r(e.to_id) - 6;
        const mx = (sx + ex) / 2;
        const w = 2 + 10 * (num(e.clinker) / maxMt);
        const active = selected === e.from_id || selected === e.to_id;
        return (
          <g key={`${e.from_id}-${e.to_id}`}>
            <path d={`M${sx},${y1} C${mx},${y1} ${mx},${y2} ${ex},${y2}`} fill="none" strokeWidth={w} strokeLinecap="butt"
              markerEnd="url(#net-arrow)" className={active ? "stroke-accent" : "stroke-ink2 opacity-50"} />
            <text x={ex - 8} y={y2 > y1 + 1 ? y2 + w / 2 + 14 : y2 - w / 2 - 6} textAnchor="end" className="paint-stroke fill-ink stroke-surface text-micro tracking-normal" strokeWidth={4}>
              {formatMt(e.clinker.value)} · {e.mode === "unspecified" ? "mode not stated" : e.mode}
            </text>
          </g>
        );
      })}
      {[...pos.entries()].map(([id, [x, y]]) => {
        const p = byId.get(id)!;
        const kiln = p.type === "integrated";
        const st = BAND_STYLE[when === "2040" ? band(id) : bandNow(id)];
        const rr = r(id);
        return (
          <g key={id} role="button" tabIndex={0} aria-label={`${p.short_name}: run stress test`} className="cursor-pointer"
            onClick={() => onSelect(id)} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && onSelect(id)}>
            {selected === id && <circle cx={x} cy={y} r={rr + 5} className="fill-none stroke-accent" strokeWidth={1.5} />}
            {kiln ? <circle cx={x} cy={y} r={rr} className={`${st.fill} stroke-ink2`} strokeWidth={0.8} />
              : <><circle cx={x} cy={y} r={rr - 2} className={`fill-surface ${st.stroke}`} strokeWidth={4} />
                  <circle cx={x} cy={y} r={rr} className="fill-none stroke-ink2" strokeWidth={0.5} /></>}
            <text x={kiln ? x - rr - 8 : x + rr + 8} y={y - 2} textAnchor={kiln ? "end" : "start"} className="fill-ink text-small font-medium">{p.short_name}</text>
            <text x={kiln ? x - rr - 8 : x + rr + 8} y={y + 14} textAnchor={kiln ? "end" : "start"} className="fill-muted text-micro tracking-normal">
              {p.state} · {formatCr(p.revenue.value)} · {bands(id)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ Stress test */

function StressTest({ plants, network, selected, onSelect }: { plants: Plant[]; network: Network; selected: string; onSelect: (id: string) => void }) {
  const overrides = useOverrides();
  const setOverride = useHorizonStore((s) => s.setOverride);
  const defaults = useAssumptionDefaults();
  const buffer = useAssumptionValue("buffer_days");
  const opDays = useAssumptionValue("operating_days");
  const [days, setDays] = useState(20);
  const [res, setRes] = useState<StressResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bufDraft, setBufDraft] = useState<string>("");
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => { if (buffer != null) setBufDraft(String(buffer)); }, [buffer]);
  useEffect(() => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    api.stress(selected, days, overrides, ctl.current.signal).then((r) => { setRes(r); setErr(null); })
      .catch((e) => e.name !== "AbortError" && setErr(String(e.message ?? e)));
  }, [selected, days, overrides]);

  const bufMeta = defaults?.find((a) => a.id === "buffer_days");
  const commitBuffer = (raw: string) => {
    const v = Number(raw);
    if (!bufMeta || raw.trim() === "" || Number.isNaN(v) || v < bufMeta.min || v > bufMeta.max) {
      setErr(`Clinker stock must be between ${bufMeta?.min ?? 0} and ${bufMeta?.max ?? 60} days.`);
      return;
    }
    setOverride("buffer_days", Math.round(v), bufMeta.default);
  };

  const kilnIds = new Set(network.edges.map((e) => e.from_id));
  const groups = [
    { label: "Kilns that supply grinding units", items: plants.filter((p) => kilnIds.has(p.id)) },
    { label: "Other plants (own loss only)", items: plants.filter((p) => !kilnIds.has(p.id)) },
  ];

  return (
    <section aria-labelledby="stress-h" data-tour="stress-test" className="flex flex-col gap-4 rounded-lg border hairline bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 id="stress-h" className="font-display text-h2">Stress test: what if a plant shuts?</h2>
        <p className="text-small text-ink2">Pick a plant and how long it is shut. Grinding units keep running on stored clinker, then stop.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-small">
          <span className="text-micro uppercase text-muted">Plant</span>
          <select value={selected} onChange={(e) => onSelect(e.target.value)} className="rounded-sm border border-border-strong bg-surface px-2 py-2 text-ink">
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((p) => <option key={p.id} value={p.id}>{p.short_name} ({p.state})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          <span className="flex justify-between text-micro uppercase text-muted"><span>Shut for</span><span className="tabular text-ink">{days} days</span></span>
          <input type="range" min={1} max={90} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="accent-accent" aria-label="Outage length in days" />
          <span className="flex justify-between text-micro tracking-normal text-muted"><span>1</span><span>90</span></span>
        </label>
        <label className="flex flex-col gap-1 text-small">
          <span className="flex items-center gap-2 text-micro uppercase text-muted"><Prov v={{ kind: "assumption", source_ids: ["asm.buffer_days"] }}>Clinker stock at grinding units</Prov></span>
          <span className="flex items-center gap-2">
            <input type="number" min={bufMeta?.min} max={bufMeta?.max} step={1} value={bufDraft}
              onChange={(e) => setBufDraft(e.target.value)} onBlur={(e) => commitBuffer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitBuffer((e.target as HTMLInputElement).value)}
              className="tabular w-[5rem] rounded-sm border border-border-strong bg-surface px-2 py-1 text-right text-ink" />
            <span className="text-ink2">days</span>
            <Link href="/methodology#buffer_days" className="text-micro tracking-normal text-accent hover:underline">about this</Link>
          </span>
          <span className="text-micro tracking-normal text-muted">Changing it here changes it app-wide.</span>
        </label>
      </div>

      {err && <p role="alert" className="text-small text-quality-danger">{err}</p>}

      {res && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead className="border-b hairline text-left text-micro uppercase text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Plant</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Days stopped</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Lost revenue</th>
                  <th scope="col" className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hairline">
                  <td className="py-2 pr-3 font-medium text-ink">{res.short_name}</td>
                  <td className="tabular py-2 pr-3 text-ink">{res.days}</td>
                  <td className="tabular py-2 pr-3 text-right text-ink">
                    <Prov v={res.own_lost_revenue}>{formatCr(res.own_lost_revenue.value)}</Prov>
                  </td>
                  <td className="py-2 text-ink2">Day 1 to day {res.days}</td>
                </tr>
                {res.children.map((c) => (
                  <tr key={c.plant_id} className="border-b hairline">
                    <td className="py-2 pr-3 text-ink">{c.short_name} <span className="text-micro tracking-normal text-muted">grinding unit</span></td>
                    <td className="tabular py-2 pr-3 text-ink">{num(c.lost_days)}</td>
                    <td className="tabular py-2 pr-3 text-right text-ink">
                      <Prov v={c.lost_revenue}>{formatCr(c.lost_revenue.value)}</Prov>
                    </td>
                    <td className="py-2 text-ink2">{c.covered_by_buffer ? "Covered by clinker stock" : `Runs out of clinker on day ${c.stops_on_day}`}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-3 font-medium text-ink">Total</td>
                  <td />
                  <td className="tabular py-2 pr-3 text-right font-medium text-ink">
                    <Prov v={res.total_lost_revenue}>{formatCr(res.total_lost_revenue.value)}</Prov>
                  </td>
                  <td className="tabular py-2 text-ink2">{formatPct(res.pct_company_revenue.value, false)} of company revenue</td>
                </tr>
              </tbody>
            </table>
          </div>
          {res.note && <p className="text-small text-muted">{res.note} An outage here does not spread.</p>}
          <Timeline res={res} buffer={num(res.buffer_days)} />
          <p className="text-micro tracking-normal text-muted">
            Lost revenue = revenue ÷ {opDays ?? "…"} operating days × days stopped. A grinding unit stops for (outage − {num(res.buffer_days)} days of stock) if that is above zero.
            Revenue, not profit.
          </p>
        </>
      )}
    </section>
  );
}

function Timeline({ res, buffer }: { res: StressResponse; buffer: number }) {
  const N = res.days;
  const pct = (d: number) => `${(Math.min(d, N) / N) * 100}%`;
  const rows = [
    { name: res.short_name, segs: [{ from: 0, to: N, kind: "stopped" as const }] },
    ...res.children.map((c) => ({
      name: c.short_name,
      segs: [
        { from: 0, to: Math.min(buffer, N), kind: "stock" as const },
        ...(N > buffer ? [{ from: buffer, to: N, kind: "stopped" as const }] : []),
      ],
    })),
  ];
  return (
    <figure className="flex flex-col gap-2" aria-label="Timeline of the outage">
      <figcaption className="text-micro uppercase text-muted">Timeline, day 1 to day {N}</figcaption>
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-small">
          <span className="truncate text-ink2">{r.name}</span>
          <div className="relative h-5 overflow-hidden rounded-sm border hairline bg-surface2">
            {r.segs.map((s, i) => (
              <div key={i} className={`absolute inset-y-0 ${s.kind === "stopped" ? "bg-risk-severe" : "bg-risk-moderate"}`}
                style={{ left: pct(s.from), width: `calc(${pct(s.to)} - ${pct(s.from)})` }}
                title={s.kind === "stopped" ? `Stopped, day ${s.from + 1}–${s.to}` : `Running on stock, day 1–${s.to}`} />
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[7rem_1fr] gap-3 text-micro tracking-normal text-muted">
        <span />
        <div className="relative h-4">
          <span className="absolute left-0">Day 1</span>
          {res.children.length > 0 && buffer < N && <span className="absolute -translate-x-1/2" style={{ left: pct(buffer) }}>Day {buffer + 1}</span>}
          <span className="absolute right-0">Day {N}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-micro tracking-normal text-ink2">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-risk-severe" /> Stopped</span>
        {res.children.length > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-risk-moderate" /> Running on clinker stock</span>}
      </div>
    </figure>
  );
}
