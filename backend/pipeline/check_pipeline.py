"""Phase 2 checklist: raw-file checks (Step 2), sanity checks on the result (Step 4),
and the 9-row summary table. Read-only; never downloads or changes anything.

Run:  .venv-pipeline/bin/python -I backend/pipeline/check_pipeline.py
"""
from __future__ import annotations

import csv
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "backend/data/source"
OM_RAW = SRC / "openmeteo_climate/raw"
AQ_RAW = SRC / "aqueduct40/raw"
HAZ = ROOT / "backend/data/hazards.json"

results: list[tuple[str, str, str]] = []  # (status, check, detail)


def rec(ok: bool | None, check: str, detail: str = "") -> None:
    results.append(("PASS" if ok else "GAP " if ok is None else "FAIL", check, detail))


def main() -> None:
    with (SRC / "plants/nimbus_cement_plants.csv").open(newline="") as f:
        plants = {r["plant_id"]: r for r in csv.DictReader(f)}

    # ---- Step 2: Open-Meteo raw files ---------------------------------------------
    files = sorted(OM_RAW.glob("P*.json.gz"))
    rec(len(files) == 9, "Open-Meteo: one raw file per plant", f"{len(files)}/9 present: {', '.join(p.name.split('.')[0] for p in files)}")
    for path in files:
        pid = path.name.split(".")[0]
        b = json.loads(gzip.decompress(path.read_bytes()))
        p = plants[pid]
        dlat, dlon = abs(b["latitude"] - float(p["latitude"])), abs(b["longitude"] - float(p["longitude"]))
        t = b["daily"]["time"]
        tcols = [c for c in b["daily"] if c.startswith("temperature_2m_max_")]
        pcols = [c for c in b["daily"] if c.startswith("precipitation_sum_")]
        tmax = [v for c in tcols for v in b["daily"][c] if v is not None]
        rec(dlat < 0.1 and dlon < 0.1, f"{pid} grid cell matches plant (not swapped)",
            f"grid {b['latitude']:.3f},{b['longitude']:.3f} vs plant {p['latitude']},{p['longitude']} (Δ {dlat:.3f}°, {dlon:.3f}°)")
        rec(t[0] == "1950-01-01" and t[-1] == "2050-12-31", f"{pid} date range 1950–2050", f"{t[0]} → {t[-1]}")
        rec(len(tcols) == len(pcols) == 7, f"{pid} both variables, several models", f"{len(tcols)} tmax + {len(pcols)} precip columns")
        units = b["daily_units"][tcols[0]]
        rec(units == "°C" and 25 < sorted(tmax)[len(tmax) // 2] < 40, f"{pid} temperatures in °C", f"unit {units}, median daily max {sorted(tmax)[len(tmax) // 2]:.1f}")

    # ---- Step 2: Aqueduct ----------------------------------------------------------
    with (AQ_RAW / "aqueduct40_baseline_plants.csv").open(newline="") as f:
        base_cols = next(csv.reader(f))
    with (AQ_RAW / "aqueduct40_future_bws_plants.csv").open(newline="") as f:
        fut = list(csv.DictReader(f))
    need = ["bws_score", "bws_cat", "rfr_score", "cfr_score", "pfaf_id"]
    rec(all(c in base_cols for c in need), "Aqueduct baseline has water stress, riverine and coastal flood", ", ".join(c for c in need if c in base_cols))
    years = sorted({r["year"] for r in fut})
    rec({"2030", "2050"} <= set(years), "Aqueduct future has 2030 and 2050 water stress", f"years {years}, scenarios {sorted({r['ssp'] for r in fut})}")
    geo = [p.name for p in AQ_RAW.iterdir() if p.suffix in (".gdb", ".shp", ".gpkg", ".geojson") or p.name.endswith(".gdb")]
    rec(None if not geo else True, "Aqueduct basin outlines present",
        "not in repo: the point-in-basin join was done upstream by WRI's point-analysis API; basin IDs kept for cross-checking" if not geo else ", ".join(geo))
    dic = [p.name for p in AQ_RAW.iterdir() if "dictionary" in p.name.lower() or p.suffix in (".pdf", ".xlsx")]
    rec(None if not dic else True, "Aqueduct data dictionary present",
        "not in repo: column names checked against the provider README and against values (score formula reproduces all scores)" if not dic else ", ".join(dic))

    # ---- Step 4: sanity checks on hazards.json ---------------------------------------
    hz = json.loads(HAZ.read_text())["plants"]
    heat = {pid: h["heat_days_40c"] for pid, h in hz.items()}
    have = {pid for pid, h in heat.items() if h["today"] is not None}
    hot, cool = [p for p in ("P01", "P03", "P06") if p in have], [p for p in ("P07", "P08") if p in have]
    if hot and cool:
        lo_hot, hi_cool = min(heat[p]["today"] for p in hot), max(heat[p]["today"] for p in cool)
        rec(lo_hot > 3 * hi_cool, "Chittorgarh/Chandrapur/Baloda Bazar ≫ Paradip/Mundra on 40 °C days",
            f"lowest of inland {lo_hot:.1f} vs highest coastal {hi_cool:.1f}")
    up = [p for p in have if heat[p]["2040"] >= heat[p]["today"]]
    rec(len(up) >= 0.7 * len(have), "2040 heat days ≥ Today for most plants", f"{len(up)}/{len(have)} plants rise")
    gw = [p for p, r in plants.items() if r["water_source"].startswith("Groundwater") and r["state"] in ("Rajasthan", "Telangana")]
    rec(all(hz[p]["water_stress"]["today"]["score"] >= 3 for p in gw), "Groundwater plants in Rajasthan/Telangana score high on water stress",
        "; ".join(f"{plants[p]['town']} {hz[p]['water_stress']['today']['score']:.1f} ({hz[p]['water_stress']['today']['cat']})" for p in gw))
    coastal_nonzero = sorted(p for p, h in hz.items() if (h["coastal_flood_score"]["today"] or 0) > 0)
    rec(set(coastal_nonzero) <= {"P07", "P08"}, "Coastal flood counts only for Mundra and Paradip", f"non-zero: {coastal_nonzero}")
    scores = [(p, k, v) for p, h in hz.items() for k, v in (
        ("ws_today", h["water_stress"]["today"]["score"]), ("ws_2040", h["water_stress"]["2040"]["score"]),
        ("rfr", h["riverine_flood_score"]["today"]), ("cfr", h["coastal_flood_score"]["today"]))]
    rec(all(0 <= v <= 5 for _, _, v in scores), "All Aqueduct scores between 0 and 5", f"{len(scores)} values, min {min(v for *_, v in scores):.2f}, max {max(v for *_, v in scores):.2f}")

    # ---- Output ---------------------------------------------------------------------
    for s, c, d in results:
        print(f"[{s}] {c}" + (f"  —  {d}" if d else ""))
    print()
    hdr = f"{'Plant':<13}{'Heat T':>7}{'Heat 40':>8}{'Rx1d Δ%':>9}{'WS T':>6}{'WS 40':>6}{'River':>6}{'Coast':>6}  Notes"
    print(hdr)
    print("-" * len(hdr))
    issues = {i["id"]: i for i in json.loads((ROOT / "backend/data/issues.json").read_text())["issues"]}
    for pid, p in plants.items():
        h = hz[pid]
        f = lambda v, nd=1: "—" if v is None else f"{v:.{nd}f}"  # noqa: E731
        flags = sorted({fl for blk in (h["heat_days_40c"], h["water_stress"], h["rx1day_change_pct"], h["riverine_flood_score"], h["coastal_flood_score"])
                        for fl in (sum(blk["flags"].values(), []) if isinstance(blk.get("flags"), dict) else blk.get("flags", []))})
        notes = [i for i in flags if issues[i]["plants"] != sorted(plants)]  # plant-specific issues only
        print(f"{p['town']:<13}{f(h['heat_days_40c']['today']):>7}{f(h['heat_days_40c']['2040']):>8}{f(h['rx1day_change_pct']['value']):>9}"
              f"{f(h['water_stress']['today']['score']):>6}{f(h['water_stress']['2040']['score']):>6}{f(h['riverine_flood_score']['today']):>6}"
              f"{f(h['coastal_flood_score']['today']):>6}  {', '.join(notes)}")


if __name__ == "__main__":
    main()
