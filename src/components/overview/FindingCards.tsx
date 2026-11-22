import Link from "next/link";
import type { SummaryResponse } from "@/lib/api";
import { pageTitle } from "@/components/shell/navItems";

/** Three short editorial cards, each linking to the page that explains it. */
export function FindingCards({ findings }: { findings: SummaryResponse["findings"] }) {
  return (
    <section aria-label="Key findings" data-tour="findings" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {findings.slice(0, 3).map((f) => (
        <Link key={f.text} href={f.href}
          className="group flex flex-col gap-3 rounded-lg border border-border-strong bg-surface p-5 shadow-card transition-colors hover:border-ink">
          <p className="text-micro uppercase text-muted">{f.kicker}</p>
          <p className="font-serif text-h2 leading-snug text-ink">{f.text}</p>
          <span className="mt-auto text-small font-medium text-accent group-hover:underline">Open {pageTitle(f.href.split("#")[0]).toLowerCase()} →</span>
        </Link>
      ))}
    </section>
  );
}
