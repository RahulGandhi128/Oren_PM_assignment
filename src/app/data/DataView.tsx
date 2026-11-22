"use client";
import { useEffect, useState } from "react";
import { api, type Catalog, type CatalogSource } from "@/lib/api";

const ACCESS_STYLE: Record<CatalogSource["access"], string> = {
  API: "border-accent text-accent",
  Download: "border-ink2 text-ink2",
  "Account needed": "border-quality-warning text-quality-warning",
  "Manual PDF": "border-dashed border-ink2 text-ink2",
  "Provided file": "border-muted text-muted",
};
const STATUS_STYLE: Record<CatalogSource["status"], string> = {
  "Used in v1": "bg-prov-data text-surface",
  Optional: "bg-prov-derived text-surface",
  v2: "border border-dashed border-prov-assumption text-prov-assumption",
};

const kb = (b: number | null | undefined) => (b == null ? "" : b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);

export function DataView() {
  const [c, setC] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.catalog().then(setC).catch((e) => setError(String(e.message ?? e))); }, []);

  const v1 = c?.sources.filter((s) => s.group === "v1") ?? [];
  const v2 = c?.sources.filter((s) => s.group === "v2") ?? [];
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <p className="text-micro uppercase text-muted">Data · for developers</p>
        <h1 className="max-w-[32ch] font-display text-h1">Every source, how to get it, what comes back, and which file it becomes.</h1>
        <p className="max-w-[70ch] text-body text-ink2">
          The app never calls these at runtime. The offline pipeline in <code className="font-mono text-small">backend/pipeline/</code> fetches
          each source once and commits the result; <code className="font-mono text-small">npm run data:build</code> rebuilds everything from the raw files.
          {c && <> Catalogue built {c.generated_at.slice(0, 10)}; links checked {c.links_checked}.</>}
        </p>
      </header>
      {error && <p className="text-small text-prov-placeholder">Could not load the catalogue: {error}</p>}
      {!c && !error && <div className="h-[16rem] animate-pulse rounded-lg bg-border" />}
      {c && (
        <>
          <Group title="Physical risk (v1)" note="Used to build the numbers in this prototype." items={v1} />
          <Group title="Transition risk (v2)" note="Not used yet. The first candidate for v2: the cost of India's carbon market for cement." items={v2} />
        </>
      )}
    </div>
  );
}

function Group({ title, note, items }: { title: string; note: string; items: CatalogSource[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-h2">{title}</h2>
        <p className="text-small text-muted">{note}</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {items.map((s) => <Card key={s.id} s={s} />)}
      </div>
    </section>
  );
}

function Card({ s }: { s: CatalogSource }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(s.request.replace(/^GET /, "")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });
  return (
    <article id={s.id} className="flex scroll-mt-9 flex-col gap-3 rounded-lg border hairline bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-h3 text-ink">{s.name}</h3>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-pill border px-2 py-1 text-micro uppercase ${ACCESS_STYLE[s.access]}`}>{s.access}</span>
          <span className={`rounded-pill px-2 py-1 text-micro uppercase ${STATUS_STYLE[s.status]}`}>{s.status}</span>
        </div>
      </div>
      <p className="text-small text-ink2">{s.purpose}</p>

      {s.links.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-small">
          {s.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">{l.label} ↗</a>)}
        </div>
      )}

      <Block label="Example request" action={s.request.startsWith("GET ") ? <button onClick={copy} className="text-micro tracking-normal text-accent hover:underline">{copied ? "Copied" : "Copy URL"}</button> : null}>
        <pre className="max-h-[8rem] overflow-auto whitespace-pre-wrap break-all rounded-sm bg-surface2 p-3 font-mono text-micro tracking-normal text-ink">{s.request}</pre>
      </Block>

      <Block label="What comes back">
        {s.sample ? (
          <pre className="max-h-[14rem] overflow-auto rounded-sm bg-surface2 p-3 font-mono text-micro tracking-normal text-ink">{s.sample}</pre>
        ) : (
          <p className="text-small text-muted">Not fetched yet. Download it when v2 starts; no sample values are shown rather than invented ones.</p>
        )}
      </Block>

      <Block label="Files in the repo">
        {s.outputs.length ? (
          <ul className="flex flex-col gap-1">
            {s.outputs.map((o) => (
              <li key={o.path} className="flex flex-wrap items-baseline gap-x-2 text-small">
                <span aria-label={o.exists ? "exists" : "not created yet"} className={o.exists ? "text-prov-data" : "text-muted"}>{o.exists ? "✓" : "○"}</span>
                <code className="break-all font-mono text-micro tracking-normal text-ink">{o.path}</code>
                <span className="text-micro tracking-normal text-muted">{o.role}{o.bytes ? ` · ${kb(o.bytes)}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-small text-muted">None. Reference reading only.</p>}
        {s.scripts.length > 0 && (
          <p className="mt-1 text-micro tracking-normal text-muted">Scripts: {s.scripts.map((x, i) => <code key={x} className="font-mono">{i ? ", " : ""}{x}</code>)}</p>
        )}
      </Block>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
        <dt className="text-muted">Last refreshed</dt><dd className="tabular text-ink">{s.last_refreshed ?? "Not yet"}</dd>
        <dt className="text-muted">Licence</dt><dd className="text-ink">{s.licence}</dd>
      </dl>

      {s.caveats.length > 0 && (
        <Block label="Caveats">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-small text-ink2">
            {s.caveats.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </Block>
      )}
    </article>
  );
}

function Block({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between"><p className="text-micro uppercase text-muted">{label}</p>{action}</div>
      {children}
    </div>
  );
}
