"""Expected annual loss per plant per hazard (spec 7.1–7.2).

Pure functions over plain inputs so the 7.7 fixture can test them without any data files.
Every number comes back as a Value: kind "derived", with the data sources and the
assumption ids (asm.*) it used, plus any data-quality flags carried by its inputs.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..schemas import Value
from .params import Params

HAZARDS = ("heat", "water", "flood", "coastal")
ACUTE = ("flood", "coastal")

WS_CAT_KEY = {
    "Low": "low", "Low-Medium": "low_medium", "Medium-High": "medium_high", "High": "high",
    "Extremely High": "extremely_high", "Arid & low water use": "arid",
}
WATER_SOURCES = ("groundwater", "river", "canal", "reservoir", "municipal", "desalinated")


@dataclass
class PlantIn:
    id: str
    type: str            # "integrated" | "grinding"
    revenue: float       # ₹ cr
    asset: float         # ₹ cr
    water_source: str    # CSV string, e.g. "River (Wardha)"
    coastal: bool


@dataclass
class HazardIn:
    heat_days: dict[str, float | None]      # {"today": .., "2040": ..}
    ws_cat: dict[str, str]                  # Aqueduct category label per horizon
    rfr_score: float
    cfr_score: float
    rx1day_change_pct: float | None
    flags: dict[str, list[str]] = field(default_factory=dict)  # keys: heat.today, heat.2040, water.today, water.2040, flood, coastal, rx1day
    data_kind: dict[str, str] = field(default_factory=dict)    # "placeholder" where an input is missing


def V(value: float, unit: str, sources: list[str], note: str | None = None, flags: list[str] | None = None, kind: str = "derived") -> Value:
    return Value(value=value, unit=unit, kind=kind, source_ids=sorted(set(sources)), note=note, flags=sorted(set(flags or [])))


def water_source_key(s: str) -> str:
    low = s.strip().lower()
    for k in WATER_SOURCES:
        if low.startswith(k):
            return k
    if low.startswith("municipal"):
        return "municipal"
    raise ValueError(f"Unrecognised water source '{s}'.")


def score_band(score: float) -> str:
    b = min(4, max(0, int(score)))
    return f"{b}_{b + 1}"


def acute_probability(kind: str, plant: PlantIn, hz: HazardIn, p: Params, horizon: str) -> tuple[float, list[str], str | None]:
    """Annual probability of a disrupting flood/coastal event, the ids it used, and a note."""
    if kind == "flood":
        key = f"flood_prob_band_{score_band(hz.rfr_score)}"
        prob, src = p[key], ["aqueduct40", p.asm(key)]
        if horizon == "2040":
            ch = hz.rx1day_change_pct
            if ch is None:
                return prob, src, "Heavy-rain change not available; 2040 uses today's probability."
            prob = prob * (1 + max(0.0, ch / 100) * p["flood_elasticity"])
            src += ["openmeteo_climate", p.asm("flood_elasticity")]
        return prob, src, None
    if not plant.coastal:
        return 0.0, ["plants_csv"], "not coastal"
    key = f"coastal_prob_band_{score_band(hz.cfr_score)}"
    prob, src = p[key], ["aqueduct40", "plants_csv", p.asm(key)]
    if horizon == "2040":
        prob *= 1 + p["coastal_uplift_2040"]
        src.append(p.asm("coastal_uplift_2040"))
    return prob, src, None


def compute_plant(plant: PlantIn, hz: HazardIn, p: Params, horizon: str) -> dict[str, dict[str, Value | None]]:
    """Own exposure per hazard: downtime days, revenue at risk, asset damage (acute only), probability."""
    d_op = p["operating_days"]
    per_day = plant.revenue / d_op
    base_src = ["plants_csv", p.asm("operating_days")]
    out: dict[str, dict[str, Value | None]] = {}

    # Heat (chronic)
    loss_key = f"heat_loss_per_day_{plant.type}"
    days = hz.heat_days.get(horizon)
    fl = hz.flags.get(f"heat.{horizon}", [])
    if days is None:
        note = "Heat data not available for this plant (placeholder)."
        z = V(0.0, "days", ["openmeteo_climate"], note, fl, kind="placeholder")
        out["heat"] = {"downtime_days": z, "revenue_at_risk": V(0.0, "inr_cr", ["openmeteo_climate"], note, fl, kind="placeholder"), "asset_damage": None, "probability": None}
    else:
        dt = days * p[loss_key]
        src = ["openmeteo_climate", p.asm(loss_key)]
        out["heat"] = {
            "downtime_days": V(dt, "days", src, flags=fl),
            "revenue_at_risk": V(dt * per_day, "inr_cr", src + base_src, flags=fl),
            "asset_damage": None, "probability": None,
        }

    # Water stress (chronic)
    cat = hz.ws_cat[horizon]
    ck = f"curtail_days_{WS_CAT_KEY[cat]}"
    sk = f"source_factor_{water_source_key(plant.water_source)}"
    dt = p[ck] * p[sk]
    src = ["aqueduct40", p.asm(ck), p.asm(sk)]
    fl = hz.flags.get(f"water.{horizon}", [])
    out["water"] = {
        "downtime_days": V(dt, "days", src, note=f"{cat} water stress", flags=fl),
        "revenue_at_risk": V(dt * per_day, "inr_cr", src + base_src, note=f"{cat} water stress", flags=fl),
        "asset_damage": None, "probability": None,
    }

    # Acute: riverine flood, coastal flood / cyclone
    for kind in ACUTE:
        prob, src, note = acute_probability(kind, plant, hz, p, horizon)
        dkey, rkey = f"{kind}_downtime_days", f"{kind}_damage_ratio"
        fl = hz.flags.get(kind, []) + (hz.flags.get("rx1day", []) if kind == "flood" and horizon == "2040" else [])
        dt = prob * p[dkey]
        out[kind] = {
            "probability": V(prob, "probability", src, note, fl),
            "downtime_days": V(dt, "days", src + [p.asm(dkey)], note, fl),
            "revenue_at_risk": V(dt * per_day, "inr_cr", src + [p.asm(dkey)] + base_src, note, fl),
            "asset_damage": V(prob * p[rkey] * plant.asset, "inr_cr", src + [p.asm(rkey), "plants_csv"], note, fl),
        }
    return out
