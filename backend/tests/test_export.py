import csv
import io
import json

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from backend.app.export import _js_num
from backend.app.main import app

client = TestClient(app)


def _presets():
    return {p["id"]: p["overrides"] for p in client.get("/api/presets").json()}


def test_xlsx_has_the_five_sheets_and_physical_only_note():
    r = client.get("/api/export.xlsx")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["About", "Exposure", "Hazard inputs", "Assumptions", "Sources"]
    about = {row[0]: row[1] for row in wb["About"].iter_rows(values_only=True) if row[0]}
    assert "Physical risk only · transition risk not yet included" in about
    assert about["Assumption set"].startswith("Central · ")
    assert about["Assumptions changed from default"].startswith("None")


def test_exposure_totals_match_the_summary_with_overrides():
    sev = _presets()["severe"]
    s = client.post("/api/summary", json={"overrides": sev}).json()
    r = client.get("/api/export/exposure.csv", params={"overrides": json.dumps(sev)})
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig"))))
    tot = {row["Horizon"]: float(row["Physical risk: revenue at risk (₹ cr/yr)"]) for row in rows if row["Plant ID"] == "ALL"}
    assert abs(tot["Now"] - s["today"]["revenue_at_risk"]["value"]) < 0.01
    assert abs(tot["2040"] - s["future"]["revenue_at_risk"]["value"]) < 0.01
    assert r.headers["x-assumption-set"].startswith("Severe - ")


def test_assumptions_sheet_marks_edited_values():
    r = client.get("/api/export/assumptions.csv", params={"overrides": json.dumps({"curtail_days_low": 1})})
    rows = {row["ID"]: row for row in csv.DictReader(io.StringIO(r.content.decode("utf-8-sig")))}
    assert rows["curtail_days_low"]["Edited"] == "Yes" and float(rows["curtail_days_low"]["Value used"]) == 1
    assert sum(row["Edited"] == "Yes" for row in rows.values()) == 1
    assert r.headers["x-assumption-set"].startswith("Custom - ")


def test_set_id_is_stable_and_changes_with_any_value():
    a = client.get("/api/export/sources.csv").headers["x-assumption-set"]
    b = client.get("/api/export/sources.csv").headers["x-assumption-set"]
    c = client.get("/api/export/sources.csv", params={"overrides": json.dumps({"curtail_days_low": 1})}).headers["x-assumption-set"]
    assert a == b and a.split(" - ")[1] != c.split(" - ")[1]


def test_bad_requests():
    assert client.get("/api/export/nope.csv").status_code == 404
    assert client.get("/api/export.xlsx", params={"overrides": "not json"}).status_code == 422
    assert client.get("/api/export.xlsx", params={"overrides": json.dumps({"curtail_days_low": 99999})}).status_code == 422
    assert client.get("/api/export.xlsx", params={"overrides": json.dumps({"unknown_id": 1})}).status_code == 422


def test_numbers_are_written_like_javascript():
    assert [_js_num(x) for x in (12.0, 12, 0.1, 1.5, 0.001, 1e-7, 2.5e21)] == ["12", "12", "0.1", "1.5", "0.001", "1e-7", "2.5e+21"]
