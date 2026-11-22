"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Issue, Severity } from "@/lib/issues";
import { api, type Plant } from "@/lib/api";
import { SEVERITY_LABEL, SeverityIcon } from "@/components/data/QualityFlag";
import { ConfidentialTag, Limitations } from "./Limitations";

const ORDER: Severity[] = ["danger", "warning", "info"];
const GROUP_TITLE: Record<Severity, string> = {
  danger: "Data problems",
  warning: "Warnings",
  info: "Notes",
};
const GROUP_HINT: Record<Severity, string> = {
  danger: "A value is missing, a placeholder, or clearly wrong in the source. Read before using the affected numbers.",
  warning: "The value is usable but has a known limitation. Use with care.",
  info: "Context that helps read the numbers.",
};
const CARD_TINT: Record<Severity, string> = {
  danger: "border-quality-danger bg-quality-danger-soft",
  warning: "border-quality-warning bg-quality-warning-soft",
  info: "border-border bg-surface",
};
const METRIC_LABEL: Record<string, string> = {
  "heat_days_40c.today": "Days ≥ 40 °C (Today)",
  "heat_days_40c.2040": "Days ≥ 40 °C (2040)",
  heat_series: "Heat time series",
  "rx1day_mm.today": "Wettest day (Today)",
  "rx1day_mm.2040": "Wettest day (2040)",
  rx1day_change_pct: "Change in wettest day",
  "water_stress.today": "Water stress (Today)",
  "water_stress.2040": "Water stress (2040)",
  riverine_flood: "Riverine flood",
  coastal_flood: "Coastal flood",
};

export function IssuesView() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [plants, setPlants] = useState<Map<string, Plant>>(new Map());

  useEffect(() => {
    fetch("/api/issues").then((r) => r.json()).then((d) => { setIssues(d.issues); setGenerated(d.generated_at); });
    api.plants().then((ps) => setPlants(new Map(ps.map((p) => [p.id, p]))));
  }, []);

  // Anchor links (#ID) target cards rendered after fetch: scroll once they exist.
  useEffect(() => {
    if (issues && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [issues]);

  const counts = Object.fromEntries(ORDER.map((s) => [s, issues?.filter((i) => i.severity === s).length ?? 0])) as Record<Severity, number>;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex max-w-[60ch] flex-col gap-3">
        <div><ConfidentialTag /></div>
        <p className="text-micro uppercase text-muted">Issues &amp; notes</p>
        <h1 className="font-display text-h1">What to know before you trust these numbers.</h1>
        <p className="text-body text-ink2">
          Horizon uses source data exactly as received. When something in it looks wrong or incomplete, we don&apos;t
          correct it. We list it here, with the plants and numbers it affects and how we handle it.
        </p>
      </header>

      <section aria-label="Legend" data-tour="issues-legend" className="flex flex-wrap gap-5 rounded-md border hairline bg-surface p-4 text-small">
        {ORDER.map((s) => (
          <div key={s} className="flex max-w-[34ch] items-start gap-2">
            <SeverityIcon severity={s} size={16} />
            <div>
              <p className="font-medium text-ink">
                {SEVERITY_LABEL[s]} <span className="tabular text-muted">({counts[s]})</span>
              </p>
              <p className="text-micro tracking-normal text-ink2">{GROUP_HINT[s]}</p>
            </div>
          </div>
        ))}
      </section>

      {!issues && <div className="h-9 animate-pulse rounded-md bg-border" />}

      {issues &&
        ORDER.filter((s) => counts[s] > 0).map((s) => (
          <section key={s} className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-h3 font-medium">
              <SeverityIcon severity={s} size={16} /> {GROUP_TITLE[s]}
            </h2>
            {issues.filter((i) => i.severity === s).map((i) => (
              <article id={i.id} key={i.id} className={`issue-card scroll-mt-9 rounded-md border-l-4 border hairline p-5 ${CARD_TINT[s]}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-h3 font-medium text-ink">{i.title}</h3>
                  <span className="font-mono text-micro text-muted">{i.id}</span>
                </div>
                <p className="mt-2 max-w-[80ch] text-body text-ink2">{i.detail}</p>
                <p className="mt-3 max-w-[80ch] text-small text-ink">
                  <span className="font-medium">How we handle it: </span>
                  {i.handling}
                </p>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
                  <dt className="text-muted">Plants</dt>
                  <dd className="flex flex-wrap gap-x-3">
                    {i.plants.map((pid) => (
                      <Link key={pid} href={`/plants/${pid}`} className="text-accent underline-offset-4 hover:underline">
                        {plants.get(pid)?.short_name ?? pid}
                      </Link>
                    ))}
                  </dd>
                  {i.models.length > 0 && (<><dt className="text-muted">Models</dt><dd className="font-mono text-small">{i.models.join(", ")}</dd></>)}
                  <dt className="text-muted">Affects</dt>
                  <dd>{i.metrics.length ? i.metrics.map((m) => METRIC_LABEL[m] ?? m).join(" · ") : "Nothing used in v1"}</dd>
                  <dt className="text-muted">Source</dt>
                  <dd className="font-mono text-small">{i.source}</dd>
                </dl>
              </article>
            ))}
          </section>
        ))}

      <Limitations />

      {generated && (
        <p className="text-micro tracking-normal text-muted">
          Generated by <span className="font-mono">backend/pipeline/build_hazards.py</span> from the QA report on{" "}
          {new Date(generated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
        </p>
      )}
    </div>
  );
}
