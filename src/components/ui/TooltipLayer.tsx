"use client";
import { useEffect } from "react";
import { useTip } from "@/lib/tooltip";

export function TooltipLayer() {
  const tip = useTip((s) => s.tip);
  const hide = useTip((s) => s.hide);
  useEffect(() => {
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hide]);
  if (!tip) return null;
  return (
    <div role="tooltip"
      className="pointer-events-none fixed z-[60] max-w-[22rem] whitespace-pre-line rounded-sm bg-accent px-2 py-1 text-micro tracking-normal text-surface shadow-lift"
      style={{
        left: `clamp(var(--hz-space-2), ${tip.x}px, calc(100vw - var(--hz-space-2)))`,
        top: tip.y,
        transform: `translate(-50%, ${tip.below ? "var(--hz-space-2)" : "calc(-100% - var(--hz-space-2))"})`,
      }}>
      {tip.text}
    </div>
  );
}
