// Server-side geometry: project the simplified India outline once, ship only an SVG path string.
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import india from "../../../public/geo/india.json";

export const MAP_W = 560;
export const MAP_H = 620;
const PAD = 12;

export type MapGeometry = { width: number; height: number; outline: string; scale: number; translate: [number, number] };

export function indiaGeometry(): MapGeometry {
  const fc = india as unknown as FeatureCollection;
  const projection = geoMercator().fitExtent([[PAD, PAD], [MAP_W - PAD, MAP_H - PAD]], fc);
  const outline = geoPath(projection)(fc) ?? "";
  return { width: MAP_W, height: MAP_H, outline, scale: projection.scale(), translate: projection.translate() as [number, number] };
}
