import csv
import json

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.loaders import DATA_DIR, PLANTS_CSV

client = TestClient(app)
HZ = json.loads((DATA_DIR / "hazards.json").read_text())["plants"]
REG = {r["plant_id"]: r for r in csv.DictReader(PLANTS_CSV.open(newline=""))}


def _high_risk(pid: str) -> bool:
    coastal = REG[pid]["coastal"].strip().upper() == "Y"
    return HZ[pid]["riverine_flood_score"]["cat"] >= 3 or (coastal and HZ[pid]["coastal_flood_score"]["cat"] >= 3)


def test_assets_in_high_risk_locations_uses_own_aqueduct_rating():
    s = client.get("/api/summary").json()
    expected = sum(float(REG[p]["asset_value_inr_cr"]) for p in REG if _high_risk(p))
    gross = sum(float(r["asset_value_inr_cr"]) for r in REG.values())
    for k in ("today", "future"):
        c = s[k]
        assert abs(c["assets_in_high_risk_locations"]["value"] - expected) < 1e-6
        assert abs(c["gross_block"]["value"] - gross) < 1e-6
        assert abs(c["assets_in_high_risk_share"]["value"] - 100 * expected / gross) < 1e-6
        assert c["plants_in_high_risk_locations"] == sum(_high_risk(p) for p in REG)


def test_worker_heat_days_is_employees_times_heat_days():
    s = client.get("/api/summary").json()
    for k, h in (("today", "today"), ("future", "2040")):
        expected = sum(float(REG[p]["employees"]) * HZ[p]["heat_days_40c"][h] for p in REG)
        assert abs(s[k]["worker_heat_days"]["value"] - expected) < 1e-6


def test_assets_and_people_are_not_added_to_revenue_at_risk():
    s = client.get("/api/summary").json()["today"]
    rows = client.post("/api/exposure", json={"horizon": "today", "overrides": {}}).json()["plants"]
    assert abs(sum(r["total_revenue_at_risk"]["value"] for r in rows) - s["revenue_at_risk"]["value"]) < 1e-6


def test_plant_detail_has_both_horizons():
    d = client.get("/api/plants/P07").json()["assets_people"]
    assert set(d) == {"today", "2040"}
    assert d["today"]["location_hazards"] == ["coastal"]  # Mundra: coastal flood rated High, river flood not
    assert d["2040"]["worker_heat_days"]["value"] >= d["today"]["worker_heat_days"]["value"]
