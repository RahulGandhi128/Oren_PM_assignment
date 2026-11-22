"""Fetch daily max temperature and daily rainfall for the 9 Nimbus plants
from the Open-Meteo Climate API (CMIP6 HighResMIP models), 1950-2050.

One request per plant, all models in one call. Each raw JSON response is saved
unchanged (gzipped) so every downstream number can be traced back to it.

Output
  backend/data/source/openmeteo_climate/raw/{plant_id}.json.gz   raw API response
  backend/data/source/openmeteo_climate/manifest.json            request URL, time, cost, checksum per plant

Rate limits (free tier, weighted by data volume): one full plant request costs
about 3,689 units against 600/minute, ~5,000/hour and ~10,000/day. The script is
resumable: it skips plants already saved. On a minute or hour limit it waits and
retries; on a daily limit it stops cleanly so you can run it again the next day.

Run:  .venv-pipeline/bin/python -I backend/pipeline/fetch_openmeteo.py [--plants P02,P03]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
PLANTS_CSV = ROOT / "backend/data/source/plants/nimbus_cement_plants.csv"
OUT_DIR = ROOT / "backend/data/source/openmeteo_climate"
RAW_DIR = OUT_DIR / "raw"
MANIFEST = OUT_DIR / "manifest.json"

URL = "https://climate-api.open-meteo.com/v1/climate"
# Verified against the live API on 21 Nov 2026: all 7 models return both variables,
# columns are named "{variable}_{MODEL}" (e.g. temperature_2m_max_EC_Earth3P_HR).
MODELS = ["CMCC_CM2_VHR4", "FGOALS_f3_H", "HiRAM_SIT_HR", "MRI_AGCM3_2_S", "EC_Earth3P_HR", "MPI_ESM1_2_XR", "NICAM16_8S"]
DAILY = ["temperature_2m_max", "precipitation_sum"]
START, END = "1950-01-01", "2050-12-31"


def params_for(lat: float, lon: float) -> dict:
    return {
        "latitude": lat,
        "longitude": lon,
        "start_date": START,
        "end_date": END,
        "models": ",".join(MODELS),
        "daily": ",".join(DAILY),
    }


def load_plants() -> list[dict]:
    with PLANTS_CSV.open(newline="") as f:
        return [{"id": r["plant_id"], "town": r["town"], "lat": float(r["latitude"]), "lon": float(r["longitude"])} for r in csv.DictReader(f)]


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"source": "openmeteo_climate", "plants": {}}


def save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")


def summarise(body: dict) -> dict:
    cols = [k for k in body.get("daily", {}) if k != "time"]
    return {
        "grid_latitude": body.get("latitude"),
        "grid_longitude": body.get("longitude"),
        "grid_elevation_m": body.get("elevation"),
        "days": len(body.get("daily", {}).get("time", [])),
        "columns": cols,
        "models_returned": sorted({c[len(v) + 1:] for c in cols for v in DAILY if c.startswith(v + "_")}),
    }


class DailyLimit(Exception):
    pass


def fetch(session: requests.Session, plant: dict) -> tuple[bytes, dict]:
    p = params_for(plant["lat"], plant["lon"])
    while True:
        r = session.get(URL, params=p, timeout=300)
        if r.status_code == 200:
            return r.content, {"request_url": r.url, "http_status": 200, "rate_limit_cost": r.headers.get("X-RateLimit-Cost"), "response_date": r.headers.get("Date")}
        reason = ""
        try:
            reason = r.json().get("reason", "")
        except ValueError:
            reason = r.text[:200]
        if r.status_code == 429:
            low = reason.lower()
            if "daily" in low:
                raise DailyLimit(reason)
            wait = 3600 - (int(time.time()) % 3600) + 30 if "hour" in low else 65
            print(f"  rate limited ({reason!r}); waiting {wait}s", flush=True)
            time.sleep(wait)
            continue
        if r.status_code >= 500:
            print(f"  HTTP {r.status_code}; retrying in 30s", flush=True)
            time.sleep(30)
            continue
        raise RuntimeError(f"HTTP {r.status_code}: {reason}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plants", help="comma-separated plant IDs (default: all missing)")
    args = ap.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    plants = load_plants()
    if args.plants:
        wanted = set(args.plants.upper().split(","))
        plants = [p for p in plants if p["id"] in wanted]

    session = requests.Session()
    session.headers["User-Agent"] = "horizon-pipeline/0.1"
    for plant in plants:
        path = RAW_DIR / f"{plant['id']}.json.gz"
        if path.exists() and plant["id"] in manifest["plants"]:
            print(f"{plant['id']} {plant['town']}: already saved, skipping")
            continue
        print(f"{plant['id']} {plant['town']}: fetching {START}..{END}, {len(MODELS)} models", flush=True)
        try:
            raw, meta = fetch(session, plant)
        except DailyLimit as e:
            print(f"Daily API limit reached ({e}). Saved so far is kept; run again tomorrow to continue.")
            save_manifest(manifest)
            return 2
        body = json.loads(raw)
        path.write_bytes(gzip.compress(raw))
        manifest["plants"][plant["id"]] = {
            "town": plant["town"],
            "plant_latitude": plant["lat"],
            "plant_longitude": plant["lon"],
            **meta,
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "file": str(path.relative_to(ROOT)),
            "sha256_uncompressed": hashlib.sha256(raw).hexdigest(),
            **summarise(body),
        }
        save_manifest(manifest)
        print(f"  saved {path.name} ({len(raw)//1024} KB raw), cost {meta['rate_limit_cost']}", flush=True)
    print("All requested plants saved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
