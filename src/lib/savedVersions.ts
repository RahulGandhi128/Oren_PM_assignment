"use client";
// Saved versions (beta). A numbered record of each assumption set saved from this browser, so the app can
// say "Version 3 · saved by Meera Iyer". The saved JSON file is the real record; this list only remembers
// which sets have been saved here. Shared versions and sign-in come with user accounts (v2).
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** No accounts in v1: the tool has one operator (SPEC: primary user). */
export const CURRENT_USER = "Meera Iyer";

export type SavedVersion = { version: number; hash: string; label: string; savedAt: string; by: string };

type State = {
  versions: SavedVersion[];
  /** Record a save. Saving an already-saved set keeps its version number. */
  record: (hash: string, label: string) => SavedVersion;
  /** Remember a version that came in from a loaded file. */
  remember: (v: SavedVersion) => void;
};

export const useSavedVersions = create<State>()(
  persist(
    (set, get) => ({
      versions: [],
      record: (hash, label) => {
        const existing = get().versions.find((v) => v.hash === hash);
        const v: SavedVersion = existing
          ? { ...existing, label, savedAt: new Date().toISOString(), by: CURRENT_USER }
          : { version: Math.max(0, ...get().versions.map((x) => x.version)) + 1, hash, label, savedAt: new Date().toISOString(), by: CURRENT_USER };
        set({ versions: [...get().versions.filter((x) => x.hash !== hash), v] });
        return v;
      },
      remember: (v) => {
        if (get().versions.some((x) => x.hash === v.hash)) return;
        set({ versions: [...get().versions, v] });
      },
    }),
    { name: "horizon-saved-versions", storage: createJSONStorage(() => localStorage) },
  ),
);

/** The saved version matching this set, if it has been saved or loaded in this browser. */
export function useVersionFor(hash: string | undefined): SavedVersion | null {
  return useSavedVersions((s) => (hash ? s.versions.find((v) => v.hash === hash) ?? null : null));
}

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const savedAtText = (iso: string) => fmt.format(new Date(iso));
