# WRI Aqueduct 4.0 — plant lookup (pulled 2026-11-21)

Source: WRI Aqueduct 4.0, queried via the Water Risk Atlas point-analysis API
(aqueduct.wri.org/api/analysis), which does the same point-in-basin join as the
downloadable zip (aqueduct-4-0-water-risk-data.zip). Values are the matched
sub-basin's row (pfaf_id / aq30_id / string_id are included so you can cross-check
against the zip later).

Plant points are **town-centre coordinates**, not exact plant gates. Replace
lat/lon if you have plant coordinates; a point near a basin edge can land in a
neighbouring basin.

## Files
- `aqueduct40_baseline_plants.csv` — baseline (today): bws, rfr, cfr, drr, overall water risk (raw/score/cat/label).
- `aqueduct40_future_bws_plants.csv` — long format, water stress for 2030/2050/2080 × 3 scenarios, plus 2040 rows (`estimated=True`).
- `aqueduct40_plant_summary.csv` — the "what we keep" table: one row per plant.

## Column notes (checked against the Aqueduct 4.0 data dictionary / API fields)
- `bws_raw` = withdrawal / available supply ratio; `bws_score` 0–5; `bws_cat` 0–4
  (0 Low <10%, 1 Low-Med 10–20%, 2 Med-High 20–40%, 3 High 40–80%, 4 Extremely High >80%).
- `rfr_*` riverine flood risk, `cfr_*` coastal flood risk (raw = share of population affected per year).
- `drr_*` drought risk (Mundra has no data: -9999 → blank).
- Scenarios: optimistic = SSP1-2.6, business_as_usual = SSP3-7.0, pessimistic = SSP5-8.5.

## Derived values
- The future API returns only `raw` + label, so future `bws_score` is computed with
  Aqueduct's formula `score = clip(log2(raw) + log2(20), 0, 5)` — verified to reproduce
  all 9 baseline scores exactly.
- 2040 = linear midpoint of the 2030 and 2050 scores; category is floor(score).
