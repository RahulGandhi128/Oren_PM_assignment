"""Assumption presets (Conservative / Central / Severe) and the sensitivity test.

Central is the official set: the defaults in assumptions.yaml, i.e. no overrides.
Conservative and Severe set every assumption that has a plausible range to its lower-loss
or higher-loss end. Band thresholds and map-display settings are never changed by a preset.
"""
from __future__ import annotations

from functools import lru_cache

from .params import OverrideError, load_assumptions, make_params
from .run import run_exposure

PRESET_TEXT = {
    "conservative": ("Conservative", "Lower-loss end of every plausible range: fewer lost days, rarer and shorter floods, more clinker stock."),
    "central": ("Central (official)", "The official set: the default value of every assumption, as documented below."),
    "severe": ("Severe", "Higher-loss end of every plausible range: more lost days, more frequent and longer floods, less clinker stock."),
}
# Kept prominent even though it barely moves expected annual loss: it decides the stress-test result.
PINNED_KEY = {"buffer_days": "Barely moves the annual figure, but decides how fast an outage reaches the grinding units (stress test)."}
KEY_SHARE = 0.05  # a key driver swings the central 2040 total by at least 5%


def preset_overrides(pid: str) -> dict[str, float]:
    if pid == "central":
        return {}
    return {a["id"]: float(a[pid]) for a in load_assumptions() if pid in a and float(a[pid]) != float(a["value"])}


def presets() -> list[dict]:
    return [{"id": k, "label": t[0], "description": t[1], "overrides": preset_overrides(k)} for k, t in PRESET_TEXT.items()]


def sensitivity(overrides: dict[str, float]) -> dict:
    base_p = make_params(overrides)
    now = run_exposure("2040", base_p).company
    key = _key_ids()
    rows = []
    for a in load_assumptions():
        if "conservative" not in a:
            continue
        res = {}
        for end in ("conservative", "severe"):
            c = run_exposure("2040", make_params({**overrides, a["id"]: float(a[end])})).company
            res[end] = (c.revenue_at_risk.value, c.asset_damage.value)
        rows.append({
            "id": a["id"],
            "revenue_low": res["conservative"][0], "revenue_high": res["severe"][0],
            "asset_low": res["conservative"][1], "asset_high": res["severe"][1],
            "swing": res["severe"][0] - res["conservative"][0],
            "key": a["id"] in key, "key_reason": PINNED_KEY.get(a["id"]),
        })
    rows.sort(key=lambda r: -r["swing"])
    return {"horizon": "2040", "revenue_now": now.revenue_at_risk.value, "asset_now": now.asset_damage.value,
            "rows": rows, "key_threshold": _central_total() * KEY_SHARE}


@lru_cache
def _central_total() -> float:
    return run_exposure("2040", make_params()).company.revenue_at_risk.value


@lru_cache
def _key_ids() -> frozenset[str]:
    """Key drivers are fixed at the official set so the layout does not reshuffle while editing."""
    thr = _central_total() * KEY_SHARE
    out = set(PINNED_KEY)
    for a in load_assumptions():
        if "conservative" not in a:
            continue
        lo = run_exposure("2040", make_params({a["id"]: float(a["conservative"])})).company.revenue_at_risk.value
        hi = run_exposure("2040", make_params({a["id"]: float(a["severe"])})).company.revenue_at_risk.value
        if hi - lo >= thr:
            out.add(a["id"])
    return frozenset(out)


NO_MONEY_GROUPS = {"Risk bands", "Map display"}


@lru_cache
def range_sensitivity() -> dict:
    """2040 company revenue at risk with each assumption at its allowed min and max, others at Central."""
    central = _central_total()
    rows = []
    for a in load_assumptions():
        if a["group"] in NO_MONEY_GROUPS:
            continue
        try:
            lo = run_exposure("2040", make_params({a["id"]: float(a["min"])})).company.revenue_at_risk.value
            hi = run_exposure("2040", make_params({a["id"]: float(a["max"])})).company.revenue_at_risk.value
        except OverrideError:
            continue
        if abs(hi - lo) < 0.05:
            continue
        rows.append({"id": a["id"], "label": a["label"], "unit": a["unit"], "group": a["group"],
                     "min": float(a["min"]), "max": float(a["max"]),
                     "total_at_min": lo, "total_at_max": hi, "swing": abs(hi - lo)})
    rows.sort(key=lambda r: -r["swing"])
    return {"horizon": "2040", "central_total": central, "rows": rows}
