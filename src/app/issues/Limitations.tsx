import Link from "next/link";

/** Scope limits of v1. Internal: marked for the development team, not for board readers. */
const ITEMS: [string, React.ReactNode][] = [
  ["Transition risk is not in v1", <>India&apos;s Carbon Credit Trading Scheme now sets emission-intensity targets for cement, and missing them will cost money. The plant register has current Scope 1 emissions, but the cost also needs each plant&apos;s notified intensity target and a credit-price path, neither of which the brief supplies. It is the first candidate for v2; the sources are listed on the <Link href="/data" className="text-accent hover:underline">Data page</Link>.</>],
  ["One climate scenario only", "The climate models follow one high-emissions pathway (CMIP6 HighResMIP), so there is no scenario switch. Lower-emission futures would show smaller changes."],
  ["2040 water stress is estimated", "Aqueduct publishes 2030 and 2050. 2040 is the midpoint of the two, using the business-as-usual scenario (SSP3-7.0)."],
  ["Rail and road routes are not modelled", "A flood on the line between a kiln and a grinding unit would also stop supply. v1 only looks at the plants themselves."],
  ["Climate data is not bias-corrected", <>Model output is used as is. Heat-day counts look high, and one model reports impossible temperatures. See the data problems above.</>],
];

export function ConfidentialTag() {
  return (
    <span className="inline-flex items-center gap-2 rounded-sm border border-dashed border-quality-danger bg-quality-danger-soft px-2 py-1 font-mono text-micro uppercase text-quality-danger">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      </svg>
      Confidential · For development team only
    </span>
  );
}

export function Limitations() {
  return (
    <section id="limitations" aria-labelledby="lim-h"
      className="flex scroll-mt-9 flex-col gap-4 rounded-md border border-dashed border-border-strong bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="lim-h" className="text-h3 font-medium text-ink">Limitations and not in v1</h2>
          <p className="font-mono text-micro text-muted">scope/v1 · {ITEMS.length} items · not for board distribution</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        {ITEMS.map(([t, d], i) => (
          <div key={t} className="border-t hairline pt-3">
            <dt className="flex items-baseline justify-between gap-3 font-medium text-ink">
              {t}
              <span className="shrink-0 font-mono text-micro font-normal text-muted">LIM-{String(i + 1).padStart(2, "0")}</span>
            </dt>
            <dd className="mt-1 text-small text-ink2">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
