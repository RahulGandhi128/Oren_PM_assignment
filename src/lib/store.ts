"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type HazardLens = "total" | "heat" | "water" | "flood" | "coastal";

type State = {
  hazardLens: HazardLens;
  /** Assumption overrides by id. Session-only (sessionStorage in this tab); never sent anywhere to be saved. */
  overrides: Record<string, number>;
  setHazardLens: (l: HazardLens) => void;
  setOverride: (id: string, value: number, defaultValue: number) => void;
  setOverrides: (o: Record<string, number>) => void;
  resetOverride: (id: string) => void;
  resetOverrides: () => void;
};

// Both years are always shown; the Now / 2040 tabs (lib/when.ts) pick which one leads.
export const useHorizonStore = create<State>()(
  persist(
    (set) => ({
      hazardLens: "total",
      overrides: {},
      setHazardLens: (hazardLens) => set({ hazardLens }),
      setOverride: (id, value, defaultValue) =>
        set((s) => {
          const next = { ...s.overrides };
          if (value === defaultValue) delete next[id];
          else next[id] = value;
          return { overrides: next };
        }),
      setOverrides: (overrides) => set({ overrides }),
      resetOverride: (id) => set((s) => { const next = { ...s.overrides }; delete next[id]; return { overrides: next }; }),
      resetOverrides: () => set({ overrides: {} }),
    }),
    {
      name: "horizon-overrides",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ overrides: s.overrides }),
    },
  ),
);

export const useOverrides = () => useHorizonStore((s) => s.overrides);
