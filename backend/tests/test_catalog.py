from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app

ROOT = Path(__file__).resolve().parents[2]
client = TestClient(app)


def test_catalog_lists_v1_and_v2_sources():
    c = client.get("/api/catalog").json()
    ids = {s["id"] for s in c["sources"]}
    assert {"openmeteo_climate", "aqueduct40", "openmeteo_flood", "plants_csv", "osm_india"} <= ids
    assert {"ccts_gei_rules", "icap_india", "ngfs", "worldbank_carbon_pricing", "icap_prices", "climate_trace"} <= ids


def test_v1_output_files_really_exist():
    for s in client.get("/api/catalog").json()["sources"]:
        if s["group"] != "v1":
            continue
        for o in s["outputs"]:
            assert (ROOT / o["path"]).exists(), f"{s['id']}: {o['path']} missing"


def test_v1_scripts_exist():
    for s in client.get("/api/catalog").json()["sources"]:
        for script in s["scripts"]:
            assert (ROOT / script).exists(), script
