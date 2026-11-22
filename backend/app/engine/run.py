"""Wire data files to the engine: build inputs, run per horizon, roll up company totals."""
from __future__ import annotations

from ..loaders import load_hazards, load_network, load_plants
from ..schemas import AssetsPeople, CompanyTotals, ExposureResponse, HazardEAL, InheritedEAL, PlantExposure, Value
from .bands import band, exposed_hazards, high_risk_location_hazards
from .exposure import ACUTE, HAZARDS, HazardIn, PlantIn, V, compute_plant
from .network import EdgeIn, inherited
from .params import Params


def engine_inputs() -> tuple[dict[str, PlantIn], dict[str, HazardIn], list[EdgeIn], dict[str, dict]]:
    plants = load_plants()
    hz = load_hazards()["plants"]
    pins = {pid: PlantIn(id=pid, type=p.type, revenue=p.revenue.value, asset=p.asset_value.value,
                         water_source=p.water_source, coastal=p.coastal) for pid, p in plants.items()}
    hins = {}
    for pid, h in hz.items():
        heat = h["heat_days_40c"]
        hflags = heat.get("flags", {})
        if isinstance(hflags, list):
            hflags = {"today": hflags, "2040": hflags}
        ws = h["water_stress"]
        hins[pid] = HazardIn(
            heat_days={"today": heat.get("today"), "2040": heat.get("2040")},
            ws_cat={"today": ws["today"]["cat"], "2040": ws["2040"]["cat"]},
            rfr_score=h["riverine_flood_score"]["today"],
            cfr_score=h["coastal_flood_score"]["today"],
            rx1day_change_pct=h["rx1day_change_pct"].get("value"),
            flags={
                "heat.today": hflags.get("today", []), "heat.2040": hflags.get("2040", []),
                "water.today": ws["flags"]["today"], "water.2040": ws["flags"]["2040"],
                "flood": h["riverine_flood_score"]["flags"], "coastal": h["coastal_flood_score"]["flags"],
                "rx1day": h["rx1day_change_pct"].get("flags", []),
            },
        )
    edges = [EdgeIn(parent=e.from_id, child=e.to_id) for e in load_network().edges]
    return pins, hins, edges, hz


def _sum(values: list[Value], unit: str = "inr_cr") -> Value:
    return V(sum(v.value or 0 for v in values), unit, [s for v in values for s in v.source_ids],
             flags=[f for v in values for f in v.flags])


def run_exposure(horizon: str, p: Params) -> ExposureResponse:
    pins, hins, edges, hz = engine_inputs()
    plants = load_plants()
    inh = inherited(pins, hins, edges, p, horizon)
    out: list[PlantExposure] = []
    for pid, pin in pins.items():
        own = compute_plant(pin, hins[pid], p, horizon)
        own_rev = _sum([own[h]["revenue_at_risk"] for h in HAZARDS])
        inh_rev = _sum([i["revenue_at_risk"] for i in inh[pid]]) if inh[pid] else V(0.0, "inr_cr", ["plants_csv"], note="No upstream kiln.")
        total = _sum([own_rev, inh_rev])
        asset = _sum([own[h]["asset_damage"] for h in ACUTE])
        pct = 100 * total.value / pin.revenue
        parts = {h: own[h]["revenue_at_risk"].value for h in HAZARDS} | {"inherited": inh_rev.value}
        out.append(PlantExposure(
            plant_id=pid, name=plants[pid].name, short_name=plants[pid].short_name, type=pin.type,
            revenue=plants[pid].revenue,
            hazards={h: HazardEAL(**own[h]) for h in HAZARDS},
            inherited=[InheritedEAL(**i) for i in inh[pid]],
            own_revenue_at_risk=own_rev, inherited_revenue_at_risk=inh_rev, total_revenue_at_risk=total,
            asset_damage=asset,
            pct_revenue=V(pct, "pct", total.source_ids, flags=total.flags),
            band=band(pct, p),
            top_hazard=max(parts, key=parts.get),
            exposed_hazards=exposed_hazards(pin, hins[pid], hz[pid]["water_stress"][horizon]["score"], p, horizon),
            hazard_pct_revenue={h: 100 * v / pin.revenue for h, v in parts.items()},
            assets_people=assets_people(pin, hins[pid], hz[pid], plants[pid], asset, horizon),
        ))
    return ExposureResponse(horizon=horizon, plants=out, company=company_totals(out), overrides=p.overridden,
                            scenario_label=load_hazards()["scenario_label"])


