"""Assumptions (backend/data/assumptions.yaml) plus session overrides."""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

ASSUMPTIONS_YAML = Path(__file__).resolve().parents[2] / "data" / "assumptions.yaml"


class OverrideError(ValueError):
    """Bad override: unknown id, out of [min, max], or inconsistent band thresholds."""


@lru_cache
def load_assumptions() -> tuple[dict, ...]:
    return tuple(yaml.safe_load(ASSUMPTIONS_YAML.read_text()))


@dataclass(frozen=True)
class Params:
    values: dict[str, float]
    overridden: dict[str, float] = field(default_factory=dict)

    def __getitem__(self, key: str) -> float:
        return self.values[key]

    @staticmethod
    def asm(key: str) -> str:
        """Source id used in Value.source_ids for an assumption."""
        return f"asm.{key}"


def make_params(overrides: dict[str, float] | None = None, base: dict[str, float] | None = None) -> Params:
    """Defaults from assumptions.yaml (or `base`, used by tests), with validated overrides applied."""
    spec = {a["id"]: a for a in load_assumptions()}
    values = dict(base) if base is not None else {k: float(a["value"]) for k, a in spec.items()}
    applied: dict[str, float] = {}
    for k, v in (overrides or {}).items():
        if k not in spec:
            raise OverrideError(f"Unknown assumption '{k}'.")
        lo, hi = float(spec[k]["min"]), float(spec[k]["max"])
        if not (lo <= float(v) <= hi):
            raise OverrideError(f"'{spec[k]['label']}' must be between {lo:g} and {hi:g} {spec[k]['unit']} (got {v:g}).")
        if float(v) != float(spec[k]["value"]):
            applied[k] = float(v)
        values[k] = float(v)
    if not (values["band_moderate_pct"] < values["band_high_pct"] < values["band_severe_pct"]):
        raise OverrideError("Band thresholds must increase: Moderate < High < Severe.")
    return Params(values=values, overridden=applied)
