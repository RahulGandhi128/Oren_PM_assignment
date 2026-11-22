"""Combine processed source data into the files the API serves.

Input   backend/data/source/openmeteo_climate/processed/climate_summary.json
        backend/data/source/openmeteo_climate/processed/qa_report.json
        backend/data/source/plants/nimbus_cement_plants.csv
Output  backend/data/hazards.json   per-plant hazard metrics (spec 6.4) + quality flags
        backend/data/issues.json    data issues and notes, generated from the QA report

Data is used as is. Issues are flagged, never corrected: each metric carries the IDs
of the issues that touch it, and the UI shows a warning or danger sign for them.
Water stress, riverine and coastal flood come from WRI Aqueduct 4.0
(backend/data/source/aqueduct40/processed/, built by process_aqueduct.py).

Run:  .venv-pipeline/bin/python -I backend/pipeline/build_hazards.py
"""
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend/data"
OM = DATA / "source/openmeteo_climate/processed"
AQ = DATA / "source/aqueduct40/processed"
AQ_SCENARIO = "business_as_usual"  # spec 6.3: Aqueduct future = business-as-usual (SSP3-7.0)
PLANTS_CSV = DATA / "source/plants/nimbus_cement_plants.csv"

WINDOWS = {"today": [2001, 2020], "2040": [2031, 2050]}
SCENARIO = "CMIP6 HighResMIP (high-emissions pathway, close to RCP8.5)"
IMPLAUSIBLE_C = 55.0
INDIA_RECORD_C = 51.0


def r(x, nd=2):
    return None if x is None else round(x, nd)


