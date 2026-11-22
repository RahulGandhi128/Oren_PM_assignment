import pytest
from fastapi.testclient import TestClient

from backend.app.engine.exposure import HazardIn, PlantIn
from backend.app.engine.network import EdgeIn, inherited, stress
from backend.app.engine.params import make_params
from backend.app.main import app

P = make_params()
client = TestClient(app)

# Real register figures for Baloda Bazar (P06) and its grinding units
R = {"P06": 1275, "P08": 536, "P09": 624}


def test_stress_p06_20_days_by_hand():
    r = client.post("/api/stress", json={"plant_id": "P06", "days": 20}).json()
    own = 20 * R["P06"] / 330
    child = {k: (20 - 10) * R[k] / 330 for k in ("P08", "P09")}
    assert r["own_lost_revenue"]["value"] == pytest.approx(own)
    got = {c["plant_id"]: c for c in r["children"]}
    assert set(got) == {"P08", "P09"}
    for k in child:
        assert got[k]["lost_revenue"]["value"] == pytest.approx(child[k])
        assert got[k]["stops_on_day"] == 11
    total = own + sum(child.values())
    assert r["total_lost_revenue"]["value"] == pytest.approx(total)
    company = 1749 + 1511 + 1248 + 999 + 868 + 1275 + 848 + 536 + 624
    assert r["pct_company_revenue"]["value"] == pytest.approx(100 * total / company)


def test_stress_shorter_than_buffer_is_covered():
    r = client.post("/api/stress", json={"plant_id": "P06", "days": 7}).json()
    assert all(c["covered_by_buffer"] and c["lost_revenue"]["value"] == 0 for c in r["children"])
    assert all(c["lost_revenue"]["note"] == "covered by clinker buffer" for c in r["children"])


def test_stress_non_kiln_has_no_downstream():
    r = client.post("/api/stress", json={"plant_id": "P03", "days": 30}).json()
    assert r["children"] == [] and r["note"] == "No downstream plants."


def test_stress_validation():
    assert client.post("/api/stress", json={"plant_id": "P06", "days": 0}).status_code == 422
    assert client.post("/api/stress", json={"plant_id": "P06", "days": 91}).status_code == 422
    assert client.post("/api/stress", json={"plant_id": "P99", "days": 5}).status_code == 404


def test_only_acute_hazards_propagate_by_hand():
    plants = {"K": PlantIn("K", "integrated", 330, 1000, "River", False), "G": PlantIn("G", "grinding", 165, 400, "River", False)}
    hz = {k: HazardIn({"today": 100, "2040": 100}, {"today": "Extremely High", "2040": "Extremely High"}, 3.5, 0, 0) for k in plants}
    inh = inherited(plants, hz, [EdgeIn("K", "G")], P, "today")["G"]
    flood = next(i for i in inh if i["hazard"] == "flood")
    assert flood["downtime_days"].value == pytest.approx(0.04 * (14 - 10))     # p x (d - buffer)
    assert flood["revenue_at_risk"].value == pytest.approx(0.16 * 165 / 330)  # child's own revenue per day
    assert next(i for i in inh if i["hazard"] == "coastal")["revenue_at_risk"].value == 0  # kiln not coastal
    assert {i["hazard"] for i in inh} == {"flood", "coastal"}  # no heat or water inheritance


def test_company_total_is_own_plus_inherited():
    r = client.post("/api/exposure", json={"horizon": "2040"}).json()
    own = sum(p["own_revenue_at_risk"]["value"] for p in r["plants"])
    inh = sum(p["inherited_revenue_at_risk"]["value"] for p in r["plants"])
    assert r["company"]["revenue_at_risk"]["value"] == pytest.approx(own + inh)
    grinding = [p for p in r["plants"] if p["plant_id"] in ("P07", "P08", "P09")]
    assert all(p["inherited_revenue_at_risk"]["value"] > 0 for p in grinding)
    assert all(p["inherited_revenue_at_risk"]["value"] == 0 for p in r["plants"] if p["type"] == "integrated")


def test_api_errors():
    assert client.post("/api/exposure", json={"horizon": "2050"}).status_code == 422
    assert client.post("/api/exposure", json={"horizon": "today", "overrides": {"buffer_days": 999}}).status_code == 422
    assert client.get("/api/plants?horizon=tomorrow").status_code == 422
    assert client.get("/api/plants/P99").status_code == 404


def test_findings_name_baloda_bazar_as_single_point_of_failure():
    f = client.get("/api/summary").json()["findings"]
    assert 3 <= len(f) <= 5
    assert any(x["text"].startswith("Baloda Bazar is a single point of failure") for x in f)
