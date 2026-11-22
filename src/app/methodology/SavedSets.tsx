"use client";
import { useRef, useState } from "react";
import { api, ApiError, type SummaryResponse } from "@/lib/api";
import { useAssumptionDefaults } from "@/lib/assumptions";
import { buildSetFile, canonicalSet, parseSetFile, resolveValues, useAssumptionSet } from "@/lib/assumptionSet";
import { dataDateShort } from "@/lib/health";
import { sha256Hex } from "@/lib/sha256";
import { savedAtText, useSavedVersions, useVersionFor } from "@/lib/savedVersions";
import { useHorizonStore } from "@/lib/store";

type Msg = { tone: "ok" | "warn" | "error"; text: string } | null;
const TONE: Record<"ok" | "warn" | "error", string> = {
  ok: "border-border bg-surface2 text-ink",
  warn: "border-quality-warning bg-quality-warning-soft text-ink",
  error: "border-quality-danger bg-quality-danger-soft text-ink",
};

/** Saved versions (beta): save the live assumption set to a file, or load one back. */
export function SavedSets({ live, onLoaded }: { live: SummaryResponse | null; onLoaded?: () => void }) {
  const info = useAssumptionSet();
  const defaults = useAssumptionDefaults();
  const setOverrides = useHorizonStore((s) => s.setOverrides);
  const record = useSavedVersions((s) => s.record);
  const remember = useSavedVersions((s) => s.remember);
  const current = useVersionFor(info?.hash);
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    if (!info) return;
    const v = record(info.hash, info.label);
    const results = live ? { revenue_at_risk_cr: { now: live.today.revenue_at_risk.value, "2040": live.future.revenue_at_risk.value } } : undefined;
    const file = buildSetFile(info, { version: v.version, by: v.by, at: v.savedAt }, results);
    const blob = new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horizon-assumptions-v${v.version}-${info.label.toLowerCase()}.json`;
    document.body.appendChild(a); // Firefox needs the link in the document
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setMsg({ tone: "ok", text: `Version ${v.version} saved to your computer.` });
  };

  const load = async (fileObj: File) => {
    if (!defaults || !info) return;
    setBusy(true);
    try {
      const parsed = parseSetFile(await fileObj.text(), defaults, info.health);
      if (!parsed.ok) { setMsg({ tone: "error", text: parsed.error }); return; }
      const { file, overrides, ignored, missing, dataMatches } = parsed;
      try { await api.summary(overrides); } catch (e) {
        setMsg({ tone: "error", text: `This version could not be loaded. ${e instanceof ApiError ? e.message : ""}`.trim() });
        return;
      }
      const untouched = sha256Hex(canonicalSet(file.assumptions, { data_generated_at: file.data?.generated_at ?? null, data_as_of: file.data?.as_of ?? null })) === file.set_hash;
      const liveHash = sha256Hex(canonicalSet(resolveValues(defaults, overrides), info.health));
      setOverrides(overrides);
      onLoaded?.();

      const name = file.saved_version ? `Version ${file.saved_version}` : "Saved version";
      const by = file.saved_by ? ` by ${file.saved_by}` : "";
      if (untouched && file.saved_version) {
        remember({ version: file.saved_version, hash: file.set_hash, label: file.label, savedAt: file.saved_at, by: file.saved_by ?? "Unknown" });
      }
      const notes: string[] = [];
      if (!untouched) notes.push("The file was changed after it was saved.");
      if (!dataMatches) notes.push("The data has been updated since then, so some numbers may differ.");
      if (ignored.length || missing.length) notes.push("Some assumptions have changed since then; new ones use their default value.");
      if (notes.length === 0 && liveHash === file.set_hash) setMsg({ tone: "ok", text: `${name}${by} loaded.` });
      else setMsg({ tone: "warn", text: `${name}${by} loaded. ${notes.join(" ")}` });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div data-tour="saved-versions" className="flex flex-col gap-4 rounded-lg border hairline bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-h3 font-semibold text-ink">Saved versions</h3>
          <span className="rounded-pill bg-accent px-2 py-[0.125rem] text-micro font-semibold uppercase text-surface">Beta</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={!info}
            className="rounded-pill bg-accent px-4 py-2 text-small font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50">
            Save this set
          </button>
          <button onClick={() => input.current?.click()} disabled={!info || busy}
            className="rounded-pill border border-ink px-4 py-2 text-small font-medium text-ink transition-colors hover:bg-ink hover:text-bg disabled:opacity-50">
            {busy ? "Loading…" : "Load a set"}
          </button>
          <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="Choose a saved version"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); }} />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-md bg-surface2 px-3 py-3">
        <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-pill ${current ? "bg-delta-down-text" : "bg-muted"}`} />
        {current ? (
          <p className="text-small text-ink">
            <span className="font-semibold">Version {current.version}</span>
            <span className="text-ink2"> · {current.label} · saved by {current.by} · {savedAtText(current.savedAt)}</span>
          </p>
        ) : (
          <p className="text-small text-ink">
            <span className="font-semibold">Not saved yet</span>
            <span className="text-ink2"> · {info?.label ?? "…"} · data {dataDateShort(info?.health.data_as_of)}</span>
          </p>
        )}
      </div>

      {msg && <p role="status" className={`rounded-md border px-3 py-2 text-small ${TONE[msg.tone]}`}>{msg.text}</p>}

      <p className="flex flex-wrap items-center gap-2 text-small text-ink2">
        <span className="rounded-pill border border-dashed border-border-strong px-2 py-[0.125rem] text-micro font-semibold uppercase text-muted">Upcoming</span>
        Shared versions, approvals and a full change log, with user accounts.
      </p>
    </div>
  );
}
