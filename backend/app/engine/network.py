"""Clinker network: acute events at a kiln propagate to its grinding units (spec 7.4, 7.6).

Chronic hazards (heat, water) do not propagate: kilns run ~80-85% utilised and recover
lost clinker within the year. Inherited loss is the child's own lost revenue, so adding
it to the company total does not double count.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..schemas import Value
from .exposure import ACUTE, V, HazardIn, PlantIn, acute_probability
from .params import Params


@dataclass
class EdgeIn:
    parent: str
    child: str


def inherited(plants: dict[str, PlantIn], hazards: dict[str, HazardIn], edges: list[EdgeIn], p: Params, horizon: str) -> dict[str, list[dict]]:
    """child_id -> list of {from, hazard, downtime_days, revenue_at_risk}."""
    out: dict[str, list[dict]] = {pid: [] for pid in plants}
    buf = p["buffer_days"]
    for e in edges:
        parent, child = plants[e.parent], plants[e.child]
        for kind in ACUTE:
            prob, src, note = acute_probability(kind, parent, hazards[e.parent], p, horizon)
            d = p[f"{kind}_downtime_days"]
            dt = prob * max(0.0, d - buf)
            ids = src + [p.asm(f"{kind}_downtime_days"), p.asm("buffer_days"), p.asm("operating_days"), "plants_csv"]
            fl = hazards[e.parent].flags.get(kind, [])
            out[e.child].append({
                "from_plant": e.parent,
                "hazard": kind,
                "downtime_days": V(dt, "days", ids, note, fl),
                "revenue_at_risk": V(dt * child.revenue / p["operating_days"], "inr_cr", ids, note, fl),
            })
    return out


def stress(plant_id: str, days: int, plants: dict[str, PlantIn], edges: list[EdgeIn], p: Params) -> dict:
    """What if plant X is shut for N days? (spec 7.6)"""
    d_op, buf = p["operating_days"], p["buffer_days"]
    src = ["plants_csv", p.asm("operating_days")]
    own = days * plants[plant_id].revenue / d_op
    children = []
    for e in edges:
        if e.parent != plant_id:
            continue
        c = plants[e.child]
        short = max(0.0, days - buf)
        children.append({
            "plant_id": c.id,
            "lost_revenue": V(short * c.revenue / d_op, "inr_cr", src + [p.asm("buffer_days")],
                              note=None if short > 0 else "covered by clinker buffer"),
            "lost_days": V(short, "days", [p.asm("buffer_days")]),
            "stops_on_day": int(buf) + 1 if days > buf else None,
            "covered_by_buffer": short == 0,
        })
    total = own + sum(ch["lost_revenue"].value for ch in children)
    company = sum(pl.revenue for pl in plants.values())
    return {
        "own_lost_revenue": V(own, "inr_cr", src),
        "children": children,
        "total_lost_revenue": V(total, "inr_cr", src + ([p.asm("buffer_days")] if children else [])),
        "pct_company_revenue": V(100 * total / company, "pct", src + ([p.asm("buffer_days")] if children else [])),
        "buffer_days": Value(value=buf, unit="days", kind="assumption", source_ids=[p.asm("buffer_days")]),
        "note": None if children else "No downstream plants.",
    }
