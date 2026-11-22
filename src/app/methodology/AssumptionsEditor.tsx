"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type Assumption, type SensitivityResponse, type SensitivityRow, type SummaryResponse } from "@/lib/api";
import { stepFor, useAssumptionDefaults } from "@/lib/assumptions";
import { formatCr, formatPct } from "@/lib/format";
import { activeSet, SET_LABEL, usePresets } from "@/lib/presets";
import { useHorizonStore } from "@/lib/store";
import { SavedSets } from "./SavedSets";

const GROUP_ORDER = ["General", "Heat", "Water stress", "Riverine flood", "Coastal flood / cyclone", "Clinker network", "Risk bands", "Map display"];
const GROUP_NOTE: Record<string, string> = {
  "Water stress": "Days of curtailment by Aqueduct category, multiplied by a factor for the plant's water source.",
  "Riverine flood": "Flood chance by Aqueduct riverine score band. In 2040 it rises with the wettest day: chance × (1 + rain change × elasticity).",
  "Coastal flood / cyclone": "Applies only to plants marked coastal in the register.",
  "Clinker network": "Grinding units keep running on stock for this many days after their kiln stops.",
  "Risk bands": "How plants are labelled. They change no ₹ figure, and presets never change them.",
  "Map display": "Only decide which hazard icons appear on the map. They change no ₹ figure.",
};

const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);

