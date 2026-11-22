"use client";
import { useAssumptionSet } from "@/lib/assumptionSet";
import { dataDateLong } from "@/lib/health";
import { useVersionFor } from "@/lib/savedVersions";

/** Printed audit line: which assumption set and data version produced the numbers on this page. */
export function AssumptionSetStamp({ className = "" }: { className?: string }) {
  const s = useAssumptionSet();
  const v = useVersionFor(s?.hash);
  if (!s) return <p className={`text-micro tracking-normal text-muted ${className}`}>Assumptions …</p>;
  return (
    <p className={`text-micro tracking-normal text-ink2 ${className}`}>
      Assumptions: <span className="font-medium text-ink">{s.label}</span>
      {v ? <> · version {v.version}, saved by {v.by}</> : s.set !== "central" ? <> · not the official set, not saved</> : null}
      {" "}· data {dataDateLong(s.health.data_as_of)} · ref <span className="font-mono">{s.id}</span>
    </p>
  );
}
