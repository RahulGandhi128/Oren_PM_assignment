"use client";
import { create } from "zustand";

/** One tooltip for the whole app, drawn in a fixed layer so table/card overflow never clips it. */
type Tip = { text: string; x: number; y: number; below: boolean } | null;
export const useTip = create<{ tip: Tip; show: (el: Element, text: string) => void; hide: () => void }>()((set) => ({
  tip: null,
  show: (el, text) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 140;
    set({ tip: { text, x: r.left + r.width / 2, y: below ? r.bottom : r.top, below } });
  },
  hide: () => set({ tip: null }),
}));

/** Spread onto any element to give it the shared tooltip (hover and keyboard focus). */
export function tipProps(text: string) {
  return {
    onMouseEnter: (e: React.MouseEvent) => useTip.getState().show(e.currentTarget, text),
    onMouseLeave: () => useTip.getState().hide(),
    onFocus: (e: React.FocusEvent) => useTip.getState().show(e.currentTarget, text),
    onBlur: () => useTip.getState().hide(),
  };
}
