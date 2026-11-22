"""Spec 7.7 fixture. Expected values are computed by hand here, not by calling the engine twice."""
import pytest

from backend.app.engine.exposure import HazardIn, PlantIn, compute_plant
from backend.app.engine.params import OverrideError, make_params

P = make_params()  # defaults from assumptions.yaml: D_op 330, heat 0.10, High 6 days, groundwater 1.2, ...

PLANT = PlantIn(id="TEST", type="integrated", revenue=330, asset=1000, water_source="Groundwater", coastal=False)
HZ = HazardIn(heat_days={"today": 20, "2040": 20}, ws_cat={"today": "High", "2040": "High"},
              rfr_score=3.5, cfr_score=0.0, rx1day_change_pct=10.0)


def test_defaults_match_fixture_assumptions():
    assert (P["operating_days"], P["heat_loss_per_day_integrated"], P["curtail_days_high"], P["source_factor_groundwater"]) == (330, 0.10, 6, 1.2)
    assert (P["flood_prob_band_3_4"], P["flood_downtime_days"], P["flood_damage_ratio"], P["flood_elasticity"]) == (0.04, 14, 0.02, 2.0)


def test_today_by_hand():
    r = compute_plant(PLANT, HZ, P, "today")
    per_day = 330 / 330  # ₹1 cr a day
    # heat: 20 days x 0.10 = 2.0 days -> ₹2.0 cr
    assert r["heat"]["downtime_days"].value == pytest.approx(20 * 0.10)
    assert r["heat"]["revenue_at_risk"].value == pytest.approx(2.0 * per_day)
    # water: High 6 days x groundwater 1.2 = 7.2 days -> ₹7.2 cr
    assert r["water"]["downtime_days"].value == pytest.approx(6 * 1.2)
    assert r["water"]["revenue_at_risk"].value == pytest.approx(7.2)
    # flood: score 3.5 -> p 0.04; 0.04 x 14 = 0.56 days -> ₹0.56 cr; asset 0.04 x 0.02 x 1000 = ₹0.8 cr
    assert r["flood"]["probability"].value == pytest.approx(0.04)
    assert r["flood"]["downtime_days"].value == pytest.approx(0.56)
    assert r["flood"]["revenue_at_risk"].value == pytest.approx(0.56)
    assert r["flood"]["asset_damage"].value == pytest.approx(0.8)
    # not coastal -> zero, derived, noted
    assert r["coastal"]["revenue_at_risk"].value == 0
    assert r["coastal"]["revenue_at_risk"].note == "not coastal"


def test_2040_flood_probability_by_hand():
    r = compute_plant(PLANT, HZ, P, "2040")
    assert r["flood"]["probability"].value == pytest.approx(0.04 * (1 + 0.10 * 2.0))  # 0.048
    assert r["flood"]["revenue_at_risk"].value == pytest.approx(0.048 * 14)


def test_every_number_is_derived_and_lists_assumptions():
    r = compute_plant(PLANT, HZ, P, "today")
    v = r["water"]["revenue_at_risk"]
    assert v.kind == "derived"
    assert {"asm.curtail_days_high", "asm.source_factor_groundwater", "asm.operating_days", "aqueduct40"} <= set(v.source_ids)


def test_negative_rain_change_never_lowers_flood_probability():
    hz = HazardIn(**{**HZ.__dict__, "rx1day_change_pct": -30.0})
    assert compute_plant(PLANT, hz, P, "2040")["flood"]["probability"].value == pytest.approx(0.04)


def test_overrides_validated():
    with pytest.raises(OverrideError):
        make_params({"operating_days": 400})
    with pytest.raises(OverrideError):
        make_params({"no_such_thing": 1})
    with pytest.raises(OverrideError):
        make_params({"band_high_pct": 0.5})  # below Moderate
    assert make_params({"operating_days": 300})["operating_days"] == 300
