"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TOUR_STEPS, useTour } from "@/lib/tour";

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;      // spotlight padding around the element
const GAP = 12;     // spotlight → card
const EDGE = 16;    // viewport gutter
const FIND_MS = 5000;

const near = (a: Box, b: Box) =>
  Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
const topBarHeight = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hz-layout-top-bar-height")) || 56;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Spotlight + step card for the guided tour. Mounted once in the root layout. */
export function TourLayer() {
  const { active, index, next, back, end } = useTour();
  const pathname = usePathname();
  const router = useRouter();
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0];
  const onPage = !step.page || pathname === step.page;

  const [mounted, setMounted] = useState(false);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState({ w: 352, h: 220 });
  const cardSize = useRef(card);
  cardSize.current = card;
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // 1. Go to the step's page.
  useEffect(() => {
    if (active && step.page && pathname !== step.page) router.push(step.page);
  }, [active, step.page, pathname, router]);

  // 2. Find the element (pages load data first, so retry for a while), then scroll it into view.
  //    Pages keep growing as data arrives, so placement is re-checked a few times after arriving.
  useEffect(() => {
    setEl(null); setBox(null); setReady(false);
    if (!active || !onPage) return;
    if (!step.target) { setReady(true); return; }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t0 = performance.now();
    const place = (found: HTMLElement) => {
      const r = found.getBoundingClientRect();
      const tb = topBarHeight();
      const vh = window.innerHeight;
      const need = cardSize.current.h + GAP + EDGE + PAD; // room the card needs above or below
      const inView = r.top >= tb + PAD && r.bottom <= vh - PAD;
      const room = vh - r.bottom >= need || r.top - tb - PAD >= need;
      if (inView && room) return;
      // Element just under the top bar, then centred in whatever space the card leaves.
      const want = tb + PAD + 16 + Math.max(0, (vh - tb - PAD - 16 - r.height - need) / 2);
      window.scrollTo({ top: window.scrollY + r.top - want, behavior: reducedMotion() ? "auto" : "smooth" });
    };
    const look = () => {
      if (cancelled) return;
      const found = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (found && found.getClientRects().length === 0) { setReady(true); return; } // hidden at this screen size: centred card
      if (found && found.getBoundingClientRect().height > 0) {
        place(found);
        for (const ms of [450, 1100, 2200]) timers.push(setTimeout(() => !cancelled && place(found), ms));
        setEl(found); setReady(true);
        return;
      }
      if (performance.now() - t0 > FIND_MS) { setReady(true); return; } // not on screen: centred card
      timers.push(setTimeout(look, 100));
    };
    look();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [active, index, onPage, step.target]);

  // 3. Follow the element through scrolling, resizing and late layout shifts.
  useEffect(() => {
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const b = { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
      setBox((prev) => (prev && near(prev, b) ? prev : b));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [el]);

  // Card size, for placement.
  useLayoutEffect(() => {
    const c = cardRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setCard({ w: c.offsetWidth, h: c.offsetHeight }));
    ro.observe(c);
    return () => ro.disconnect();
  }, [active, ready]);

  // Keyboard: → / Enter next, ← back, Esc skip.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); end(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, back, end]);

  useEffect(() => { if (active && ready) nextRef.current?.focus({ preventScroll: true }); }, [active, ready, index]);

  if (!mounted || !active) return null;

  const last = index === TOUR_STEPS.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  let pos: { top: number; left: number };
  if (box) {
    const below = vh - (box.top + box.height), above = box.top - EDGE;
    if (below >= card.h + GAP + EDGE) pos = { top: box.top + box.height + GAP, left: clamp(box.left, EDGE, vw - card.w - EDGE) };
    else if (above >= card.h + GAP) pos = { top: box.top - GAP - card.h, left: clamp(box.left, EDGE, vw - card.w - EDGE) };
    else if (vw - (box.left + box.width) >= card.w + GAP + EDGE) pos = { left: box.left + box.width + GAP, top: clamp(box.top, EDGE, vh - card.h - EDGE) };
    else if (box.left >= card.w + GAP + EDGE) pos = { left: box.left - GAP - card.w, top: clamp(box.top, EDGE, vh - card.h - EDGE) };
    else pos = { top: vh - card.h - EDGE, left: vw - card.w - EDGE }; // no free side: bottom-right corner
  } else {
    pos = { top: Math.max(EDGE, (vh - card.h) / 2), left: Math.max(EDGE, (vw - card.w) / 2) };
  }
  const move = { transition: reducedMotion() ? "none" : "top var(--hz-motion-base) var(--hz-ease), left var(--hz-motion-base) var(--hz-ease), width var(--hz-motion-base) var(--hz-ease), height var(--hz-motion-base) var(--hz-ease)" };

  return (
    <div className="no-print">
      {/* Blocks clicks on the page during the tour; dims it when nothing is highlighted. Wheel scrolling still works. */}
      <div aria-hidden className={`fixed inset-0 z-[60] ${box ? "" : "bg-scrim"}`} />
      {box && (
        <div aria-hidden className="pointer-events-none fixed z-[61] rounded-lg shadow-spotlight ring-2 ring-surface"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, ...move }} />
      )}
      {ready && (
        <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body"
          className="fixed z-[62] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border border-border-strong bg-surface p-5 shadow-lift"
          style={{ top: pos.top, left: pos.left, ...move }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-micro uppercase text-muted">Step {index + 1} of {TOUR_STEPS.length}</span>
            <button onClick={end} aria-label="Close tour" className="-mr-1 rounded-md p-1 text-muted transition-colors hover:bg-surface2 hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <h2 id="tour-title" className="text-h3 font-semibold text-ink">{step.title}</h2>
            <p id="tour-body" className="text-small text-ink2">{step.body}</p>
          </div>
          <div className="h-1 overflow-hidden rounded-pill bg-chart-grid" aria-hidden>
            <div className="h-full rounded-pill bg-accent" style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%`, ...move }} />
          </div>
          <div className="flex items-center justify-between gap-3">
            {last ? <span /> : (
              <button onClick={end} className="text-small text-muted underline-offset-4 transition-colors hover:text-ink hover:underline">Skip tour</button>
            )}
            <div className="flex gap-2">
              {index > 0 && (
                <button onClick={back} className="rounded-pill border border-border-strong px-4 py-2 text-small font-medium text-ink transition-colors hover:border-ink2">Back</button>
              )}
              <button ref={nextRef} onClick={next} className="rounded-pill bg-accent px-4 py-2 text-small font-medium text-surface transition-opacity hover:opacity-90">
                {index === 0 ? "Start" : last ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
