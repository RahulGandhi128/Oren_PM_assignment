"use client";
import { useEffect, useState } from "react";

type Health = { status: string; data_generated_at: string | null };

export function ApiHealth() {
  const [state, setState] = useState<{ ok: boolean; body?: Health; error?: string } | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then(async (r) => (r.ok ? setState({ ok: true, body: await r.json() }) : setState({ ok: false, error: `HTTP ${r.status}` })))
      .catch((e) => setState({ ok: false, error: String(e) }));
  }, []);
  return (
    <div className="inline-flex self-start items-center gap-3 rounded-md border hairline bg-surface px-4 py-3 shadow-card">
      <span className="text-micro uppercase text-muted">Python API</span>
      {state === null ? (
        <span className="text-small text-muted">checking…</span>
      ) : state.ok ? (
        <span className="font-mono text-small text-ink">
          {state.body?.status} · data_generated_at: {state.body?.data_generated_at ?? "none yet (Phase 2)"}
        </span>
      ) : (
        <span className="font-mono text-small text-prov-placeholder">unreachable: {state.error}</span>
      )}
    </div>
  );
}
