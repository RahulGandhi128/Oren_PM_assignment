# Source data

Everything Horizon's numbers come from lives here. Raw files are kept exactly as received. Derived files are rebuilt by the scripts in `backend/pipeline/`. The `sources.json` file one level up is the registry the app shows on the Methodology page.

```
source/
├─ plants/
│  └─ nimbus_cement_plants.csv        plant register (provided). Read directly by the API.
├─ geo/
│  └─ india-osm.json                  India boundary, OSM admin_level 2 (provided, 5.6 MB)
├─ aqueduct40/
│  ├─ raw/                            Aqueduct 4.0 plant lookup, as provided (pulled 21 Nov 2026)
│  │  ├─ aqueduct40_baseline_plants.csv    today: water stress, river/coastal flood, drought, basin IDs
│  │  ├─ aqueduct40_future_bws_plants.csv  water stress 2030/2040/2050/2080 × 3 scenarios
│  │  ├─ aqueduct40_plant_summary.csv      one row per plant (used as a cross-check)
│  │  └─ aqueduct40_README.md              how the lookup and derived values were made
│  └─ processed/
│     ├─ aqueduct_plants.json        per plant: basin, water stress today + future by scenario, floods
│     ├─ checks.json                 consistency checks (score formula, 2040 midpoints, summary agreement)
│     └─ findings.json               coordinates offset, scenario disagreement, category rises, malformed rows
└─ openmeteo_climate/
   ├─ raw/P01.json.gz … P09.json.gz   raw API responses, one per plant, unchanged (gzipped)
   ├─ manifest.json                   per plant: exact request URL, fetch time, API cost,
   │                                   model grid cell, columns returned, sha256 of raw body
   ├─ fetch.log                       console log of the last fetch run
   └─ processed/
      ├─ annual_by_model.csv          plant × model × year: heat_days_40c, rx1day_mm, missing_days
      ├─ climate_summary.json         Today / 2040 values per model + ensemble median, min, max;
      │                                Rx1day % change; heat series 1980–2050
      └─ qa_report.json               missing years and implausible values per plant × model
```

## Rebuild
```bash
uv venv --python 3.12 .venv-pipeline
uv pip install --python .venv-pipeline/bin/python -r backend/pipeline/requirements-pipeline.txt

.venv-pipeline/bin/python -I backend/pipeline/fetch_openmeteo.py     # resumable; skips plants already saved
.venv-pipeline/bin/python -I backend/pipeline/process_openmeteo.py   # raw → processed/
.venv-pipeline/bin/python -I backend/pipeline/process_aqueduct.py   # aqueduct40/raw → processed/ (stops if any check fails)
.venv-pipeline/bin/python -I backend/pipeline/build_hazards.py      # both processed/ → ../hazards.json + ../issues.json
.venv-pipeline/bin/python -I backend/pipeline/build_geo.py           # india-osm.json → public/geo/india.json
# or: npm run data:build   (process both sources + build_hazards). Restart the API afterwards; it loads data once at start.
```

## Open-Meteo request (one per plant)
`GET https://climate-api.open-meteo.com/v1/climate` with `latitude`, `longitude`, `start_date=1950-01-01`, `end_date=2050-12-31`, `models=CMCC_CM2_VHR4,FGOALS_f3_H,HiRAM_SIT_HR,MRI_AGCM3_2_S,EC_Earth3P_HR,MPI_ESM1_2_XR,NICAM16_8S` and `daily=temperature_2m_max,precipitation_sum`.

Verified on 21 Nov 2026:
- All 7 models return both variables.
- Response columns are named `{variable}_{MODEL}`.
- Coordinates snap to the model grid; the grid cell is recorded in the manifest.
- A full request costs 3,689 rate-limit units, against free-tier limits of 600 a minute, about 5,000 an hour and about 10,000 a day. A full fetch of 9 plants therefore spans more than one day; the script resumes where it stopped.

## Data issues
`build_hazards.py` turns `qa_report.json` into `backend/data/issues.json`. That file feeds the app's **Issues & notes** page and the warning and danger signs shown next to affected numbers. Data is never corrected, only flagged.
