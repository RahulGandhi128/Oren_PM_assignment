from fastapi.testclient import TestClient

from backend.app.engine.params import load_assumptions, make_params
from backend.app.main import app

client = TestClient(app)


def test_preset_values_are_inside_allowed_ranges_and_ordered():
    for a in load_assumptions():
        if "conservative" in a:
            assert a["min"] <= a["conservative"] <= a["max"], a["id"]
            assert a["min"] <= a["severe"] <= a["max"], a["id"]
    for p in client.get("/api/presets").json():
        make_params(p["overrides"])  # would raise on a bad value


def test_central_is_the_official_set():
    central = next(p for p in client.get("/api/presets").json() if p["id"] == "central")
    assert central["overrides"] == {}


def test_presets_bracket_the_official_numbers():
    s = client.get("/api/summary").json()
    for h, key in (("today", "today"), ("2040", "future")):
        lo = s["preset_range"]["conservative"][h]["value"]
        hi = s["preset_range"]["severe"][h]["value"]
        assert lo < s[key]["revenue_at_risk"]["value"] < hi


def test_sensitivity_finds_key_drivers():
    r = client.post("/api/sensitivity", json={"overrides": {}}).json()
    key = {x["id"] for x in r["rows"] if x["key"]}
    assert {"heat_loss_per_day_integrated", "curtail_days_extremely_high", "operating_days", "buffer_days"} <= key
    assert "flood_prob_band_0_1" not in key
    assert all(x["revenue_low"] <= r["revenue_now"] + 1e-9 <= x["revenue_high"] + 2e-9 for x in r["rows"])


def test_sensitivity_rejects_bad_overrides():
    assert client.post("/api/sensitivity", json={"overrides": {"operating_days": 1}}).status_code == 422


def test_range_sensitivity_min_max_others_central():
    r = client.get("/api/sensitivity").json()
    assert r["rows"], "no rows"
    top = r["rows"][0]
    assert top["swing"] >= r["rows"][-1]["swing"]
    # operating days: fewer days -> more revenue per day -> more at risk (hand check direction and value)
    od = next(x for x in r["rows"] if x["id"] == "operating_days")
    assert od["total_at_min"] > r["central_total"] > od["total_at_max"]
    assert od["total_at_min"] == __import__("pytest").approx(r["central_total"] * 330 / 300, rel=1e-6)
    assert not any(x["group"] in ("Risk bands", "Map display") for x in r["rows"])


def test_summary_has_central_preset_and_kickers():
    s = client.get("/api/summary").json()
    assert s["preset_range"]["central"]["2040"]["value"] == __import__("pytest").approx(s["future"]["revenue_at_risk"]["value"])
    assert all(f["kicker"] for f in s["findings"])
    assert client.get("/api/health").json()["data_as_of"] == "2026-11-21"
