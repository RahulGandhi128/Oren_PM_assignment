"""Build backend/data/catalog.json for the developer Data page (/data).

One entry per source: what it is for, how to get it, an example request, a real sample of
what comes back (cut from the files in the repo, never typed by hand), which repo files it
produces, when it was last refreshed, and caveats. Output-file existence is checked here,
at build time, because raw files are excluded from the deployed function.

Links were opened and checked on 2026-11-21 (see the 'links_checked' field).

Run:  .venv-pipeline/bin/python -I backend/pipeline/build_catalog.py
"""
from __future__ import annotations

import csv
import gzip
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend/data"
SRC = DATA / "source"
LINKS_CHECKED = "2026-11-21"


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def file_entry(path: str, role: str) -> dict:
    p = ROOT / path
    exists = p.exists()
    size = (sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) if p.is_dir() else p.stat().st_size) if exists else None
    return {"path": path, "role": role, "exists": exists, "bytes": size}


def sample_openmeteo() -> str:
    b = json.loads(gzip.decompress((SRC / "openmeteo_climate/raw/P01.json.gz").read_bytes()))
    cols = ["temperature_2m_max_MRI_AGCM3_2_S", "precipitation_sum_MRI_AGCM3_2_S"]
    cut = {k: b[k] for k in ("latitude", "longitude", "elevation")}
    cut["daily_units"] = {"time": b["daily_units"]["time"], **{c: b["daily_units"][c] for c in cols}}
    cut["daily"] = {"time": b["daily"]["time"][:3], **{c: b["daily"][c][:3] for c in cols}}
    return json.dumps(cut, indent=1, ensure_ascii=False) + "\n// …14 columns (2 variables × 7 models), 36,890 days. Cut from raw/P01.json.gz."


def sample_csv(path: Path, cols: list[str] | None = None, rows: int = 1) -> str:
    with path.open(newline="") as f:
        r = list(csv.DictReader(f))[:rows]
    keep = cols or list(r[0])
    out = [",".join(keep)] + [",".join(str(x.get(c, "")) for c in keep) for x in r]
    return "\n".join(out)


def sample_json(path: Path) -> str:
    return json.dumps(json.loads(path.read_text()), indent=1, ensure_ascii=False)


def sample_geo() -> str:
    head = (SRC / "geo/india-osm.json").read_text()[:160]
    return head + " …\n// One MultiPolygon feature (national boundary). Simplified to public/geo/india.json (49 KB)."


def manifest_latest() -> str:
    m = json.loads((SRC / "openmeteo_climate/manifest.json").read_text())
    return max(p["fetched_at"] for p in m["plants"].values())[:10]


def meta(name: str) -> dict:
    return json.loads((SRC / "samples" / name).read_text())


