"""Rule-based key findings (spec 7.9). Templates only, no LLM."""
from __future__ import annotations

from ..schemas import ExposureResponse, Finding
from .exposure import PlantIn
from .network import EdgeIn, stress
from .params import Params

HAZARD_WORDS = {"heat": "extreme heat", "water": "water stress", "flood": "riverine flooding",
                "coastal": "coastal flooding and cyclones", "inherited": "clinker supply disruption"}
FINDING_OUTAGE_DAYS = 30


def cr(x: float) -> str:
    return f"₹{x:,.1f} cr"


def build_findings(today: ExposureResponse, future: ExposureResponse, plants: dict[str, PlantIn],
                   edges: list[EdgeIn], water_sources: dict[str, str], ws_cat_today: dict[str, str], p: Params) -> list[Finding]:
    out: list[Finding] = []
    by_id = {r.plant_id: r for r in future.plants}

    # 1. Largest exposure by 2040
    top = max(future.plants, key=lambda r: r.total_revenue_at_risk.value)
    out.append(Finding(
        kicker="Largest exposure",
        text=f"{top.short_name} carries the largest exposure: {cr(top.total_revenue_at_risk.value)} a year by 2040, "
             f"mostly from {HAZARD_WORDS[top.top_hazard]}.",
        href=f"/plants/{top.plant_id}", plant_ids=[top.plant_id]))

    # 2. Single point of failure: the kiln feeding the most grinding units (ties -> larger outage loss)
    kids: dict[str, list[str]] = {}
    for e in edges:
        kids.setdefault(e.parent, []).append(e.child)
    if kids:
        scored = {k: stress(k, FINDING_OUTAGE_DAYS, plants, edges, p) for k in kids}
        spof = max(kids, key=lambda k: (len(kids[k]), scored[k]["total_lost_revenue"].value))
        names = " and ".join(by_id[c].short_name for c in kids[spof])
        out.append(Finding(
        kicker="Single point of failure",
            text=f"{by_id[spof].short_name} is a single point of failure: it supplies {names}. "
                 f"A {FINDING_OUTAGE_DAYS}-day outage puts {cr(scored[spof]['total_lost_revenue'].value)} of revenue at risk "
                 f"across {len(kids[spof]) + 1} plants.",
            href="/network", plant_ids=[spof, *kids[spof]]))

    # 3. Change by 2040 and its main driver
    t, f = today.company.revenue_at_risk.value, future.company.revenue_at_risk.value
    deltas = {h: future.company.by_hazard[h].value - today.company.by_hazard[h].value for h in today.company.by_hazard}
    driver = max(deltas, key=deltas.get)
    pct = 100 * (f - t) / t if t else 0.0
    out.append(Finding(
        kicker="Change to 2040",
        text=f"Exposure {'rises' if pct >= 0 else 'falls'} {abs(pct):.1f}% by 2040 ({cr(t)} → {cr(f)} a year), "
             f"driven mainly by {HAZARD_WORDS[driver]}.",
        href="/", plant_ids=[]))

    # 4. Groundwater in high-stress basins
    gw = [pid for pid, s in water_sources.items() if s.lower().startswith("groundwater") and ws_cat_today[pid] in ("High", "Extremely High")]
    if gw:
        out.append(Finding(
        kicker="Groundwater",
            text=f"{len(gw)} plant{'s' if len(gw) != 1 else ''} ({', '.join(by_id[g].short_name for g in gw)}) "
                 f"draw{'s' if len(gw) == 1 else ''} on groundwater in basins rated High or worse for water stress.",
            href=f"/plants/{gw[0]}", plant_ids=gw))

    # 5. Band count
    hs = [r for r in future.plants if r.band in ("High", "Severe")]
    out.append(Finding(
        kicker="Risk bands",
        text=f"{len(hs)} of {len(future.plants)} plants are in the High or Severe band by 2040"
             + (f": {', '.join(r.short_name for r in hs)}." if hs else "."),
        href="/plants?h=2040", plant_ids=[r.plant_id for r in hs]))
    return out
