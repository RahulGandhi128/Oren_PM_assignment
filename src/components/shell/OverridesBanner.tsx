"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { activeSet, usePresets } from "@/lib/presets";
import { useHorizonStore } from "@/lib/store";

/** Amber strip under the top bar whenever the numbers are not the official (Central) set. */
export function OverridesBanner() {
  const overrides = useHorizonStore((s) => s.overrides);
  const reset = useHorizonStore((s) => s.resetOverrides);
  const presets = usePresets();
  const [mounted, setMounted] = useState(false); // sessionStorage is client-only; avoid a hydration mismatch
  useEffect(() => setMounted(true), []);
  const n = Object.keys(overrides).length;
  if (!mounted || n === 0) return null;
  const set = activeSet(overrides, presets);
  const what = set === "conservative" ? "the Conservative preset" : set === "severe" ? "the Severe preset"
    : `${n} changed assumption${n === 1 ? "" : "s"}`;
  return (
    <div role="status" className="no-print border-b border-prov-assumption bg-quality-warning-soft">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-gutter py-2 text-small text-ink">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-2 w-2 rotate-45 bg-prov-assumption" />
          <span><strong className="font-medium">These are not the official numbers.</strong> Every ₹ figure uses {what} (this tab only).</span>
        </span>
        <Link href="/methodology#assumptions" className="text-accent underline-offset-4 hover:underline">See what changed</Link>
        <button onClick={reset} className="font-medium text-ink underline underline-offset-4 hover:text-accent">Back to official set</button>
      </div>
    </div>
  );
}