export function AssumptionsEditor() {
  const defaults = useAssumptionDefaults();
  const presets = usePresets();
  const overrides = useHorizonStore((s) => s.overrides);
  const setOverrides = useHorizonStore((s) => s.setOverrides);
  const resetAll = useHorizonStore((s) => s.resetOverrides);
  const [live, setLive] = useState<SummaryResponse | null>(null);
  const [sens, setSens] = useState<SensitivityResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    api.summary(overrides, ctl.signal).then(setLive).catch(() => {});
    api.sensitivity(overrides, ctl.signal).then(setSens).catch(() => {});
    return () => ctl.abort();
  }, [overrides]);

  const sensById = useMemo(() => new Map((sens?.rows ?? []).map((r) => [r.id, r])), [sens]);
  const maxSwing = Math.max(1, ...(sens?.rows ?? []).map((r) => Math.max(r.revenue_high - r.revenue_low, 0)));
  const keyIds = useMemo(() => new Set((sens?.rows ?? []).filter((r) => r.key).map((r) => r.id)), [sens]);

  const keyRows = useMemo(
    () => (defaults ?? []).filter((a) => keyIds.has(a.id)).sort((x, y) => (sensById.get(y.id)?.swing ?? 0) - (sensById.get(x.id)?.swing ?? 0)),
    [defaults, keyIds, sensById],
  );
  const groups = useMemo(() => {
    const g = new Map<string, Assumption[]>();
    for (const a of defaults ?? []) if (!keyIds.has(a.id)) g.set(a.group, [...(g.get(a.group) ?? []), a]);
    return [...g.entries()].sort((x, y) => GROUP_ORDER.indexOf(x[0]) - GROUP_ORDER.indexOf(y[0]));
  }, [defaults, keyIds]);

  // Scroll to #assumption-id once rows exist (links from other pages)
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => { setHash(window.location.hash.slice(1) || null); }, []);
  useEffect(() => {
    if (!hash || !sens) return;
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "center" }));
  }, [hash, sens]);

  /** Validate on the server (the engine is the single source of rules) before keeping a change. */
  const commit = async (a: Assumption, value: number) => {
    const next = { ...useHorizonStore.getState().overrides };
    if (value === a.default) delete next[a.id];
    else next[a.id] = value;
    setPending(true);
    try {
      await api.summary(next);
      setErrors(({ [a.id]: _, ...rest }) => rest);
      setOverrides(next);
      return true;
    } catch (e) {
      setErrors((x) => ({ ...x, [a.id]: e instanceof ApiError ? e.message : "Could not check this value." }));
      return false;
    } finally {
      setPending(false);
    }
  };

  const set = activeSet(overrides, presets);
  const changed = defaults?.filter((a) => a.id in overrides) ?? [];
  const range = live?.preset_range;

  return (
    <section id="assumptions" aria-labelledby="asm-h" className="flex scroll-mt-9 flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="asm-h" className="font-display text-h2">Assumptions</h2>
        <p className="text-small text-muted">Changes apply across the app for this browser tab only. Save a set to a file to keep it.</p>
      </div>

      {/* Preset bar */}
      <div data-tour="presets" className="flex flex-col gap-3 rounded-lg border hairline bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-micro uppercase text-muted">Assumption set</p>
            <p className="text-small text-ink2">Start from a preset. Central is the official set; the other two show the plausible range.</p>
          </div>
          <SetBadge set={set} />
        </div>
        <div role="radiogroup" aria-label="Assumption preset" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(presets ?? []).map((p) => {
            const on = set === p.id;
            const total = p.id === "central" ? undefined : range?.[p.id as "conservative" | "severe"]?.["2040"]?.value;
            return (
              <button key={p.id} role="radio" aria-checked={on}
                onClick={() => { setErrors({}); p.id === "central" ? resetAll() : setOverrides(p.overrides); }}
                className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors ${on ? "border-accent bg-accent-soft" : "border-border-strong hover:border-ink2"}`}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium text-ink">{p.label}</span>
                  <span className="tabular text-small text-ink2">
                    {p.id === "central" ? (live && set === "central" ? formatCr(live.future.revenue_at_risk.value) : "") : total != null ? formatCr(total) : ""}
                    {p.id !== "central" || set === "central" ? <span className="text-micro tracking-normal text-muted"> · 2040</span> : null}
                  </span>
                </span>
                <span className="text-micro tracking-normal text-muted">{p.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <SavedSets live={live} onLoaded={() => setErrors({})} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_1fr]">
        <div className="flex flex-col gap-6">
          {!defaults || !sens ? <div className="h-[16rem] animate-pulse rounded-lg bg-border" /> : (
            <>
              {/* Key drivers */}
              <div data-tour="key-drivers" className="flex flex-col gap-3">
                <div>
                  <h3 className="font-display text-h3 text-ink">Key drivers</h3>
                  <p className="text-small text-muted">
                    The assumptions that move the 2040 total by at least {formatCr(sens.key_threshold)} across their plausible range, measured by re-running the model.
                    Bars show how far each one moves the total.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {keyRows.map((a) => (
                    <Control key={a.id} a={a} variant="card" value={overrides[a.id] ?? a.default} changed={a.id in overrides}
                      sens={sensById.get(a.id)} now={sens.revenue_now} maxSwing={maxSwing} error={errors[a.id]}
                      onCommit={(v) => commit(a, v)} onClearError={() => setErrors(({ [a.id]: _, ...rest }) => rest)} />
                  ))}
                </div>
              </div>

              {/* Advanced */}
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="font-display text-h3 text-ink">Advanced</h3>
                  <p className="text-small text-muted">Everything else. Most of these move the total by little or nothing for these nine plants; each says how much.</p>
                </div>
                {groups.map(([group, rows]) => (
                  <Group key={group} group={group} rows={rows} overrides={overrides} hash={hash}
                    maxInGroup={Math.max(0, ...rows.map((a) => sensById.get(a.id)?.swing ?? 0))}>
                    {rows.map((a) => (
                      <Control key={a.id} a={a} variant="row" value={overrides[a.id] ?? a.default} changed={a.id in overrides}
                        sens={sensById.get(a.id)} now={sens.revenue_now} maxSwing={maxSwing} error={errors[a.id]}
                        onCommit={(v) => commit(a, v)} onClearError={() => setErrors(({ [a.id]: _, ...rest }) => rest)} />
                    ))}
                  </Group>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Effect panel */}
        <aside aria-label="Effect of your changes" className="self-start xl:sticky xl:top-[calc(var(--hz-layout-top-bar-height)+var(--hz-space-5))]">
          <div className="flex flex-col gap-3 rounded-lg border hairline bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-micro uppercase text-muted">Physical risk · company revenue at risk a year</p>
            </div>
            <Total label="Now" now={live?.today.revenue_at_risk.value} pct={live?.today.pct_revenue.value} />
            <Total label="2040" now={live?.future.revenue_at_risk.value} pct={live?.future.pct_revenue.value} />
            {range && (
              <p className="tabular border-t hairline pt-3 text-small text-ink2">
                Plausible range, 2040: {formatCr(range.conservative["2040"].value)} (Conservative) to {formatCr(range.severe["2040"].value)} (Severe)
              </p>
            )}
            <div className="flex items-center justify-between border-t hairline pt-3 text-small">
              <span className="text-ink2">High or Severe plants, 2040</span>
              <span className="tabular text-ink">{live ? `${live.future.plants_high_or_severe} / ${live.future.plant_count}` : "…"}</span>
            </div>
            <div className="flex flex-col gap-2 border-t hairline pt-3">
              <div className="flex items-center justify-between gap-2">
                <SetBadge set={set} />
                <button onClick={() => { resetAll(); setErrors({}); }} disabled={set === "central"}
                  className="rounded-pill border border-ink px-3 py-1 text-small font-medium text-ink transition-colors hover:bg-ink hover:text-bg disabled:border-border disabled:text-muted disabled:hover:bg-transparent">
                  Official set
                </button>
              </div>
              {pending && <span className="text-micro tracking-normal text-muted">Checking…</span>}
              {(set === "conservative" || set === "severe") && (
                <p className="text-micro tracking-normal text-ink2">
                  {changed.length} assumptions at their {set === "severe" ? "higher" : "lower"}-loss end. Band thresholds and map settings unchanged.
                </p>
              )}
              {set === "custom" && changed.length > 0 && (
                <ul className="flex max-h-[15rem] flex-col gap-1 overflow-auto text-micro tracking-normal">
                  {changed.map((a) => {
                    const dp = decimals(stepFor(a));
                    return (
                      <li key={a.id} className="flex justify-between gap-2">
                        <a href={`#${a.id}`} onClick={() => setHash(a.id)} className="truncate text-ink2 hover:text-accent">{a.label}</a>
                        <span className="tabular whitespace-nowrap text-ink">{a.default.toFixed(dp)} → {overrides[a.id].toFixed(dp)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SetBadge({ set }: { set: ReturnType<typeof activeSet> }) {
  const official = set === "central";
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-1 text-micro uppercase ${official ? "bg-prov-data text-surface" : "border border-dashed border-prov-assumption bg-quality-warning-soft text-prov-assumption"}`}>
      {official ? "✓ Official set" : `${SET_LABEL[set]} · not official`}
    </span>
  );
}

function Total({ label, now, pct }: { label: string; now?: number | null; pct?: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-small text-ink2">{label}</span>
      <span className="text-right">
        <span className="tabular block font-display text-h3 text-ink">{now != null ? formatCr(now) : "…"}</span>
        <span className="tabular block text-micro tracking-normal text-muted">{pct != null ? `${formatPct(pct, false)} of revenue` : ""}</span>
      </span>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className={`shrink-0 fill-none stroke-ink2 transition-transform ${open ? "rotate-90" : ""}`} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}

function Group({ group, rows, overrides, hash, maxInGroup, children }: {
  group: string; rows: Assumption[]; overrides: Record<string, number>; hash: string | null; maxInGroup: number; children: React.ReactNode;
}) {
  const nChanged = rows.filter((a) => a.id in overrides).length;
  const hasHash = !!hash && rows.some((a) => a.id === hash);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (hasHash) setOpen(true); }, [hasHash]);
  const noMoney = group === "Risk bands" || group === "Map display";
  return (
    <div className="overflow-hidden rounded-lg border hairline bg-surface shadow-card">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 bg-surface2 px-4 py-3 text-left hover:bg-accent-soft">
        <Chevron open={open} />
        <span className="flex-1">
          <span className="font-medium text-ink">{group}</span>
          <span className="ml-2 text-micro tracking-normal text-muted">{rows.length} assumption{rows.length === 1 ? "" : "s"}</span>
        </span>
        {nChanged > 0 && <span className="rounded-pill border border-dashed border-prov-assumption px-2 py-1 text-micro tracking-normal text-prov-assumption">{nChanged} changed</span>}
        <span className="tabular hidden text-micro tracking-normal text-muted sm:inline">
          {noMoney ? "no ₹ effect" : maxInGroup > 0.05 ? `moves total up to ${formatCr(maxInGroup)}` : "≈ no effect on total"}
        </span>
      </button>
      {open && (
        <div>
          {GROUP_NOTE[group] && <p className="border-b hairline px-4 py-2 text-small text-muted">{GROUP_NOTE[group]}</p>}
          <ul>{children}</ul>
        </div>
      )}
    </div>
  );
}

/** Tornado-style bar: how far this assumption moves the 2040 total across its plausible range. */
function ImpactBar({ s, now, maxSwing }: { s: SensitivityRow; now: number; maxSwing: number }) {
  const left = Math.max(0, now - s.revenue_low), right = Math.max(0, s.revenue_high - now);
  const assetOnly = s.swing < 0.05 && s.asset_high - s.asset_low > 0.05;
  if (s.swing < 0.05 && !assetOnly) return <p className="text-micro tracking-normal text-muted">No effect on the total for these nine plants.</p>;
  if (assetOnly) return (
    <p className="tabular text-micro tracking-normal text-muted">Changes expected asset damage only: {formatCr(s.asset_low)} to {formatCr(s.asset_high)} a year (2040).</p>
  );
  const w = (x: number) => `${(x / maxSwing) * 50}%`;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2 rounded-pill bg-surface2" aria-hidden>
        <span className="absolute inset-y-0 rounded-l-pill bg-prov-derived opacity-40" style={{ right: "50%", width: w(left) }} />
        <span className="absolute inset-y-0 rounded-r-pill bg-risk-high" style={{ left: "50%", width: w(right) }} />
        <span className="absolute -inset-y-1 left-1/2 w-px bg-ink" />
      </div>
      <p className="tabular text-micro tracking-normal text-muted">
        2040 total {formatCr(s.revenue_low)} to {formatCr(s.revenue_high)} across its range (now {formatCr(now)})
      </p>
    </div>
  );
}

function Control({ a, variant, value, changed, sens, now, maxSwing, error, onCommit, onClearError }: {
  a: Assumption; variant: "card" | "row"; value: number; changed: boolean; sens?: SensitivityRow; now: number; maxSwing: number;
  error?: string; onCommit: (v: number) => Promise<boolean>; onClearError: () => void;
}) {
  const step = stepFor(a);
  const dp = decimals(step);
  const [draft, setDraft] = useState(value.toFixed(dp));
  const [rangeMsg, setRangeMsg] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(value.toFixed(dp)); }, [value, dp]);

  const tryCommit = async (raw: string) => {
    const v = Number(raw);
    if (raw.trim() === "" || Number.isNaN(v)) { setRangeMsg("Enter a number."); return; }
    if (v < a.min || v > a.max) { setRangeMsg(`Must be between ${a.min} and ${a.max} ${a.unit}.`); return; }
    setRangeMsg(null);
    const rounded = Number(v.toFixed(dp));
    if (rounded === value) return;
    const ok = await onCommit(rounded);
    if (!ok) setDraft(value.toFixed(dp));
  };
  const onSlide = (raw: string) => {
    setDraft(raw);
    onClearError();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => tryCommit(raw), 150);
  };

  const msg = rangeMsg ?? error;
  const card = variant === "card";
  const inputs = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input type="range" min={a.min} max={a.max} step={step} value={Number(draft) || 0} aria-label={`${a.label} slider`}
          onChange={(e) => onSlide(e.target.value)} className="min-w-0 flex-1 accent-accent" />
        <input id={`in-${a.id}`} type="number" inputMode="decimal" min={a.min} max={a.max} step={step} value={draft}
          aria-invalid={!!msg} aria-describedby={msg ? `err-${a.id}` : undefined}
          onChange={(e) => { setDraft(e.target.value); setRangeMsg(null); onClearError(); }}
          onBlur={(e) => tryCommit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryCommit((e.target as HTMLInputElement).value)}
          className={`tabular w-[5rem] rounded-sm border bg-surface px-2 py-1 text-right text-small text-ink ${msg ? "border-quality-danger" : "border-border-strong"}`} />
      </div>
      <div className="flex items-center justify-between gap-2 text-micro tracking-normal text-muted">
        <span>{a.unit} · allowed {a.min}–{a.max}</span>
        {changed && <button onClick={() => onCommit(a.default)} className="text-accent hover:underline">Reset to {a.default.toFixed(dp)}</button>}
      </div>
      {msg && <p id={`err-${a.id}`} role="alert" className="text-micro tracking-normal text-quality-danger">{msg}</p>}
    </div>
  );
  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`in-${a.id}`} className="font-medium text-ink">{a.label}</label>
      {changed ? (
        <span className="inline-flex items-center gap-1 text-micro tracking-normal text-prov-assumption">
          <span aria-hidden className="inline-block h-1 w-1 rotate-45 bg-prov-assumption" /> changed from official {a.default.toFixed(dp)}
        </span>
      ) : <span className="text-micro tracking-normal text-muted">official value</span>}
    </div>
  );
  const whyBlock = (
    <div className="flex flex-col gap-1">
      <button onClick={() => setWhy((w) => !w)} aria-expanded={why} className="inline-flex items-center gap-1 self-start text-micro tracking-normal text-accent hover:underline">
        <Chevron open={why} /> Why this value
      </button>
      {why && (
        <div className="flex flex-col gap-1 pl-5">
          <p className="text-small text-ink2">{a.rationale}</p>
          <p className="text-micro tracking-normal text-muted">{a.source}</p>
          {a.conservative != null && a.severe != null && (
            <p className="tabular text-micro tracking-normal text-muted">Plausible range: {a.conservative} (Conservative) to {a.severe} (Severe). Judgment, not data.</p>
          )}
        </div>
      )}
    </div>
  );

  if (card) {
    return (
      <div id={a.id} className={`flex scroll-mt-9 flex-col gap-3 rounded-lg border p-4 shadow-card ${changed ? "border-prov-assumption bg-quality-warning-soft" : "hairline bg-surface"}`}>
        {header}
        {inputs}
        {sens && <ImpactBar s={sens} now={now} maxSwing={maxSwing} />}
        {sens?.key_reason && <p className="text-micro tracking-normal text-ink2">{sens.key_reason}</p>}
        {whyBlock}
      </div>
    );
  }
  return (
    <li id={a.id} className={`grid scroll-mt-9 grid-cols-1 gap-x-6 gap-y-2 border-b hairline px-4 py-3 last:border-b-0 md:grid-cols-[1fr_17rem] ${changed ? "bg-quality-warning-soft" : ""}`}>
      <div className="flex flex-col gap-1">
        {header}
        {sens ? <ImpactBar s={sens} now={now} maxSwing={maxSwing} /> : <p className="text-micro tracking-normal text-muted">No effect on ₹ figures.</p>}
        {whyBlock}
      </div>
      {inputs}
    </li>
  );
}
