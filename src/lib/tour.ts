"use client";
// Guided tour. Steps point at elements marked data-tour="…"; a step with a page navigates there first.
// State is kept for this tab (sessionStorage) so a reload mid-tour resumes at the same step.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type TourStep = {
  /** Page to show this step on. Omitted: stay on the current page. */
  page?: string;
  /** data-tour value of the element to highlight. Omitted: a centred card. */
  target?: string;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  { page: "/", title: "Welcome to Horizon",
    body: "Horizon shows how much revenue Nimbus Cement's nine plants could lose each year to physical climate risk, now and by 2040, and why. The tour takes about two minutes. Use Next or the arrow keys; Esc skips." },
  { page: "/", target: "side-rail", title: "Pages",
    body: "Overview, Plants, Network, Methodology and Issues & notes. The Data page at the bottom is for developers." },
  { page: "/", target: "when-tabs", title: "Now or 2040",
    body: "Every page shows one year at a time. Now is the average climate of 2001–2020; 2040 is the average of 2031–2050. Your choice carries across pages." },
  { page: "/", target: "exposure-strip", title: "Physical risk only",
    body: "Horizon measures physical risk: heat, water stress, river floods and coastal events. Transition risk, such as carbon-market costs, is not measured in v1." },
  { page: "/", target: "headline", title: "The board answer",
    body: "Revenue at risk a year, its share of revenue, and what drives it. A dotted underline means the number depends on assumptions you can change. Hover any number to see its source." },
  { page: "/", target: "physical-cards", title: "Operations, assets and people",
    body: "Four separate measures of physical risk: revenue at risk, expected asset damage, assets in high-risk flood locations, and worker heat-days. They are never added together." },
  { page: "/", target: "range", title: "How sure is it?",
    body: "The same figure under the Conservative and Severe presets. The width of the range shows how much the judgment calls matter." },
  { page: "/", target: "hazards", title: "By hazard",
    body: "What each hazard costs a year, its share of the total, and the plant most exposed to it." },
  { page: "/", target: "concentration", title: "Single point of failure",
    body: "Grinding units depend on kilns for clinker. This card shows the kiln whose shutdown would cost the other plants the most." },
  { page: "/", target: "tornado", title: "What moves the answer",
    body: "The five assumptions that change the 2040 figure most across their plausible range. Click one to adjust it in Methodology." },
  { page: "/plants", target: "plants-map", title: "Plant map",
    body: "Each plant is coloured by its risk band for the selected year. Hover a plant for a summary, or click to open it. Lines show clinker flowing from kilns to grinding units." },
  { page: "/plants", target: "plants-table", title: "Compare plants",
    body: "Sort by any column, hover a number to see where it comes from, and click a row for the plant's full detail." },
  { page: "/network", target: "network-diagram", title: "Who supplies whom",
    body: "Two kilns supply three grinding units, so one outage can travel. Click a plant to test what happens if it shuts." },
  { page: "/network", target: "stress-test", title: "Stress test",
    body: "Pick a plant and an outage length to see the revenue lost there and at every plant that depends on it, day by day." },
  { page: "/methodology", target: "risk-parts", title: "How it's built",
    body: "Climate risk has two parts, and v1 measures physical risk. The steps on this page show how climate data becomes ₹ at risk." },
  { page: "/methodology", target: "coverage", title: "What v1 covers",
    body: "What physical risk includes in v1 and what it leaves out, such as insurance, repair costs, impairment and health costs." },
  { page: "/methodology", target: "presets", title: "Assumption presets",
    body: "Central is the official set; Conservative and Severe show the plausible range. Any change updates every page, and a banner reminds you the numbers are no longer official." },
  { page: "/methodology", target: "key-drivers", title: "Change an assumption",
    body: "Each control shows its allowed range, why the default was chosen, and how far it can move the total." },
  { page: "/methodology", target: "saved-versions", title: "Saved versions",
    body: "Save the current assumptions as a numbered version file, and load it later to get exactly the same numbers back." },
  { page: "/issues", target: "issues-legend", title: "Issues & notes",
    body: "Source data is used as received. Known problems are listed here, with the plants and numbers they affect." },
  { target: "status-pill", title: "Which numbers am I seeing?",
    body: "Green means the official Central set. Amber means assumptions have been changed in this tab. Click it to open the assumptions." },
  { target: "more-menu", title: "Report and data",
    body: "Print the one-page report or save it as a PDF, or download the data as an Excel file." },
  { target: "tour-button", title: "That's the tour",
    body: "You can replay it any time from this button." },
];

type State = {
  active: boolean;
  index: number;
  start: () => void;
  next: () => void;
  back: () => void;
  end: () => void;
};

export const useTour = create<State>()(
  persist(
    (set, get) => ({
      active: false,
      index: 0,
      start: () => { markTourSeen(); set({ active: true, index: 0 }); },
      next: () => (get().index >= TOUR_STEPS.length - 1 ? set({ active: false, index: 0 }) : set({ index: get().index + 1 })),
      back: () => set({ index: Math.max(0, get().index - 1) }),
      end: () => { markTourSeen(); set({ active: false, index: 0 }); },
    }),
    { name: "horizon-tour", storage: createJSONStorage(() => sessionStorage), partialize: (s) => ({ active: s.active, index: s.index }) },
  ),
);

// First-visit prompt: remembered per browser. Storage can be blocked; then the prompt just shows again.
const SEEN_KEY = "horizon-tour-seen";
export function tourSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
export function markTourSeen(): void {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
}