def main() -> None:
    flood_meta, ct_meta = meta("openmeteo_flood_P03_sample.meta.json"), meta("climatetrace_cement_IND_sample.meta.json")
    ct = json.loads((SRC / "samples/climatetrace_cement_IND_sample.json").read_text())[:1]

    sources = [
        # ------------------------------------------------------------------ v1
        {
            "id": "openmeteo_climate", "name": "Open-Meteo Climate API", "group": "v1",
            "purpose": "Daily max temperature and rainfall, 1950–2050, from 7 high-resolution climate models. Gives days ≥40 °C and the wettest day of the year, today and 2040.",
            "access": "API", "status": "Used in v1",
            "links": [{"label": "API docs", "url": "https://open-meteo.com/en/docs/climate-api"}],
            "request": "GET https://climate-api.open-meteo.com/v1/climate?latitude=24.8887&longitude=74.6269&start_date=1950-01-01&end_date=2050-12-31&models=CMCC_CM2_VHR4,FGOALS_f3_H,HiRAM_SIT_HR,MRI_AGCM3_2_S,EC_Earth3P_HR,MPI_ESM1_2_XR,NICAM16_8S&daily=temperature_2m_max,precipitation_sum",
            "sample": sample_openmeteo(), "sample_format": "json",
            "outputs": [
                file_entry("backend/data/source/openmeteo_climate/raw", "Raw responses, one gzip per plant"),
                file_entry("backend/data/source/openmeteo_climate/manifest.json", "Exact request URL, time, cost, checksum per plant"),
                file_entry("backend/data/source/openmeteo_climate/processed/climate_summary.json", "Heat days and wettest day per plant"),
                file_entry("backend/data/hazards.json", "Read by the API"),
            ],
            "scripts": ["backend/pipeline/fetch_openmeteo.py", "backend/pipeline/process_openmeteo.py", "backend/pipeline/build_hazards.py"],
            "last_refreshed": manifest_latest(),
            "caveats": [
                "Free tier: 10,000 weighted calls a day per IP; one plant (101 years × 14 columns) costs about 3,700, so a full refresh takes two days.",
                "One high-emissions pathway (HighResMIP), so no scenario choice.",
                "Not bias-corrected: heat-day counts look high. EC_Earth3P_HR has no 2050; NICAM16_8S has implausible temperatures. See Issues & notes.",
            ],
            "licence": "CC BY 4.0, attribute Open-Meteo.com",
        },
        {
            "id": "aqueduct40", "name": "WRI Aqueduct 4.0", "group": "v1",
            "purpose": "Water stress today and in 2030/2050 under three scenarios, riverine and coastal flood risk scores (0–5) for each plant's river basin.",
            "access": "Download", "status": "Used in v1",
            "links": [
                {"label": "Data download", "url": "https://www.wri.org/data/aqueduct-global-maps-40-data"},
                {"label": "Technical note", "url": "https://www.wri.org/research/aqueduct-40-updated-decision-relevant-global-water-risk-indicators"},
                {"label": "Water Risk Atlas", "url": "https://www.wri.org/applications/aqueduct/water-risk-atlas"},
            ],
            "request": "Lookup per plant point in the Water Risk Atlas (see raw/aqueduct40_README.md). For a full rebuild: download the Aqueduct 4.0 baseline and future annual tables and basin geometry, then join each plant point to its basin.",
            "sample": sample_csv(SRC / "aqueduct40/raw/aqueduct40_baseline_plants.csv",
                                 ["plant_id", "plant", "pfaf_id", "bws_raw", "bws_score", "bws_cat", "bws_label", "rfr_score", "cfr_score"]),
            "sample_format": "csv",
            "outputs": [
                file_entry("backend/data/source/aqueduct40/raw", "Files as supplied (baseline, future, summary, README)"),
                file_entry("backend/data/source/aqueduct40/processed/aqueduct_plants.json", "Validated per-plant values"),
                file_entry("backend/data/source/aqueduct40/processed/checks.json", "462 consistency checks"),
                file_entry("backend/data/hazards.json", "Read by the API"),
            ],
            "scripts": ["backend/pipeline/process_aqueduct.py", "backend/pipeline/build_hazards.py"],
            "last_refreshed": "2026-11-21",
            "caveats": [
                "Lookups use approximate town-centre points; Satna's is 1.7 km from the register location.",
                "2040 is the midpoint of 2030 and 2050 (estimated). Business-as-usual = SSP3-7.0.",
                "Basin geometry and data dictionary are not in the repo; the lookup was done upstream.",
                "Mundra's baseline row is malformed (two extra values); its drought and overall-risk fields are left empty.",
            ],
            "licence": "CC BY 4.0, attribute World Resources Institute",
        },
        {
            "id": "openmeteo_flood", "name": "Open-Meteo Flood API", "group": "v1",
            "purpose": "Daily river discharge from 1984 (GloFAS). Planned as flood history for river plants (Chandrapur on the Wardha, Durgapur on the Damodar). Not used in the ₹ figures.",
            "access": "API", "status": "Optional",
            "links": [{"label": "API docs", "url": "https://open-meteo.com/en/docs/flood-api"}],
            "request": "GET " + flood_meta["request"],
            "sample": sample_json(SRC / "samples/openmeteo_flood_P03_sample.json"), "sample_format": "json",
            "outputs": [file_entry("backend/data/source/samples/openmeteo_flood_P03_sample.json", "Example response only")],
            "scripts": [],
            "last_refreshed": flood_meta["fetched_at"][:10],
            "caveats": ["Grid cell is about 5 km; small rivers may not be resolved. Shares the Open-Meteo daily call limit."],
            "licence": "CC BY 4.0, attribute Open-Meteo.com and GloFAS",
        },
        {
            "id": "plants_csv", "name": "Nimbus Cement plant register", "group": "v1",
            "purpose": "The nine plants: location, type, capacity, output, clinker flows, water source, coastal flag, asset value, revenue.",
            "access": "Provided file", "status": "Used in v1",
            "links": [],
            "request": "Supplied with the brief. Replace with the company's asset register for a real build.",
            "sample": sample_csv(SRC / "plants/nimbus_cement_plants.csv",
                                 ["plant_id", "plant_name", "state", "latitude", "longitude", "plant_type", "water_source", "coastal", "asset_value_inr_cr", "revenue_fy2025_26_inr_cr"]),
            "sample_format": "csv",
            "outputs": [
                file_entry("backend/data/source/plants/nimbus_cement_plants.csv", "Read by the API as is"),
                file_entry("backend/data/network.json", "Clinker flows (shipped tonnes and destinations from the register)"),
            ],
            "scripts": [],
            "last_refreshed": "2026-11-21",
            "caveats": ["Clinker destinations come from the free-text notes column; check them against logistics data."],
            "licence": "Provided with the brief",
        },
        {
            "id": "osm_india", "name": "India boundary (OpenStreetMap)", "group": "v1",
            "purpose": "National outline for the map, including India's full claimed boundary in Jammu & Kashmir, Ladakh and Arunachal Pradesh.",
            "access": "Download", "status": "Used in v1",
            "links": [{"label": "OSM licence", "url": "https://www.openstreetmap.org/copyright"},
                      {"label": "DataMeet maps (state boundaries, not used)", "url": "https://github.com/datameet/maps"}],
            "request": "OSM relation for India, admin_level 2, exported as GeoJSON (supplied file).",
            "sample": sample_geo(), "sample_format": "json",
            "outputs": [
                file_entry("backend/data/source/geo/india-osm.json", "Supplied extract (5.6 MB)"),
                file_entry("public/geo/india.json", "Simplified outline served to the browser"),
            ],
            "scripts": ["backend/pipeline/build_geo.py"],
            "last_refreshed": "2026-11-21",
            "caveats": ["National outline only; state shading would need a state-boundary file."],
            "licence": "ODbL 1.0, © OpenStreetMap contributors",
        },
        # ------------------------------------------------------------------ v2 (transition risk)
        {
            "id": "ccts_gei_rules", "name": "CCTS emission-intensity targets (Government of India)", "group": "v2",
            "purpose": "Greenhouse Gases Emission Intensity Target Rules, 2025 under the Carbon Credit Trading Scheme. Sets per-plant targets for cement (2025-26 and 2026-27 against a 2023-24 baseline).",
            "access": "Manual PDF", "status": "v2",
            "links": [
                {"label": "Rules (FAOLEX record)", "url": "https://faolex.fao.org/en/documents/LEX-FAOC247288/greenhouse-gases-emission-intensity-target-rules-2025-ind-2025"},
                {"label": "Jan 2026 amendment (PIB)", "url": "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2217239"},
            ],
            "request": "Download the gazette PDF; copy the cement schedule (entity, baseline and target intensity) into a CSV by hand.",
            "sample": None, "sample_format": None,
            "outputs": [{"path": "backend/data/source/ccts/gei_targets_cement.csv", "role": "Planned", "exists": False, "bytes": None}],
            "scripts": [],
            "last_refreshed": None,
            "caveats": ["Nimbus has no row in this list; a real build needs the company's own obligated-entity entry.",
                        "Final targets were reduced pro rata for the late notification; use the gazette, not the draft."],
            "licence": "Government of India publication",
        },
        {
            "id": "icap_india", "name": "ICAP factsheet: Indian Carbon Credit Trading Scheme", "group": "v2",
            "purpose": "Plain-language summary of the scheme's design: coverage, allocation, offsets and timeline.",
            "access": "Manual PDF", "status": "v2",
            "links": [
                {"label": "ETS profile", "url": "https://icapcarbonaction.com/en/ets/india"},
                {"label": "Factsheet PDF", "url": "https://icapcarbonaction.com/en/ets-pdf-download/125"},
                {"label": "Oct 2025 targets news", "url": "https://icapcarbonaction.com/en/news/india-notifies-emission-intensity-targets-nine-sectors-under-carbon-credit-trading-scheme"},
            ],
            "request": "Read the factsheet; no data to load.",
            "sample": None, "sample_format": None, "outputs": [], "scripts": [], "last_refreshed": None,
            "caveats": ["A secondary summary; cite the gazette for numbers."],
            "licence": "ICAP terms of use",
        },
        {
            "id": "ngfs", "name": "NGFS climate scenarios (IIASA Scenario Explorer)", "group": "v2",
            "purpose": "Carbon price paths to 2050 under orderly, disorderly and hot-house scenarios, to turn CCTS shortfalls into a ₹ cost.",
            "access": "Account needed", "status": "v2",
            "links": [
                {"label": "Scenario Explorer (guest login)", "url": "https://data.ece.iiasa.ac.at/ngfs/"},
                {"label": "NGFS data resources", "url": "https://www.ngfs.net/ngfs-scenarios-portal/data-resources/"},
            ],
            "request": "Log in as guest, open Downloads, take the IAMC-format CSV; filter region = India (or Asia), variable Price|Carbon.",
            "sample": None, "sample_format": None, "outputs": [], "scripts": [], "last_refreshed": None,
            "caveats": ["Licence restricts redistributing substantial parts of the data; commit only the filtered rows.",
                        "Model-based shadow prices, not market prices.",
                        "NGFS warns that the paper behind its Phase V physical-damage estimates (Kotz et al., 2024) has been retracted. Use the transition variables (carbon prices), not the physical-damage outputs.",
                        "ngfs.net and the World Bank dashboard refuse scripted requests (HTTP 403); open them in a browser."],
            "licence": "NGFS / IIASA licence",
        },
        {
            "id": "worldbank_carbon_pricing", "name": "World Bank Carbon Pricing Dashboard", "group": "v2",
            "purpose": "Which carbon taxes and trading schemes exist, their coverage and prices, for comparing India with peers.",
            "access": "Download", "status": "v2",
            "links": [{"label": "Dashboard", "url": "https://carbonpricingdashboard.worldbank.org/"}],
            "request": "Download the data file from the dashboard (Excel).",
            "sample": None, "sample_format": None, "outputs": [], "scripts": [], "last_refreshed": None,
            "caveats": ["Annual snapshot; India's scheme has no traded price yet."],
            "licence": "World Bank terms of use",
        },
        {
            "id": "icap_prices", "name": "ICAP Allowance Price Explorer", "group": "v2",
            "purpose": "Historical allowance prices for existing trading schemes, as reference points for a future Indian credit price.",
            "access": "Download", "status": "v2",
            "links": [{"label": "Price explorer", "url": "https://icapcarbonaction.com/en/ets-prices"}],
            "request": "Select the schemes and download the price series.",
            "sample": None, "sample_format": None, "outputs": [], "scripts": [], "last_refreshed": None,
            "caveats": ["Prices are in local currency; convert with a stated exchange rate."],
            "licence": "ICAP terms of use",
        },
        {
            "id": "climate_trace", "name": "Climate TRACE", "group": "v2",
            "purpose": "Independent plant-level emissions estimates for Indian cement plants, to sense-check reported Scope 1 and benchmark intensity against peers.",
            "access": "API", "status": "v2",
            "links": [{"label": "API reference (v7)", "url": "https://api.climatetrace.org/"},
                      {"label": "Data downloads", "url": "https://climatetrace.org/data"}],
            "request": "GET " + ct_meta["request"],
            "sample": json.dumps(ct, indent=1, ensure_ascii=False) + "\n// first of 2 results", "sample_format": "json",
            "outputs": [{"path": "backend/data/source/samples/climatetrace_cement_IND_sample.json", "role": "Example response only",
                         **{k: v for k, v in file_entry("backend/data/source/samples/climatetrace_cement_IND_sample.json", "").items() if k in ("exists", "bytes")}}],
            "scripts": [],
            "last_refreshed": ct_meta["fetched_at"][:10],
            "caveats": ["Beta API: availability not guaranteed, keep request volume low.", "Model estimates, not reported emissions."],
            "licence": "CC BY 4.0, attribute Climate TRACE",
        },
    ]
    missing = [o["path"] for s in sources if s["status"] == "Used in v1" for o in s["outputs"] if not o["exists"]]
    if missing:
        raise SystemExit(f"v1 output files missing: {missing}")
    out = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "links_checked": LINKS_CHECKED, "sources": sources}
    (DATA / "catalog.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"catalog.json: {len(sources)} sources; all v1 output files present")


if __name__ == "__main__":
    main()
