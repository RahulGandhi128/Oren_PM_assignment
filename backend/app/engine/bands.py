"""Risk bands (spec 7.5) and the per-plant hazard icons shown on the map."""
from __future__ import annotations

from .exposure import HazardIn, PlantIn
from .params import Params

BANDS = ("Low", "Moderate", "High", "Severe")


def band(pct_of_revenue: float, p: Params) -> str:
    if pct_of_revenue >= p["band_severe_pct"]:
        return "Severe"
    if pct_of_revenue >= p["band_high_pct"]:
        return "High"
    if pct_of_revenue >= p["band_moderate_pct"]:
        return "Moderate"
    return "Low"




# Aqueduct 4.0 flood categories: 0 Low, 1 Low-Medium, 2 Medium-High, 3 High, 4 Extremely High.
# A location counts as high-risk at Aqueduct's own "High" category or above (provider definition, not ours).
AQ_HIGH_CAT = 3


def high_risk_location_hazards(plant: PlantIn, rfr_cat: int, cfr_cat: int) -> list[str]:
    """Acute hazards for which the plant's own location is rated High or Extremely High (inherited loss ignored)."""
    out = []
    if rfr_cat >= AQ_HIGH_CAT:
        out.append("flood")
    if plant.coastal and cfr_cat >= AQ_HIGH_CAT:
        out.append("coastal")
    return out


def exposed_hazards(plant: PlantIn, hz: HazardIn, ws_score: float | None, p: Params, horizon: str) -> list[str]:
    """Hazards at or above the map-icon thresholds for this horizon (display only, not used in ₹ maths)."""
    out = []
    days = hz.heat_days.get(horizon)
    if days is not None and days >= p["icon_heat_days"]:
        out.append("heat")
    if ws_score is not None and ws_score >= p["icon_aqueduct_score"]:
        out.append("water")
    if hz.rfr_score >= p["icon_aqueduct_score"]:
        out.append("flood")
    if plant.coastal and hz.cfr_score >= p["icon_aqueduct_score"]:
        out.append("coastal")
    return out
