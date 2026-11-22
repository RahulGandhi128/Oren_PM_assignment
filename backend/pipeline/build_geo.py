"""Simplify the raw India outline (OSM, admin_level 2) for the web map.

Input:  backend/data/source/geo/india-osm.json   (5.6 MB, 245k points)
Output: public/geo/india.json                 (small; drawn server-side by d3-geo)

Topology-preserving simplification only; the boundary itself is not altered.
Run: .venv-pipeline/bin/python -I backend/pipeline/build_geo.py
"""
import json
from pathlib import Path

from shapely.geometry import MultiPolygon, mapping, shape
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "backend/data/source/geo/india-osm.json"
OUT = ROOT / "public/geo/india.json"
TOLERANCE_DEG = 0.02      # ~2 km; well below one pixel at page scale
MIN_ISLAND_SQDEG = 0.002  # drop specks; keeps Andaman & Nicobar and Lakshadweep main islands


def rounded(coords, nd=3):
    if isinstance(coords[0], (int, float)):
        return [round(c, nd) for c in coords]
    return [rounded(c, nd) for c in coords]


def main() -> None:
    raw = json.loads(SRC.read_text())
    feat = raw["features"][0]
    geom = shape(feat["geometry"])
    parts = [p for p in geom.geoms if p.area >= MIN_ISLAND_SQDEG]
    simple = MultiPolygon(parts).simplify(TOLERANCE_DEG, preserve_topology=True)
    if simple.geom_type == "Polygon":
        simple = MultiPolygon([simple])
    # d3-geo uses spherical winding: exterior rings must be CLOCKWISE (opposite of RFC 7946),
    # otherwise the polygon is read as "the whole globe minus India".
    simple = MultiPolygon([orient(p, sign=-1.0) for p in simple.geoms])
    gj = mapping(simple)
    out = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"name": feat["properties"].get("name", "India"), "source": "OpenStreetMap (admin_level 2), simplified"},
            "geometry": {"type": "MultiPolygon", "coordinates": rounded(gj["coordinates"])},
        }],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"parts {len(geom.geoms)} -> {len(simple.geoms)}; {SRC.stat().st_size//1024} KB -> {OUT.stat().st_size//1024} KB")


if __name__ == "__main__":
    main()
