"use client";
import { useEffect, useState } from "react";
import { markTourSeen, tourSeen, useTour } from "@/lib/tour";

/** Top-bar button that starts the guided tour. */
export function TourButton() {
  const start = useTour((s) => s.start);
  return (
    <button onClick={start} data-tour="tour-button" aria-label="Start the guided tour"
      className="inline-flex h-[2.25rem] items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-small font-medium text-ink transition-colors hover:bg-surface2">
      <CompassIcon />
      <span className="hidden lg:inline">Tour</span>
    </button>
  );
}

/** One-time "New here?" card, bottom right, until the tour is started or dismissed. */
export function TourPrompt() {
  const active = useTour((s) => s.active);
  const start = useTour((s) => s.start);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (tourSeen()) return;
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!show || active) return null;
  const dismiss = () => { markTourSeen(); setShow(false); };
  return (
    <div role="dialog" aria-labelledby="tour-prompt-h"
      className="no-print fixed bottom-5 right-5 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border border-border-strong bg-surface p-4 shadow-lift">
      <div className="flex items-start gap-3">
        <span className="mt-[0.125rem] text-accent"><CompassIcon size={18} /></span>
        <div className="flex flex-col gap-1">
          <p id="tour-prompt-h" className="text-small font-semibold text-ink">New to Horizon?</p>
          <p className="text-small text-ink2">Take a two-minute tour of the main screens and controls.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={dismiss} className="rounded-pill px-3 py-2 text-small font-medium text-muted transition-colors hover:text-ink">Not now</button>
        <button onClick={() => { setShow(false); start(); }} className="rounded-pill bg-accent px-4 py-2 text-small font-medium text-surface transition-opacity hover:opacity-90">Start tour</button>
      </div>
    </div>
  );
}

function CompassIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M10.6 5.4 9.1 9.1 5.4 10.6 6.9 6.9z" />
    </svg>
  );
}
