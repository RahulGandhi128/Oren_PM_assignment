"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Which year leads the page. Both years stay on screen; this only picks the emphasised one. */
export type When = "now" | "2040";
export const WHEN_LABEL: Record<When, string> = { now: "Now", "2040": "2040" };

const useWhenStore = create<{ when: When; setWhen: (w: When) => void }>()(
  persist((set) => ({ when: "now", setWhen: (when) => set({ when }) }), {
    name: "horizon-when",
    storage: createJSONStorage(() => sessionStorage),
  }),
);

export function useWhen(): [When, (w: When) => void] {
  const when = useWhenStore((s) => s.when);
  const setWhen = useWhenStore((s) => s.setWhen);
  return [when, setWhen];
}
