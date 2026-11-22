"use client";
import { create } from "zustand";

/** Report: a one-page print layout, prepared on request from the ⋯ menu, then sent to the print dialog. */
export const useBoardPack = create<{ requested: number; request: () => void }>()((set) => ({
  requested: 0,
  request: () => set((s) => ({ requested: s.requested + 1 })),
}));