def main() -> None:
    climate = json.loads((OM / "climate_summary.json").read_text())
    qa = json.loads((OM / "qa_report.json").read_text())
    aq = json.loads((AQ / "aqueduct_plants.json").read_text())
    aq_find = json.loads((AQ / "findings.json").read_text())
    aq_checks = json.loads((AQ / "checks.json").read_text())
    with PLANTS_CSV.open(newline="") as f:
        plants = {row["plant_id"]: row for row in csv.DictReader(f)}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # ---- Issues, derived from QA ------------------------------------------------
    missing = {}   # model -> {plant: [years in a window]}
    hot = {}       # model -> {plant: (days > 55C, max C)}
    for pid, models in qa.items():
        for m, q in models.items():
            yrs = [y for y in q["years_with_missing_days"] if any(lo <= y <= hi for lo, hi in WINDOWS.values())]
            if yrs:
                missing.setdefault(m, {})[pid] = yrs
            if q["days_tmax_above_55c"] > 0:
                hot.setdefault(m, {})[pid] = (q["days_tmax_above_55c"], q["tmax_max_c"])

    issues = []
    for m, by_plant in sorted(missing.items()):
        years = sorted({y for ys in by_plant.values() for y in ys})
        n_2040 = 20 - sum(1 for y in years if 2031 <= y <= 2050)
        issues.append({
            "id": f"OM-MISSING-{m}",
            "severity": "warning",
            "title": f"{m} has no data for {', '.join(map(str, years))}",
            "detail": f"{m} returns empty values for {', '.join(map(str, years))}, so its 2040 window uses {n_2040} years instead of 20. "
                      "The other models use the full 20 years.",
            "handling": "Used as is. The missing model-years are dropped for that model only, not filled in.",
            "source": "openmeteo_climate",
            "plants": sorted(by_plant),
            "models": [m],
            "metrics": ["heat_days_40c.2040", "rx1day_mm.2040", "rx1day_change_pct"],
        })
    for m, by_plant in sorted(hot.items()):
        worst = max(by_plant.items(), key=lambda kv: kv[1][1])
        per = "; ".join(f"{plants[p]['town']} {d} days, max {mx:.1f} °C" for p, (d, mx) in sorted(by_plant.items()))
        issues.append({
            "id": f"OM-IMPLAUSIBLE-TMAX-{m}",
            "severity": "danger",
            "title": f"{m} reports physically implausible temperatures",
            "detail": f"{m} reports daily maximum temperatures above {IMPLAUSIBLE_C:.0f} °C (up to {worst[1][1]:.1f} °C at {plants[worst[0]]['town']}). "
                      f"India's recorded maximum is {INDIA_RECORD_C:.0f} °C. Days above {IMPLAUSIBLE_C:.0f} °C: {per}.",
            "handling": "Used as is. Heat figures use the median across all models, which limits the effect of one model running hot. "
                        "The per-model table on each plant page shows this model's values separately.",
            "source": "openmeteo_climate",
            "plants": sorted(by_plant),
            "models": [m],
            "metrics": ["heat_days_40c.today", "heat_days_40c.2040", "heat_series"],
        })
    fetched = sorted(climate["plants"])
    medians = "; ".join(
        f"{plants[p]['town']} {climate['plants'][p]['heat_days_40c']['today']['ensemble']['median']:.1f}" for p in fetched)
    issues.append({
        "id": "OM-NO-BIAS-CORRECTION",
        "severity": "warning",
        "title": "Heat-day counts are not bias-corrected and look high",
        "detail": "The climate models are not bias-corrected against observations, and Today (2001–2020) is model climate, not measured weather. "
                  f"Today's ensemble median of days at or above 40 °C: {medians}. These are likely above what weather stations record. "
                  "The change from Today to 2040 is more reliable than the absolute counts, because both windows come from the same models.",
        "handling": "Used as is. Open question for the PM: whether to use observed IMD data for Today (spec section 14).",
        "source": "openmeteo_climate",
        "plants": fetched,
        "models": [],
        "metrics": ["heat_days_40c.today", "heat_days_40c.2040", "heat_series"],
    })
    pending = sorted(set(plants) - set(fetched))
    if pending:
        issues.append({
            "id": "OM-NOT-YET-FETCHED",
            "severity": "danger",
            "title": f"Climate data not yet downloaded for {len(pending)} plant{'s' if len(pending) != 1 else ''}",
            "detail": "Open-Meteo's free tier allows about one full plant request per hour. "
                      f"Still pending: {', '.join(plants[p]['town'] for p in pending)}. Their heat and rainfall values show as placeholders.",
            "handling": "Placeholder until backend/pipeline/fetch_openmeteo.py finishes; then rerun process_openmeteo.py and build_hazards.py.",
            "source": "openmeteo_climate",
            "plants": pending,
            "models": [],
            "metrics": ["heat_days_40c.today", "heat_days_40c.2040", "rx1day_change_pct", "heat_series"],
        })

    # ---- Aqueduct notes and issues (from process_aqueduct.py findings) -------------
    town = lambda pid: plants[pid]["town"]  # noqa: E731
    aq_metrics = ["water_stress.today", "water_stress.2040", "riverine_flood", "coastal_flood"]
    far = {p: d for p, d in aq_find["lookup_vs_plant_register_km"].items() if d >= 0.5}
    issues.append({
        "id": "AQ-APPROX-LOCATION",
        "severity": "warning",
        "title": "Water and flood lookups use approximate locations",
        "detail": "Each plant was matched to its Aqueduct river basin using town-centre coordinates, not exact plant sites. "
                  "A point near a basin edge can land in the neighbouring basin. "
                  + (f"The lookup point also differs from the plant register for {', '.join(f'{town(p)} ({d:.2f} km)' for p, d in far.items())}. " if far else "")
                  + "If real plant coordinates are available, rerun the lookup with them.",
        "handling": "Used as is. Basin IDs (pfaf_id, aq30_id) are kept so the match can be checked against the Aqueduct download.",
        "source": "aqueduct40", "plants": sorted(plants), "models": [], "metrics": aq_metrics,
    })
    issues.append({
        "id": "AQ-FUTURE-SCORE-DERIVED",
        "severity": "info",
        "title": "Future water-stress scores are calculated, and 2040 is estimated",
        "detail": "For future years Aqueduct gives only the raw stress ratio, not a score. It was converted with Aqueduct's own formula, "
                  "score = clip(log2(ratio) + log2(20), 0, 5), which reproduces all 9 of today's scores exactly. "
                  "Aqueduct has no 2040 value, so 2040 is the midpoint of the 2030 and 2050 scores, and its category is the whole-number part of the score. "
                  f"The pipeline re-derived every one of these values ({aq_checks['passed']} checks passed).",
        "handling": "2040 water stress is labelled Derived. The 2040 horizon uses the business-as-usual scenario (SSP3-7.0).",
        "source": "aqueduct40", "plants": sorted(plants), "models": [], "metrics": ["water_stress.2040"],
    })
    for d in aq_find["scenario_disagreement"]:
        sc = d["scores"]
        if max(sc.values()) - min(sc.values()) < 1.0:
            continue
        pid, yr = d["plant_id"], d["year"]
        if any(i["id"] == f"AQ-SCENARIO-SPREAD-{pid}" for i in issues):
            continue
        lo = min(sc, key=sc.get)
        issues.append({
            "id": f"AQ-SCENARIO-SPREAD-{pid}",
            "severity": "info",
            "title": f"{town(pid)}'s {yr} water stress is low in one scenario",
            "detail": f"In {yr}, {town(pid)}'s water-stress score drops to {sc[lo]:.2f} under the {lo.replace('_', '-')} scenario, but sits at "
                      f"{', '.join(f'{v:.2f} ({k.replace('_', '-')})' for k, v in sc.items() if k != lo)} under the others. "
                      "That is what the Aqueduct model gives, not a processing error.",
            "handling": "Used as is. Horizon uses business-as-usual; the plant page shows all three scenarios side by side.",
            "source": "aqueduct40", "plants": [pid], "models": [], "metrics": ["water_stress.2040"],
        })
    rises: dict[str, list] = {}
    for r in aq_find["category_rises_vs_today"]:
        rises.setdefault(r["plant_id"], []).append(r)
    cat_name = {0: "Low", 1: "Low-Medium", 2: "Medium-High", 3: "High", 4: "Extremely High"}
    for pid, rs in rises.items():
        parts = "; ".join(f"{r['scenario'].replace('_', '-')} {r['year']}" for r in rs)
        issues.append({
            "id": f"AQ-CATEGORY-RISE-{pid}",
            "severity": "info",
            "title": f"{town(pid)} moves up a water-stress category in some scenarios",
            "detail": f"{town(pid)} is {cat_name[rs[0]['from_cat']]} today and becomes {cat_name[rs[0]['to_cat']]} in: {parts}.",
            "handling": "Used as is. A category change raises the curtailment days used in the exposure engine (Phase 3).",
            "source": "aqueduct40", "plants": [pid], "models": [], "metrics": ["water_stress.2040"],
        })
    if aq_find["cfr_nonzero_but_not_coastal"]:
        ps = aq_find["cfr_nonzero_but_not_coastal"]
        issues.append({
            "id": "AQ-CFR-NOT-COASTAL",
            "severity": "info",
            "title": "Coastal flood score ignored for plants not marked coastal",
            "detail": "Aqueduct gives a non-zero coastal flood score to "
                      + ", ".join(f"{town(p)} ({aq['plants'][p]['coastal_flood']['score']:.2f})" for p in ps)
                      + ", but the plant register marks them as not coastal. The spec applies the coastal hazard only where coastal = Y.",
            "handling": "Coastal flood set to 0 (Derived, 'not coastal'). The Aqueduct score is still shown on the plant page.",
            "source": "aqueduct40", "plants": ps, "models": [], "metrics": ["coastal_flood"],
        })
    for pid, m in aq_find["malformed_rows"].items():
        issues.append({
            "id": f"AQ-MALFORMED-ROW-{pid}",
            "severity": "warning",
            "title": f"{town(pid)}'s row in the Aqueduct baseline file is malformed",
            "detail": f"aqueduct40_baseline_plants.csv has {len(m['extra_values'])} more values in {town(pid)}'s row than the header has columns "
                      f"(drought is blank, then 'No data', then {', '.join(m['extra_values'])}). The drought and overall-water-risk columns are shifted.",
            "handling": "Drought and overall water risk are not used in v1, so they are left empty for this plant. Water stress and flood columns come before the shift and are unaffected (checked against the summary file).",
            "source": "aqueduct40", "plants": [pid], "models": [], "metrics": [],
        })
    issues.append({
        "id": "AQ-SCENARIO-MISMATCH",
        "severity": "info",
        "title": "Heat and water stress use different emissions scenarios",
        "detail": "Heat and heavy rain come from CMIP6 HighResMIP models, which Open-Meteo describes as close to RCP8.5 (high emissions). "
                  "Water stress for 2040 uses Aqueduct's business-as-usual scenario (SSP3-7.0), as the spec sets out. Aqueduct also offers SSP5-8.5 (pessimistic).",
        "handling": "Kept as specified. The plant page shows all three Aqueduct scenarios so the difference is visible.",
        "source": "aqueduct40", "plants": sorted(plants), "models": [], "metrics": ["water_stress.2040"],
    })

    def flags_for(pid: str, metric: str, model: str | None = None) -> list[str]:
        out = []
        for i in issues:
            if pid not in i["plants"]:
                continue
            if model is not None and i["models"] and model not in i["models"]:
                continue
            # "heat_days_40c" matches any window; "heat_days_40c.2040" matches that window only
            if any(m == metric or m.startswith(metric + ".") for m in i["metrics"]):
                out.append(i["id"])
        return out

    # ---- Hazards ------------------------------------------------------------------
    out_plants = {}
    for pid in plants:
        c = climate["plants"].get(pid)
        if c is None:
            note = "Open-Meteo data not yet fetched for this plant."
            out_plants[pid] = {
                "heat_days_40c": {"today": None, "2040": None, "kind": "placeholder", "source": "openmeteo_climate", "note": note, "flags": flags_for(pid, "heat_days_40c")},
                "heat_series": [],
                "rx1day_change_pct": {"value": None, "kind": "placeholder", "source": "openmeteo_climate", "note": note, "flags": flags_for(pid, "rx1day_change_pct")},
                "per_model": {},
                "notes": [note],
            }
            continue
        h, rx, ch = c["heat_days_40c"], c["rx1day_mm"], c["rx1day_change_pct"]
        models = sorted(h["today"]["per_model"])
        out_plants[pid] = {
            "grid": c["grid"],
            "heat_days_40c": {
                "today": h["today"]["ensemble"]["median"], "2040": h["2040"]["ensemble"]["median"],
                "range": {w: [h[w]["ensemble"]["min"], h[w]["ensemble"]["max"]] for w in WINDOWS},
                "kind": "data", "source": "openmeteo_climate", "models": h["today"]["ensemble"]["n_models"],
                "flags": {w: flags_for(pid, f"heat_days_40c.{w}") for w in WINDOWS},
            },
            "heat_series": [{"year": s["year"], "value": s["median"], "min": s["min"], "max": s["max"]} for s in c["heat_series"]],
            "heat_series_flags": flags_for(pid, "heat_series"),
            "rx1day_mm": {
                "today": rx["today"]["ensemble"]["median"], "2040": rx["2040"]["ensemble"]["median"],
                "range": {w: [rx[w]["ensemble"]["min"], rx[w]["ensemble"]["max"]] for w in WINDOWS},
                "kind": "data", "source": "openmeteo_climate",
                "flags": {w: flags_for(pid, f"rx1day_mm.{w}") for w in WINDOWS},
            },
            "rx1day_change_pct": {
                "value": ch["ensemble"]["median"], "range": [ch["ensemble"]["min"], ch["ensemble"]["max"]],
                "kind": "derived", "source": "openmeteo_climate", "flags": flags_for(pid, "rx1day_change_pct"),
            },
            "per_model": {
                m: {
                    "heat_days_40c": {"today": h["today"]["per_model"][m], "2040": h["2040"]["per_model"][m]},
                    "years_used": {"today": h["today"]["years_used"][m], "2040": h["2040"]["years_used"][m]},
                    "rx1day_mm": {"today": rx["today"]["per_model"][m], "2040": rx["2040"]["per_model"][m]},
                    "rx1day_change_pct": ch["per_model"][m],
                    "tmax_max_c": qa[pid][m]["tmax_max_c"],
                    "flags": sorted({*flags_for(pid, "heat_days_40c", m), *flags_for(pid, "rx1day_mm", m)} - {"OM-NO-BIAS-CORRECTION"}),
                }
                for m in models
            },
            "notes": [],
        }

    for pid, p in plants.items():
        a = aq["plants"][pid]
        ws, fut = a["water_stress"], a["water_stress"]["future"]
        coastal = p["coastal"].strip().upper() == "Y"
        out_plants[pid]["basin"] = {**a["basin"], "lookup_point": a["lookup_point"]}
        out_plants[pid]["water_stress"] = {
            "today": {"score": ws["today"]["score"], "cat": ws["today"]["label"], "raw": ws["today"]["raw"]},
            "2040": {"score": fut[AQ_SCENARIO]["2040"]["score"], "cat": fut[AQ_SCENARIO]["2040"]["label"]},
            "kind": {"today": "data", "2040": "derived"}, "source": "aqueduct40", "scenario": "SSP3-7.0 (business-as-usual)",
            "by_scenario": {sc: {yr: {"score": v["score"], "cat": v["label"], "estimated": v["estimated"]} for yr, v in yrs.items() if yr in ("2030", "2040", "2050")}
                            for sc, yrs in fut.items()},
            "flags": {"today": flags_for(pid, "water_stress.today"), "2040": flags_for(pid, "water_stress.2040")},
        }
        out_plants[pid]["riverine_flood_score"] = {
            "today": a["riverine_flood"]["score"], "cat": a["riverine_flood"]["cat"], "label": a["riverine_flood"]["aqueduct_label"],
            "kind": "data", "source": "aqueduct40", "flags": flags_for(pid, "riverine_flood"),
        }
        out_plants[pid]["coastal_flood_score"] = (
            {"today": a["coastal_flood"]["score"], "cat": a["coastal_flood"]["cat"], "label": a["coastal_flood"]["aqueduct_label"],
             "kind": "data", "source": "aqueduct40", "flags": flags_for(pid, "coastal_flood")}
            if coastal else
            {"today": 0.0, "cat": 0, "label": "Not coastal", "kind": "derived", "source": "aqueduct40", "note": "not coastal",
             "aqueduct_score": a["coastal_flood"]["score"], "flags": flags_for(pid, "coastal_flood")}
        )

    hazards = {
        "generated_at": now,
        "windows": WINDOWS,
        "scenario_label": SCENARIO,
        "sources_included": ["openmeteo_climate", "aqueduct40"],
        "sources_pending": [],
        "plants": out_plants,
    }
    (DATA / "hazards.json").write_text(json.dumps(hazards, indent=1) + "\n")
    (DATA / "issues.json").write_text(json.dumps({"generated_at": now, "issues": issues}, indent=1) + "\n")
    print(f"hazards.json: {len(fetched)}/{len(plants)} plants with climate data")
    for i in issues:
        print(f"  [{i['severity']}] {i['id']}: {i['title']} ({', '.join(i['plants'])})")


if __name__ == "__main__":
    main()
