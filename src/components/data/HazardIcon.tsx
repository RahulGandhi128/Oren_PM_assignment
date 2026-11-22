export type Hazard = "heat" | "water" | "flood" | "coastal";

const COLOR: Record<Hazard, string> = {
  heat: "stroke-hazard-heat",
  water: "stroke-hazard-water",
  flood: "stroke-hazard-flood",
  coastal: "stroke-hazard-coastal",
};
export const HAZARD_LABEL: Record<Hazard, string> = {
  heat: "Extreme heat",
  water: "Water stress",
  flood: "Riverine flood",
  coastal: "Coastal flood / cyclone",
};

export const HAZARD_SHORT: Record<Hazard, string> = { heat: "Heat", water: "Water", flood: "Flood", coastal: "Cyclone" };

/** 12×12 line icons: sun, droplet, wave, cyclone. Usable inline in HTML or nested inside an SVG. */
export function HazardIcon({ hazard, size = 12, x, y }: { hazard: Hazard; size?: number; x?: number; y?: number }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 12 12" fill="none" strokeWidth={1.2} strokeLinecap="round"
      className={COLOR[hazard]} role="img" aria-label={HAZARD_LABEL[hazard]}>
      {hazard === "heat" && (<><circle cx="6" cy="6" r="2.2" /><path d="M6 .8v1.4M6 9.8v1.4M.8 6h1.4M9.8 6h1.4M2.3 2.3l1 1M8.7 8.7l1 1M2.3 9.7l1-1M8.7 3.3l1-1" /></>)}
      {hazard === "water" && <path d="M6 1.2C4.2 4 3 5.6 3 7.4a3 3 0 0 0 6 0C9 5.6 7.8 4 6 1.2Z" />}
      {hazard === "flood" && <path d="M1 4.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3 0M1 8c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3 0" />}
      {hazard === "coastal" && <path d="M6 6m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M6 1.5A4.5 4.5 0 0 1 10.5 6M6 10.5A4.5 4.5 0 0 1 1.5 6M10.2 8.2A4.5 4.5 0 0 1 8 10.2M1.8 3.8A4.5 4.5 0 0 1 4 1.8" />}
    </svg>
  );
}
