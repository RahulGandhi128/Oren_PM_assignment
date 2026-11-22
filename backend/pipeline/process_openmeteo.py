"""Turn raw Open-Meteo Climate API responses into per-plant heat and heavy-rain metrics.

Input   backend/data/source/openmeteo_climate/raw/{plant_id}.json.gz
Output  backend/data/source/openmeteo_climate/processed/
          annual_by_model.csv   one row per plant x model x year:
                                heat_days_40c (days with temperature_2m_max >= 40 C),
                                rx1day_mm (wettest day of the year), missing_days
          climate_summary.json  per plant: Today (2001-2020) and 2040 (2031-2050) values,
                                per model and ensemble median/min/max; heat series by year
          qa_report.json        missing data and implausible values, per plant x model

Method (spec 6.2-6.3)
  1. Per model and year: count days >= 40 C; take max daily rainfall (Rx1day).
     A model-year with any missing day is dropped for that model (not filled).
  2. Per model and window: mean of the annual values over the 20 years.
  3. Ensemble: median across models (min and max kept to show spread).
  4. Rx1day change = per-model % change of window means, then median across models.
Values are not bias-corrected and outliers are not removed; they are flagged in qa_report.json.

Run:  .venv-pipeline/bin/python -I backend/pipeline/process_openmeteo.py
"""
from __future__ import annotations

import gzip
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "backend/data/source/openmeteo_climate"
RAW_DIR, OUT_DIR = BASE / "raw", BASE / "processed"

HEAT_THRESHOLD_C = 40.0
WINDOWS = {"today": (2001, 2020), "2040": (2031, 2050)}
SERIES_FROM = 1980
IMPLAUSIBLE_TMAX_C = 55.0  # above India's recorded maximum (51.0 C, Phalodi 2016)


def load(path: Path) -> tuple[pd.DataFrame, list[str], dict]:
    body = json.loads(gzip.decompress(path.read_bytes()))
    df = pd.DataFrame(body["daily"])
    df["time"] = pd.to_datetime(df["time"])
    models = sorted({c.removeprefix("temperature_2m_max_") for c in df if c.startswith("temperature_2m_max_")})
    grid = {"latitude": body["latitude"], "longitude": body["longitude"], "elevation_m": body["elevation"]}
    return df, models, grid


def annual(df: pd.DataFrame, model: str) -> pd.DataFrame:
    t, p = df[f"temperature_2m_max_{model}"], df[f"precipitation_sum_{model}"]
    year = df["time"].dt.year
    g = pd.DataFrame({"year": year, "t": t, "p": p}).groupby("year")
    out = pd.DataFrame({
        "heat_days_40c": g["t"].apply(lambda s: int((s >= HEAT_THRESHOLD_C).sum())),
        "rx1day_mm": g["p"].max(),
        "missing_days": g.apply(lambda x: int((x["t"].isna() | x["p"].isna()).sum()), include_groups=False),
    }).reset_index()
    out["model"] = model
    return out


def window_mean(a: pd.DataFrame, col: str, lo: int, hi: int) -> tuple[float | None, int]:
    s = a[(a.year >= lo) & (a.year <= hi) & (a.missing_days == 0)][col]
    return (float(s.mean()) if len(s) else None), int(len(s))


def ens(vals: dict[str, float | None]) -> dict:
    v = pd.Series({k: x for k, x in vals.items() if x is not None}, dtype=float)
    return {"median": round(float(v.median()), 2), "min": round(float(v.min()), 2), "max": round(float(v.max()), 2), "n_models": int(len(v))}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows, summary, qa = [], {}, {}
    for path in sorted(RAW_DIR.glob("P*.json.gz")):
        pid = path.name.split(".")[0]
        df, models, grid = load(path)
        per_model = {m: annual(df, m) for m in models}
        for a in per_model.values():
            rows.append(a.assign(plant_id=pid))

        qa[pid] = {}
        for m in models:
            a, t = per_model[m], df[f"temperature_2m_max_{m}"]
            qa[pid][m] = {
                "years_with_missing_days": a.loc[a.missing_days > 0, "year"].tolist(),
                "days_tmax_above_55c": int((t > IMPLAUSIBLE_TMAX_C).sum()),
                "tmax_max_c": round(float(t.max()), 1),
            }

        heat, rx, n_years = {}, {}, {}
        for w, (lo, hi) in WINDOWS.items():
            heat[w], rx[w], n_years[w] = {}, {}, {}
            for m in models:
                heat[w][m], n_years[w][m] = window_mean(per_model[m], "heat_days_40c", lo, hi)
                rx[w][m], _ = window_mean(per_model[m], "rx1day_mm", lo, hi)
        rx_change = {m: (100 * (rx["2040"][m] / rx["today"][m] - 1) if rx["today"][m] and rx["2040"][m] is not None else None) for m in models}

        series = []
        for y in range(SERIES_FROM, 2051):
            vals = {m: float(per_model[m].set_index("year").loc[y, "heat_days_40c"]) for m in models
                    if y in per_model[m].year.values and per_model[m].set_index("year").loc[y, "missing_days"] == 0}
            series.append({"year": y, **ens(vals)})

        summary[pid] = {
            "grid": grid,
            "heat_days_40c": {w: {"per_model": {m: (round(v, 2) if v is not None else None) for m, v in heat[w].items()}, "ensemble": ens(heat[w]), "years_used": n_years[w]} for w in WINDOWS},
            "rx1day_mm": {w: {"per_model": {m: (round(v, 2) if v is not None else None) for m, v in rx[w].items()}, "ensemble": ens(rx[w])} for w in WINDOWS},
            "rx1day_change_pct": {"per_model": {m: (round(v, 2) if v is not None else None) for m, v in rx_change.items()}, "ensemble": ens(rx_change)},
            "heat_series": series,
        }

    pd.concat(rows)[["plant_id", "model", "year", "heat_days_40c", "rx1day_mm", "missing_days"]].to_csv(OUT_DIR / "annual_by_model.csv", index=False)
    meta = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "openmeteo_climate",
        "windows": WINDOWS,
        "heat_threshold_c": HEAT_THRESHOLD_C,
        "method": "Per model: annual count of days with temperature_2m_max >= 40 C and annual max daily precipitation (Rx1day); "
                  "mean over each 20-year window; ensemble median across models. Model-years with missing days are excluded. "
                  "No bias correction. Today and 2040 both come from the same models (model-to-model change).",
        "plants": summary,
    }
    (OUT_DIR / "climate_summary.json").write_text(json.dumps(meta, indent=1) + "\n")
    (OUT_DIR / "qa_report.json").write_text(json.dumps(qa, indent=1) + "\n")
    for pid, s in summary.items():
        h, r = s["heat_days_40c"], s["rx1day_change_pct"]["ensemble"]
        print(f"{pid}: heat days >=40C today {h['today']['ensemble']['median']:.1f} -> 2040 {h['2040']['ensemble']['median']:.1f} "
              f"(models {h['today']['ensemble']['n_models']}); Rx1day change {r['median']:+.1f}% [{r['min']:+.1f}..{r['max']:+.1f}]")


if __name__ == "__main__":
    main()
