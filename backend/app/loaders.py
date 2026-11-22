"""Read source data once at cold start. Stdlib only (runtime stays lean for Vercel)."""
import csv
import json
from functools import lru_cache
from pathlib import Path

from .schemas import ClimateBrief, ClimateDetail, Edge, Issues, ModelRow, Network, Plant, SeriesPoint, Value

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PLANTS_CSV = DATA_DIR / "source" / "plants" / "nimbus_cement_plants.csv"
SRC = "plants_csv"


def _v(x: str, unit: str, note: str | None = None) -> Value:
    return Value(value=float(x), unit=unit, kind="data", source_ids=[SRC], note=note)


@lru_cache
def load_plants() -> dict[str, Plant]:
    out: dict[str, Plant] = {}
    with PLANTS_CSV.open(newline="") as f:
        for r in csv.DictReader(f):
            is_kiln = r["plant_type"].strip().lower() == "integrated"
            out[r["plant_id"]] = Plant(
                id=r["plant_id"],
                name=r["plant_name"],
                short_name=r["town"],
                town=r["town"],
                state=r["state"],
                lat=float(r["latitude"]),
                lon=float(r["longitude"]),
                type="integrated" if is_kiln else "grinding",
                cement_capacity=_v(r["cement_capacity_mtpa"], "mtpa"),
                cement_output=_v(r["cement_output_fy2025_26_mt"], "mt"),
                clinker_produced=_v(r["clinker_produced_fy2025_26_mt"], "mt"),
                clinker_shipped=_v(r["clinker_shipped_fy2025_26_mt"], "mt"),
                scope1_co2=_v(r["scope1_co2_fy2025_26_kt"], "kt_co2", note="Displayed only; not used in v1 maths."),
                water_source=r["water_source"],
                coastal=r["coastal"].strip().upper() == "Y",
                asset_value=_v(r["asset_value_inr_cr"], "inr_cr"),
                revenue=_v(r["revenue_fy2025_26_inr_cr"], "inr_cr"),
                employees=_v(r["employees"], "people"),
                notes=r["notes"].strip() or None,
            )
    return out


@lru_cache
def load_network() -> Network:
    raw = json.loads((DATA_DIR / "network.json").read_text())
    plants = load_plants()
    edges = [
        Edge(
            from_id=e["from"],
            to_id=e["to"],
            clinker=Value(value=e["clinker_mt"], unit="mt", kind="data", source_ids=[SRC], note=e["basis"]),
            mode=e["mode"],
        )
        for e in raw["edges"]
    ]
    return Network(nodes=list(plants.values()), edges=edges)


@lru_cache
def load_hazards() -> dict:
    return json.loads((DATA_DIR / "hazards.json").read_text())


@lru_cache
def load_issues() -> Issues:
    return Issues.model_validate_json((DATA_DIR / "issues.json").read_text())


@lru_cache
def load_sources() -> dict:
    return json.loads((DATA_DIR / "sources.json").read_text())


def _hv(block: dict, key: str | None, unit: str) -> Value:
    """Hazard block → Value. key selects a window ("today"/"2040") or None for a single value."""
    flags = block.get("flags", [])
    if isinstance(flags, dict):
        flags = flags.get(key, [])
    rng = block.get("range")
    if isinstance(rng, dict):
        rng = rng.get(key)
    return Value(
        value=block.get(key) if key else block.get("value"),
        unit=unit,
        kind=block["kind"],
        source_ids=[block["source"]],
        note=block.get("note"),
        range=tuple(rng) if rng else None,
        flags=flags,
    )


def _ws(h: dict, w: str) -> Value:
    ws = h["water_stress"]
    return Value(value=ws[w]["score"], unit="score_0_5", kind=ws["kind"][w], source_ids=[ws["source"]],
                 label=ws[w]["cat"], flags=ws["flags"][w],
                 note="Business-as-usual (SSP3-7.0); midpoint of 2030 and 2050" if w == "2040" else None)


def _flood(b: dict) -> Value:
    return Value(value=b["today"], unit="score_0_5", kind=b["kind"], source_ids=[b["source"]],
                 label=b["label"], flags=b["flags"], note=b.get("note"))


def climate_brief(pid: str) -> ClimateBrief:
    h = load_hazards()["plants"][pid]
    return ClimateBrief(
        heat_days_40c_today=_hv(h["heat_days_40c"], "today", "days"),
        heat_days_40c_2040=_hv(h["heat_days_40c"], "2040", "days"),
        rx1day_change_pct=_hv(h["rx1day_change_pct"], None, "pct"),
        water_stress_today=_ws(h, "today"),
        water_stress_2040=_ws(h, "2040"),
        riverine_flood=_flood(h["riverine_flood_score"]),
        coastal_flood=_flood(h["coastal_flood_score"]),
    )


def climate_detail(pid: str) -> ClimateDetail:
    h = load_hazards()["plants"][pid]
    brief = climate_brief(pid)
    rx = h.get("rx1day_mm")
    return ClimateDetail(
        **brief.model_dump(),
        rx1day_mm_today=_hv(rx, "today", "mm") if rx else None,
        rx1day_mm_2040=_hv(rx, "2040", "mm") if rx else None,
        heat_series=[SeriesPoint(**s) for s in h.get("heat_series", [])],
        heat_series_flags=h.get("heat_series_flags", []),
        per_model=[
            ModelRow(
                model=m,
                heat_days_40c_today=v["heat_days_40c"]["today"],
                heat_days_40c_2040=v["heat_days_40c"]["2040"],
                years_used_today=v["years_used"]["today"],
                years_used_2040=v["years_used"]["2040"],
                rx1day_mm_today=v["rx1day_mm"]["today"],
                rx1day_mm_2040=v["rx1day_mm"]["2040"],
                rx1day_change_pct=v["rx1day_change_pct"],
                tmax_max_c=v["tmax_max_c"],
                flags=v["flags"],
            )
            for m, v in h.get("per_model", {}).items()
        ],
        grid=h.get("grid"),
        water_stress_by_scenario=h["water_stress"]["by_scenario"],
        water_stress_scenario=h["water_stress"]["scenario"],
        coastal_flood_aqueduct_score=h["coastal_flood_score"].get("aqueduct_score"),
        basin=h.get("basin"),
    )
