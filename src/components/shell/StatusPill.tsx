"use client";
import Link from "next/link";
import { useAssumptionSet } from "@/lib/assumptionSet";
import { dataDateShort } from "@/lib/health";

/** "Central · data 21 Nov": which assumption set is live and how fresh the data is. */
export function StatusPill() {
  const s = useAssumptionSet();
  const official = !s || s.set === "central";
  return (
    <Link href="/methodology#assumptions" data-tour="status-pill" aria-label={`${s?.label ?? "Assumption"} set, data ${dataDateShort(s?.health.data_as_of)}. Open assumptions.`}
      className={`hidden items-center gap-2 rounded-pill border px-3 py-1 text-small transition-colors sm:inline-flex ${official ? "border-border-strong bg-surface text-ink2 hover:border-ink2" : "border-quality-warning bg-quality-warning-soft text-ink"}`}>
      <span aria-hidden className={`inline-block h-2 w-2 rounded-pill ${official ? "bg-delta-down-text" : "bg-quality-warning"}`} />
      {s ? s.label : "…"}
      <span className="text-muted">· data {dataDateShort(s?.health.data_as_of)}</span>
    </Link>
  );
}