def assets_people(pin: PlantIn, hin: HazardIn, hz: dict, plant, asset_damage: Value, horizon: str) -> AssetsPeople:
    rf, cf = hz["riverine_flood_score"], hz["coastal_flood_score"]
    loc = high_risk_location_hazards(pin, int(rf.get("cat") or 0), int(cf.get("cat") or 0))
    loc_flags = hin.flags.get("flood", []) + (hin.flags.get("coastal", []) if pin.coastal else [])
    ratings = {"flood": rf.get("label") or ""} | ({"coastal": cf.get("label") or ""} if pin.coastal else {})
    in_high = V(pin.asset if loc else 0.0, "inr_cr", ["plants_csv", "aqueduct40"], flags=loc_flags,
                note=("Location rated High or above for " + " and ".join("river flooding" if h == "flood" else "coastal flooding" for h in loc)
                      + " (Aqueduct baseline; no 2040 rating exists)") if loc else "Not in a High-rated flood or coastal location (Aqueduct baseline)")
    days = hin.heat_days.get(horizon)
    heat_flags = hin.flags.get(f"heat.{horizon}", [])
    whd = (V(plant.employees.value * days, "person_days", ["plants_csv", "openmeteo_climate"], flags=heat_flags,
             note="Employees × days a year at or above 40 °C (model median). Counts exposure, not health outcomes.")
           if days is not None and plant.employees.value is not None
           else Value(value=None, unit="person_days", kind="placeholder", source_ids=["plants_csv", "openmeteo_climate"], flags=heat_flags))
    return AssetsPeople(asset_value=plant.asset_value, asset_damage=asset_damage, high_risk_location=bool(loc), location_hazards=loc,
                        location_ratings=ratings, assets_in_high_risk_locations=in_high, employees=plant.employees, worker_heat_days=whd)


def company_totals(rows: list[PlantExposure]) -> CompanyTotals:
    rev = sum(r.revenue.value for r in rows)
    total = _sum([r.total_revenue_at_risk for r in rows])
    by_h = {}
    for h in HAZARDS:
        parts = [r.hazards[h].revenue_at_risk for r in rows] + [i.revenue_at_risk for r in rows for i in r.inherited if i.hazard == h]
        by_h[h] = _sum(parts)
    gb = _sum([r.assets_people.asset_value for r in rows]).model_copy(update={"kind": "data"})
    in_high = _sum([r.assets_people.assets_in_high_risk_locations for r in rows])
    return CompanyTotals(
        revenue=Value(value=rev, unit="inr_cr", kind="data", source_ids=["plants_csv"]),
        revenue_at_risk=total,
        asset_damage=_sum([r.asset_damage for r in rows]),
        pct_revenue=V(100 * total.value / rev, "pct", total.source_ids, flags=total.flags),
        by_hazard=by_h,
        inherited=_sum([r.inherited_revenue_at_risk for r in rows]),
        plants_high_or_severe=sum(r.band in ("High", "Severe") for r in rows),
        plant_count=len(rows),
        gross_block=gb,
        assets_in_high_risk_locations=in_high,
        assets_in_high_risk_share=V(100 * in_high.value / gb.value, "pct", in_high.source_ids, flags=in_high.flags),
        plants_in_high_risk_locations=sum(r.assets_people.high_risk_location for r in rows),
        employees=_sum([r.assets_people.employees for r in rows], "people").model_copy(update={"kind": "data"}),
        worker_heat_days=_sum([r.assets_people.worker_heat_days for r in rows], "person_days"),
    )
