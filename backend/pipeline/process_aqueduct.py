"""Validate and reshape the WRI Aqueduct 4.0 plant lookup.

Input   backend/data/source/aqueduct40/raw/
          aqueduct40_baseline_plants.csv    today: bws, rfr, cfr, drr, overall risk + basin IDs
          aqueduct40_future_bws_plants.csv  water stress 2030/2040/2050/2080 x 3 scenarios (long)
          aqueduct40_plant_summary.csv      one row per plant (cross-check only)
          aqueduct40_README.md              how the lookup was made
Output  backend/data/source/aqueduct40/processed/
          aqueduct_plants.json              per plant: basin, water stress today + future by scenario,
                                            riverine / coastal flood, drought; lookup coordinates
          checks.json                       every consistency check run and its result
          findings.json                     facts the issues page reports (coordinates, scenario spread, ...)

The lookup itself (point -> Aqueduct sub-basin) was done upstream via the Water Risk Atlas
point-analysis API; see raw/aqueduct40_README.md. This script does not change any value.
It re-derives what it can and stops if anything disagrees.

Run:  .venv-pipeline/bin/python -I backend/pipeline/process_aqueduct.py
"""
from __future__ import annotations

import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "backend/data/source/aqueduct40"
RAW, OUT = BASE / "raw", BASE / "processed"
PLANTS_CSV = ROOT / "backend/data/source/plants/nimbus_cement_plants.csv"

SCENARIOS = {"optimistic": "SSP1-2.6", "business_as_usual": "SSP3-7.0", "pessimistic": "SSP5-8.5"}
# Aqueduct 4.0 water-stress categories (bws_cat 0-4); -1 = "Arid and low water use"
BWS_CAT_LABEL = {-1: "Arid & low water use", 0: "Low", 1: "Low-Medium", 2: "Medium-High", 3: "High", 4: "Extremely High"}
TOL = 0.002


def read(name: str) -> list[dict]:
    with (RAW / name).open(newline="") as f:
        return list(csv.DictReader(f))


def fnum(x: str) -> float | None:
    return None if x in ("", None) else float(x)


def fnum_or_none(x) -> float | None:
    try:
        return fnum(x)
    except (TypeError, ValueError):
        return None


def aq_score(raw: float) -> float:
    """Aqueduct 4.0 water-stress score from the raw withdrawal/supply ratio."""
    return 0.0 if raw <= 0 else max(0.0, min(5.0, math.log2(raw) + math.log2(20)))


def km(lat1, lon1, lat2, lon2) -> float:
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base = {r["plant_id"]: r for r in read("aqueduct40_baseline_plants.csv")}
    fut = read("aqueduct40_future_bws_plants.csv")
    summ = {r["plant_id"]: r for r in read("aqueduct40_plant_summary.csv")}
    with PLANTS_CSV.open(newline="") as f:
        plants = {r["plant_id"]: r for r in csv.DictReader(f)}

    checks: list[dict] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        checks.append({"check": name, "ok": ok, "detail": detail})
        if not ok:
            raise SystemExit(f"CHECK FAILED: {name}: {detail}")

    check("all 9 plants present in baseline", set(base) == set(plants), str(sorted(set(plants) ^ set(base))))
    check("all 9 plants present in summary", set(summ) == set(plants))

    # 1. Score formula reproduces every baseline score (README claim)
    worst = max(abs(aq_score(float(b["bws_raw"])) - float(b["bws_score"])) for b in base.values())
    check("baseline bws_score == clip(log2(raw)+log2(20),0,5)", worst < TOL, f"max abs diff {worst:.4f}")

    # 2. Future scores: recompute from raw; 2040 = midpoint of 2030 and 2050; category = floor(score)
    by_key: dict[tuple, dict] = {(r["plant_id"], r["scenario"], int(r["year"])): r for r in fut}
    future: dict[str, dict] = {}
    for (pid, sc, yr), r in by_key.items():
        score = float(r["bws_score"])
        if yr != 2040:
            check(f"{pid} {sc} {yr} score from raw", abs(aq_score(float(r["bws_raw"])) - score) < TOL, f"{r['bws_raw']} -> {score}")
        else:
            mid = (float(by_key[(pid, sc, 2030)]["bws_score"]) + float(by_key[(pid, sc, 2050)]["bws_score"])) / 2
            check(f"{pid} {sc} 2040 = midpoint 2030/2050", abs(mid - score) < TOL, f"{mid:.4f} vs {score}")
            check(f"{pid} {sc} 2040 flagged estimated", r["estimated"] == "True")
        check(f"{pid} {sc} {yr} category = floor(score)", int(r["bws_cat"]) == min(4, int(score)), f"{score} -> {r['bws_cat']}")
        check(f"{pid} scenario label", SCENARIOS[sc] == r["ssp"], r["ssp"])
        future.setdefault(pid, {}).setdefault(sc, {})[yr] = {
            "raw": fnum(r["bws_raw"]), "score": round(score, 4), "cat": int(r["bws_cat"]),
            "label": BWS_CAT_LABEL[int(r["bws_cat"])], "estimated": r["estimated"] == "True",
        }

    # 3. Summary table agrees with baseline + future
    tag = {"optimistic": "opt", "business_as_usual": "bau", "pessimistic": "pes"}
    for pid, s in summ.items():
        b = base[pid]
        check(f"{pid} summary bws today", abs(float(s["bws_score_today"]) - float(b["bws_score"])) < 0.01)
        check(f"{pid} summary rfr", abs(float(s["rfr_score"]) - float(b["rfr_score"])) < 0.01)
        check(f"{pid} summary cfr", abs(float(s["cfr_score"]) - float(b["cfr_score"])) < 0.01)
        for sc, t in tag.items():
            for yr in (2030, 2040, 2050):
                check(f"{pid} summary {t} {yr}", abs(float(s[f"bws_score_{yr}_{t}"]) - future[pid][sc][yr]["score"]) < 0.01)

    # ---- Findings (facts the issues page will report) -------------------------------
    coord = {}
    for pid, b in base.items():
        p = plants[pid]
        d = km(float(p["latitude"]), float(p["longitude"]), float(b["lat"]), float(b["lon"]))
        coord[pid] = round(d, 2)
    spread = []
    for pid, scs in future.items():
        for yr in (2030, 2040, 2050):
            vals = {sc: scs[sc][yr]["score"] for sc in SCENARIOS}
            cats = {sc: scs[sc][yr]["cat"] for sc in SCENARIOS}
            if max(vals.values()) - min(vals.values()) >= 1.0 or len(set(cats.values())) > 1:
                spread.append({"plant_id": pid, "year": yr, "scores": vals, "cats": cats})
    base_cat_change = [
        {"plant_id": pid, "scenario": sc, "year": yr, "from_cat": int(base[pid]["bws_cat"]), "to_cat": v["cat"]}
        for pid, scs in future.items() for sc, yrs in scs.items() for yr, v in yrs.items()
        if yr in (2030, 2050) and v["cat"] > int(base[pid]["bws_cat"])
    ]
    findings = {
        "lookup_vs_plant_register_km": coord,
        "scenario_disagreement": spread,
        "category_rises_vs_today": base_cat_change,
        "cfr_nonzero_but_not_coastal": [pid for pid, b in base.items() if float(b["cfr_score"]) > 0 and plants[pid]["coastal"].strip().upper() != "Y"],
        # rows with more fields than the header (csv.DictReader puts the extras under key None)
        "malformed_rows": {pid: {"extra_values": b[None], "drr_score": b["drr_score"], "drr_cat": b["drr_cat"],
                                 "w_awr_def_tot_score": b["w_awr_def_tot_score"], "w_awr_def_tot_cat": b["w_awr_def_tot_cat"]}
                           for pid, b in base.items() if b.get(None)},
        "missing_fields": {pid: [k for k in ("drr_score", "drr_cat") if base[pid][k] == ""] for pid in base if any(base[pid][k] == "" for k in ("drr_score", "drr_cat"))},
    }

    out = {}
    for pid, b in base.items():
        out[pid] = {
            "basin": {"pfaf_id": b["pfaf_id"], "aq30_id": b["aq30_id"], "string_id": b["string_id"], "major": b["major_basin"], "minor": b["minor_basin"]},
            "lookup_point": {"lat": float(b["lat"]), "lon": float(b["lon"]), "km_from_plant_register": coord[pid]},
            "water_stress": {
                "today": {"raw": fnum(b["bws_raw"]), "score": float(b["bws_score"]), "cat": int(b["bws_cat"]), "label": BWS_CAT_LABEL[int(b["bws_cat"])], "aqueduct_label": b["bws_label"]},
                "future": future[pid],
            },
            "riverine_flood": {"raw": fnum(b["rfr_raw"]), "score": float(b["rfr_score"]), "cat": int(b["rfr_cat"]), "aqueduct_label": b["rfr_label"]},
            "coastal_flood": {"raw": fnum(b["cfr_raw"]), "score": float(b["cfr_score"]), "cat": int(b["cfr_cat"]), "aqueduct_label": b["cfr_label"]},
            # Not used in v1 maths. Left empty for malformed rows rather than guessing the column shift.
            "drought": {"score": None if b.get(None) else fnum_or_none(b["drr_score"]), "cat": None if b.get(None) else fnum_or_none(b["drr_cat"])},
            "overall_water_risk": {"score": None if b.get(None) else fnum_or_none(b["w_awr_def_tot_score"]),
                                   "cat": None if b.get(None) else fnum_or_none(b["w_awr_def_tot_cat"])},
        }

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (OUT / "aqueduct_plants.json").write_text(json.dumps({"generated_at": now, "source": "aqueduct40", "scenarios": SCENARIOS, "plants": out}, indent=1) + "\n")
    (OUT / "checks.json").write_text(json.dumps({"generated_at": now, "passed": len(checks), "checks": checks}, indent=1) + "\n")
    (OUT / "findings.json").write_text(json.dumps(findings, indent=1) + "\n")
    print(f"{len(checks)} checks passed")
    print("lookup point vs plant register (km):", coord)
    print("scenario disagreement:", [(s["plant_id"], s["year"], s["scores"]) for s in spread])
    print("category rises vs today:", base_cat_change)
    print("malformed rows:", findings["malformed_rows"])
    print("cfr > 0 but not coastal:", findings["cfr_nonzero_but_not_coastal"], "| missing:", findings["missing_fields"])


if __name__ == "__main__":
    main()
