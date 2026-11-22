# Horizon — Climate Exposure for Nimbus Cement (v1 prototype)

> Product spec + build brief for Claude Code.
> Owner: Shaurya (PM). Status: v1 prototype. Last updated: 21 Nov 2026.

---

## 0. Kickoff prompt (paste this into Claude Code first)

```
You are building the v1 prototype of "Horizon", a climate-exposure web app for
Meera Iyer, Head of Sustainability at Nimbus Cement (fictional). The full spec is
in SPEC.md in this repo. Read all of it before writing code.

Rules:
1. Follow the build phases in Section 12, in order. At the end of each phase, stop,
   summarise what you built, list anything you could not verify, and wait for me.
2. All colours, fonts, spacing, radii, shadows and motion come from
   src/theme/tokens.ts. Never hard-code a hex value, font name or pixel shadow
   anywhere else. Section 5 lists the tokens.
3. Every number shown in the UI must carry its provenance (data / derived /
   assumption / placeholder) as defined in Section 7.3. If a number has no
   source, it is a placeholder and must be labelled as one.
4. Runtime never calls external APIs. External data is fetched once by the
   offline pipeline (backend/pipeline) and committed as JSON.
5. Where this spec names an API field, file column or model name, verify it
   against the live docs or the downloaded file before relying on it. If it
   differs, tell me and adapt. Do not invent values.
6. Keep the Python function lean enough to deploy on Vercel (no geopandas,
   numpy-heavy or GDAL deps at runtime; those belong to the pipeline only).
```

---

## 1. Problem and v1 scope

**Customer:** Meera Iyer, Head of Sustainability, Nimbus Cement Ltd (listed, 9 plants).
**Her question (asked by board, auditor, 2 investors):** "What is our business exposure to climate events today and by 2040?"

**v1 answers one thing well:**
> Which of our 9 plants are exposed to which physical climate hazards, how much revenue and asset value that puts at risk each year today and in 2040, and where one plant's disruption cascades to others through the clinker network.

**Primary user:** Meera (operates the tool, prepares board material).
**Audience of the output:** board (one headline number + top risks), auditor (traceable method, labelled assumptions), investors (comparable, disclosure-ready framing).

### In scope (v1)
- 4 physical hazards: **extreme heat, water stress, riverine flood, coastal flood/cyclone**.
- 2 horizons: **Today** (2001–2020 model climate) and **2040** (2031–2050 model climate).
- Money view: **Expected Annual Loss (EAL)** of revenue (from downtime) and assets (from damage), per plant, per hazard, in ₹ crore.
- **Clinker network:** P01 → P07; P06 → P08, P09. Acute events at a kiln propagate to its grinding units.
- **Single-event stress test:** "What if plant X is shut for N days?"
- **Editable assumptions** (session only) with every value labelled.
- **Board pack:** print-ready one-page A4 summary.

### Out of scope (v1) — say so in the UI (Methodology page, "Not in v1")
- Transition risk (CCTS compliance cost, carbon price paths) → v2, first candidate.
- Rail and road route disruption between plants, port disruption beyond Mundra/Paradip site flags.
- Upstream supply (coal, fly ash, slag, limestone mine flooding) and downstream demand.
- Insurance, adaptation measures, capex planning.
- Scenario choice beyond what the source data supports (see Section 6).
- Login, multi-company, data upload.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + TypeScript** | Fast (RSC, static rendering), first-class on Vercel |
| Styling | **Tailwind CSS v4**, driven by CSS variables generated from `src/theme/tokens.ts` | One file controls the look |
| UI primitives | **shadcn/ui (Radix)**, restyled with tokens | Accessible, unbranded |
| Motion | **Framer Motion** | Subtle transitions, number tweening |
| Charts | **Recharts**, themed via tokens | Quick, good-looking with custom styling |
| Map | **d3-geo + SVG** with a Survey-of-India-compliant India outline (see 9.2) | No tile keys, no wrong borders, prints well |
| State | **Zustand** (horizon, hazard lens, assumption overrides) + URL params for horizon | Shareable links |
| Backend | **Python 3.12 + FastAPI + Pydantic v2** | Required: separate Python backend |
| Runtime deps | fastapi, pydantic, pyyaml only | Fits Vercel Python function limits |
| Pipeline deps | requests, pandas, numpy, geopandas, shapely, pyogrio | Offline only |
| Tests | pytest (engine), Playwright smoke test (pages) | |
| Hosting | **Single Vercel project**: Next.js + Python functions under `/api` | One live link, no login |

**Vercel layout:** follow Vercel's official Next.js + FastAPI pattern (FastAPI app in `api/index.py`, Next.js rewrites `/api/:path*` to the Python function in production and to `http://127.0.0.1:8000` in dev). Verify the current pattern in Vercel docs before scaffolding.

---

## 3. Repository structure

```
horizon/
├─ SPEC.md
├─ README.md                      # how to run, deploy, regenerate data
├─ vercel.json
├─ package.json
├─ next.config.ts                 # rewrites /api → FastAPI
├─ requirements.txt               # runtime only: fastapi, pydantic, pyyaml
├─ api/
│  └─ index.py                    # Vercel entry: `from backend.app.main import app`
├─ backend/
│  ├─ app/
│  │  ├─ main.py                  # FastAPI app, routers, CORS (dev only)
│  │  ├─ schemas.py               # Pydantic models (Section 8)
│  │  ├─ loaders.py               # read plants.csv, hazards.json, assumptions.yaml once
│  │  └─ engine/
│  │     ├─ exposure.py           # EAL per plant per hazard
│  │     ├─ network.py            # clinker propagation + stress test
│  │     ├─ bands.py              # risk bands
│  │     └─ findings.py           # rule-based key findings text
│  ├─ data/
│  │  ├─ plants.csv               # copy of nimbus_cement_plants.csv (unchanged)
│  │  ├─ network.json             # clinker edges (derived from CSV, Section 6.5)
│  │  ├─ hazards.json             # pipeline output, committed
│  │  ├─ assumptions.yaml         # every coefficient, with range + rationale
│  │  └─ sources.json             # dataset name, URL, version, access date, licence
│  ├─ pipeline/
│  │  ├─ requirements-pipeline.txt
│  │  ├─ fetch_openmeteo.py       # heat + rainfall, 9 sites, all models
│  │  ├─ fetch_floodapi.py        # optional: historical discharge for river sites
│  │  ├─ process_aqueduct.py      # spatial join of 9 points to Aqueduct 4.0 basins
│  │  └─ build_hazards.py         # combine → data/hazards.json
│  └─ tests/
│     ├─ test_exposure.py         # hand-computed fixture (Section 7.6)
│     └─ test_network.py
└─ src/
   ├─ theme/
   │  ├─ tokens.ts                # THE aesthetics file (Section 5)
   │  ├─ fonts.ts                 # next/font loaders, referenced by tokens
   │  └─ generate-css.ts          # tokens → CSS variables (build step) or inline in layout
   ├─ app/
   │  ├─ layout.tsx               # shell, fonts, top bar, footer disclaimer
   │  ├─ globals.css              # imports generated variables; Tailwind @theme maps to them
   │  ├─ page.tsx                 # 1. Overview
   │  ├─ plants/page.tsx          # 2. Plants (map + table)
   │  ├─ plants/[id]/page.tsx     # 3. Plant detail
   │  ├─ network/page.tsx         # 4. Network & stress test
   │  ├─ methodology/page.tsx     # 5. Methodology & assumptions
   │  └─ report/page.tsx          # 6. Board pack (print)
   ├─ components/
   │  ├─ shell/ (TopBar, HorizonToggle, Footer, NavLinks)
   │  ├─ data/ (ProvenanceChip, Money, Metric, DeltaPill, RiskBand)
   │  ├─ charts/ (HazardMatrix, Waterfall, TimeSeries, NetworkDiagram, Bars)
   │  ├─ map/ (IndiaMap, PlantMarker, FlowLine)
   │  └─ ui/ (shadcn components, restyled)
   ├─ lib/
   │  ├─ api.ts                   # typed fetchers
   │  ├─ format.ts                # ₹ crore, en-IN grouping, %, days
   │  └─ store.ts                 # zustand
   └─ public/geo/india.json       # compliant outline + state boundaries (simplified)
```

---

## 4. Design direction

**Feel:** an editorial annual report, not a SaaS dashboard. Calm, precise, high-trust. Think FT / The Economist charts: warm paper background, ink-dark text, one confident accent, a disciplined risk scale. Generous whitespace, few borders, numbers set large in tabular figures.

**Principles**
1. **One headline per page.** Every page opens with a sentence-level answer, then the evidence.
2. **Numbers are the hero.** Big, tabular, with units and provenance chip.
3. **Colour means risk, nothing else.** Neutral UI; colour only for the risk scale, provenance, and the single accent for interaction.
4. **Never colour alone.** Risk bands always carry a text label.
5. **Show the seams.** Assumptions are visible, dashed-outlined, and editable. This builds trust with the auditor.
6. **Prints cleanly.** Board pack and Overview look right on A4, in greyscale too.

**Light theme is default and required.** Dark theme tokens exist but are optional for v1.

---

## 5. The aesthetics file: `src/theme/tokens.ts`

This is the **only** place visual values live. Changing a font or colour here must restyle the entire app. Implement exactly this shape (values can be tuned later):

```ts
// src/theme/tokens.ts
export const tokens = {
  font: {
    display: "var(--font-display)", // Instrument Serif — headlines, big statements
    sans: "var(--font-sans)",       // Geist — UI and body
    mono: "var(--font-mono)",       // Geist Mono — source IDs, codes
    numericFeatures: '"tnum" 1, "lnum" 1', // tabular figures for all numbers
  },
  type: {
    // size / line-height / letter-spacing
    hero:    { size: "3.5rem",  line: "1.05", tracking: "-0.02em" },
    h1:      { size: "2.25rem", line: "1.15", tracking: "-0.015em" },
    h2:      { size: "1.5rem",  line: "1.25", tracking: "-0.01em" },
    h3:      { size: "1.125rem",line: "1.35", tracking: "0" },
    body:    { size: "0.9375rem", line: "1.6", tracking: "0" },
    small:   { size: "0.8125rem", line: "1.5", tracking: "0.005em" },
    micro:   { size: "0.6875rem", line: "1.4", tracking: "0.06em" }, // uppercase labels
    figure:  { size: "2.75rem", line: "1",    tracking: "-0.02em" }, // KPI numbers
  },
  color: {
    light: {
      bg:        "#F6F4EF", // warm paper
      surface:   "#FFFFFF",
      surface2:  "#FBFAF7",
      ink:       "#16181D", // primary text
      ink2:      "#3D4048", // secondary text
      muted:     "#6E717A",
      border:    "#E5E1D8",
      borderStrong: "#CFC9BC",
      accent:    "#0F4C5C", // deep teal: links, focus, selected state
      accentSoft:"#E3EEF0",
      focusRing: "#0F4C5C",
    },
    dark: {
      bg: "#111316", surface: "#181B1F", surface2: "#1E2227",
      ink: "#F2F0EA", ink2: "#C9C6BE", muted: "#8D9099",
      border: "#2A2E34", borderStrong: "#3A3F47",
      accent: "#6FB3C2", accentSoft: "#1C3238", focusRing: "#6FB3C2",
    },
    // Risk scale: sequential, colour-blind-checked, works in greyscale by lightness
    risk: {
      low:      "#E6E1D3",
      moderate: "#F0C36A",
      high:     "#E07B39",
      severe:   "#B8382A",
      critical: "#6E1E1E", // reserved; v1 uses 4 bands, critical only for stress-test peaks
    },
    // Hazard identity colours (used for small icons/legends, not fills of risk)
    hazard: {
      heat:    "#C8553D",
      water:   "#2F6F9F",
      flood:   "#3E7C6B",
      coastal: "#5B5F97",
    },
    provenance: {
      data:        "#0F4C5C", // solid chip
      derived:     "#4A5160", // solid chip
      assumption:  "#A86A12", // dashed outline chip
      placeholder: "#B8382A", // striped chip, must be gone before submission
    },
    chart: {
      today: "#8A8F99",  // muted grey for baseline
      future:"#0F4C5C",  // accent for 2040
      grid:  "#ECE8DF",
      axis:  "#9A9DA5",
    },
  },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "24px", 6: "32px", 7: "48px", 8: "64px", 9: "96px" },
  radius: { sm: "6px", md: "10px", lg: "16px", pill: "999px" },
  shadow: {
    card:  "0 1px 2px rgba(22,24,29,0.04), 0 4px 16px rgba(22,24,29,0.04)",
    lift:  "0 2px 4px rgba(22,24,29,0.06), 0 12px 32px rgba(22,24,29,0.08)",
  },
  motion: {
    fast: "120ms", base: "220ms", slow: "420ms",
    ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    numberTweenMs: 600,
  },
  layout: { maxWidth: "1280px", gutter: "32px", topBarHeight: "64px" },
} as const;

export type Tokens = typeof tokens;
```

`src/theme/fonts.ts` loads fonts with `next/font` (Instrument Serif from Google Fonts, Geist and Geist Mono from the `geist` package) and exposes them as `--font-display`, `--font-sans`, `--font-mono`.

**Wiring:**
- `generate-css.ts` (or a server component in `layout.tsx`) writes all tokens as CSS variables on `:root` (light) and `[data-theme="dark"]`.
- `globals.css` uses Tailwind v4 `@theme` to map utilities to those variables (`--color-ink`, `--color-risk-high`, etc.).
- Recharts and the SVG map read colours via a `useTokens()` hook, not hex literals.
- **Acceptance check:** `grep -rE "#[0-9A-Fa-f]{3,6}" src --include=*.tsx` returns nothing outside `src/theme/`.

---

## 6. Data

### 6.1 Plants
`backend/data/plants.csv` = the provided file, unchanged. Columns used: id, name, town, state, lat, lon, type, capacity, output, clinker produced/shipped, scope1 (displayed only, not used in v1 maths), water_source, coastal, asset_value_inr_cr, revenue_fy2025_26_inr_cr, employees, notes.

### 6.2 Horizons
- **Today** = model climate averaged over **2001–2020**.
- **2040** = model climate averaged over **2031–2050**.
- Both windows come from the **same climate models** so the change is model-to-model, not observation-to-model (avoids bias).

### 6.3 Hazard metrics and sources

| Hazard | Metric (per plant) | Source | 2040 method |
|---|---|---|---|
| Extreme heat | Days/year with daily max temp ≥ 40 °C; ensemble median across models | Open-Meteo Climate API, `daily=temperature_2m_max`, all available CMIP6 models, 1950–2050 | Same metric, 2031–2050 window |
| Heavy rain (supports flood) | Annual max 1-day rainfall (Rx1day), % change Today→2040 | Open-Meteo Climate API, `precipitation_sum` | % change used to scale flood probability |
| Water stress | Baseline water stress score (0–5) and category | WRI Aqueduct 4.0 baseline annual (spatial join point → basin) | Aqueduct 4.0 future (business-as-usual, SSP3-7.0) for 2030 and 2050; **linear interpolation to 2040** (label: derived) |
| Riverine flood | Riverine flood risk score (0–5) | Aqueduct 4.0 baseline | Baseline probability × (1 + Rx1day change × elasticity) — elasticity is an assumption |
| Coastal flood / cyclone | Coastal flood risk score (0–5); applies only where `coastal = Y` | Aqueduct 4.0 baseline + CSV coastal flag | Baseline probability × (1 + coastal uplift) — uplift is an assumption |
| (Optional enrichment) | Peak river discharge events since 1984 for P03 (Wardha), P09 (Damodar) | Open-Meteo Flood API | Shown on Plant detail as history only, not in EAL |

**Things to verify in the pipeline (do not assume):**
- Exact Open-Meteo Climate API model list and parameter names. I believe the models follow a single high-emissions pathway (HighResMIP). If confirmed, the UI must show a fixed scenario label, e.g. "Climate models: CMIP6 HighResMIP (high-emissions pathway)", and **no scenario toggle**.
- Aqueduct 4.0 column names (e.g. `bws_score`, `bws_cat`, `rfr_score`, `cfr_score` baseline; future columns like `bau30_ws_x_s`, `bau50_ws_x_s`). Read the data dictionary that ships with the download.
- If a plant point falls in a basin with no value (e.g. Mundra on the coastline), use the nearest valid basin within 10 km and record `"note": "nearest basin used"`.

### 6.4 `hazards.json` shape
```json
{
  "generated_at": "2026-11-21T10:00:00Z",
  "windows": { "today": [2001, 2020], "2040": [2031, 2050] },
  "scenario_label": "CMIP6 HighResMIP (high-emissions pathway)",
  "plants": {
    "P01": {
      "heat_days_40c": { "today": 0.0, "2040": 0.0, "kind": "data", "source": "openmeteo_climate", "models": 7 },
      "heat_series": [{ "year": 1980, "value": 0.0 }],
      "rx1day_change_pct": { "value": 0.0, "kind": "derived", "source": "openmeteo_climate" },
      "water_stress": { "today": { "score": 0.0, "cat": "High" }, "2040": { "score": 0.0, "cat": "High" }, "kind": "data|derived", "source": "aqueduct40" },
      "riverine_flood_score": { "today": 0.0, "kind": "data", "source": "aqueduct40" },
      "coastal_flood_score": { "today": 0.0, "kind": "data", "source": "aqueduct40" },
      "notes": []
    }
  }
}
```
**Fallback:** if the pipeline cannot download a source (sandbox network), write values with `"kind": "placeholder"` and continue. The UI shows a striped red "Placeholder" chip. Tell me which sources failed so I can download them manually.

### 6.5 Network (`network.json`, derived from CSV)
```json
{ "edges": [
  { "from": "P01", "to": "P07", "clinker_mt": 1.12, "mode": "rail" },
  { "from": "P06", "to": "P08", "clinker_mt": 0.68, "mode": "unspecified" },
  { "from": "P06", "to": "P09", "clinker_mt": 0.60, "mode": "unspecified" }
]}
```
Each grinding unit gets 100% of its clinker from one kiln.

---

## 7. Exposure engine (backend/app/engine)

### 7.1 Definitions
- `R` = plant revenue (₹ cr, FY25-26), `A` = asset value (₹ cr).
- `D_op` = operating days per year (assumption, default 330).
- Revenue per day = `R / D_op`.
- **Revenue at risk (EAL_rev)** = expected downtime days per year × `R / D_op`.
- **Asset damage (EAL_asset)** = Σ events: annual probability × damage ratio × `A`.
- All outputs in ₹ crore, rounded to 1 decimal in UI, full precision in API.

### 7.2 Per-hazard formulas (h = horizon)

**Heat (chronic):**
`downtime_heat = heat_days_40c[h] × heat_loss_per_day[type]`
Defaults: integrated 0.10, grinding 0.05 (a ≥40 °C day costs 10% / 5% of a day's output through worker-rest cycles, equipment derating).

**Water stress (chronic):**
`downtime_water = curtail_days[ws_cat[h]] × source_factor[water_source]`
`curtail_days`: Low 0, Low-Medium 0, Medium-High 2, High 6, Extremely High 12, Arid & low water use 6.
`source_factor`: Groundwater 1.2, River 1.0, Canal 1.0, Reservoir 0.8, Municipal supply 0.8, Desalinated seawater 0.2.
Map CSV `water_source` strings by prefix (e.g. "River (Wardha)" → River, "Canal (Mahanadi system)" → Canal).

**Riverine flood (acute):**
`p_flood_today = flood_prob[rfr_score band]` with bands 0–1: 0.005, 1–2: 0.01, 2–3: 0.02, 3–4: 0.04, 4–5: 0.08.
`p_flood_2040 = p_flood_today × (1 + max(0, rx1day_change_pct/100) × flood_elasticity)`, `flood_elasticity` default 2.0.
`downtime_flood = p × flood_downtime_days` (default 14). `EAL_asset_flood = p × flood_damage_ratio × A` (default 0.02).

**Coastal flood / cyclone (acute, only if coastal = Y):**
`p_coastal_today = coastal_prob[cfr_score band]` (same band table as flood, separate key).
`p_coastal_2040 = p_coastal_today × (1 + coastal_uplift_2040)`, default 0.25.
`downtime_coastal = p × coastal_downtime_days` (default 10). `EAL_asset_coastal = p × coastal_damage_ratio × A` (default 0.03).

### 7.3 Provenance on every number
Every numeric field in API responses is a `Value`:
```json
{ "value": 12.3, "unit": "inr_cr", "kind": "data|derived|assumption|placeholder", "source_ids": ["aqueduct40","asm.flood_downtime_days"], "note": null }
```
Rule: any value computed from at least one assumption is `derived` and lists the assumption IDs it used. The UI chip shows the kind; hovering lists sources and assumptions.

### 7.4 Network propagation
- **Chronic hazards (heat, water) do not propagate** to grinding units. Assumption: kilns run ~80–85% utilised and recover lost clinker output within the year. Flag in Methodology.
- **Acute hazards (flood, coastal) propagate.** For each acute event at a kiln with `p` and `downtime d`:
  `inherited_downtime_child = p × max(0, d − buffer_days)` where `buffer_days` (clinker stock at grinding unit) defaults to 10.
  `inherited_EAL_rev_child = inherited_downtime_child × R_child / D_op`.
- Each plant reports **own** and **inherited** exposure. Company total = Σ own + Σ inherited. No double counting: inherited is the child's own lost revenue, not the parent's.
- Assumption to state: revenue figures are external cement sales; inter-plant clinker transfers carry no revenue.

### 7.5 Risk bands
Band on total EAL_rev as % of plant revenue: `< 1%` Low, `1–2.5%` Moderate, `2.5–5%` High, `≥ 5%` Severe. Thresholds live in assumptions.yaml.

### 7.6 Stress test
Input: kiln plant ID, outage days N (1–90).
Output: own lost revenue = `N × R / D_op`; each child = `max(0, N − buffer_days) × R_child / D_op`; total; % of company revenue; timeline (day at which each child stops).

### 7.7 Test fixture (must pass)
Write `test_exposure.py` with a synthetic plant: R = 330, A = 1000, D_op = 330, heat days 20, integrated, water cat High, Groundwater, rfr score 3.5, rx1day change +10%, not coastal. Expected today: heat 2.0 days → ₹2.0 cr; water 7.2 days → ₹7.2 cr; flood p 0.04 → 0.56 days → ₹0.56 cr, asset ₹0.8 cr. 2040 flood p = 0.04 × 1.2 = 0.048. Compute by hand in the test, not by calling the engine twice.

### 7.8 `assumptions.yaml` format
```yaml
- id: operating_days
  label: Operating days per year
  value: 330
  min: 300
  max: 360
  unit: days
  group: General
  rationale: Typical Indian cement plant after planned maintenance shutdowns.
  source: Assumption (industry norm); replace with Nimbus actuals.
```
Every coefficient in 7.2–7.5 has an entry. The API accepts overrides by ID; values outside min/max are rejected with 422.

### 7.9 Key findings (rule-based, no LLM)
`findings.py` returns 3–5 sentences from templates, e.g.:
- "{plant} carries the largest exposure: ₹{x} cr a year by 2040, mostly from {hazard}."
- "{kiln} is a single point of failure: it supplies {children}. A {N}-day outage puts ₹{y} cr of revenue at risk across {k} plants."
- "Exposure rises {pct}% by 2040, driven mainly by {hazard}."
- "{count} plants draw on groundwater in basins rated High or worse for water stress."

---

## 8. API (FastAPI, all under `/api`)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{ status, data_generated_at }` |
| GET | `/api/plants` | list of plants (CSV fields + band for current horizon) |
| GET | `/api/plants/{id}?horizon=today\|2040` | plant + hazards + exposure breakdown + heat_series + dependencies |
| POST | `/api/exposure` | body `{ horizon, overrides: {id: value} }` → per-plant, per-hazard EAL (own, inherited), company totals, bands |
| GET | `/api/summary?horizon=` | headline totals today and 2040, waterfall by hazard, findings |
| GET | `/api/network` | nodes + edges |
| POST | `/api/stress` | body `{ plant_id, days, overrides }` → stress result (7.6) |
| GET | `/api/assumptions` | assumptions.yaml as JSON |
| GET | `/api/sources` | sources.json |

- Pydantic models for every request/response; export OpenAPI and generate TS types (`openapi-typescript`) into `src/lib/api-types.ts`.
- Load data once at cold start. Responses < 150 ms.
- Errors: 404 unknown plant, 422 bad override or horizon. Stress test accepts any plant: for P01 and P06 it returns own + downstream losses; for every other plant it returns own loss only, with `note: "No downstream plants."`

---

## 9. Global UI

### 9.1 Shell
- **Top bar** (64 px, sticky, paper background, hairline bottom border): wordmark "Horizon" (display font) + "Nimbus Cement" muted; nav links (Overview, Plants, Network, Methodology); right side: **Horizon toggle** `Today | 2040` (segmented control, accent when active, state in URL `?h=2040`), **Board pack** button.
- **Scenario chip** under the top bar on data pages: "Climate models: {scenario_label} · Today = 2001–2020 · 2040 = 2031–2050".
- **Assumptions-edited banner** (amber, dashed) when overrides are active: "You've changed 3 assumptions. Numbers below reflect your edits. Reset."
- **Footer:** "Prototype. Nimbus Cement and its plant data are fictional. Values marked ◇ are assumptions; ▨ are placeholders." + sources link.

### 9.2 Map rules
- Use an India outline that matches the official Survey of India boundary (e.g. the DataMeet India maps repository) with simplified state lines. **Do not use generic world tile sets**; they show disputed borders, which is unacceptable in front of an Indian listed company's board.
- Plants: circles sized by revenue, filled by risk band (or by the selected hazard lens), labelled with short name. Kilns as filled circles, grinding units as rings.
- Clinker flows: curved lines kiln → grinding unit, width by clinker Mt, subtle animated dash on hover.

### 9.3 Components
- `Money` — ₹ formatting, en-IN grouping, "₹1,234.5 cr", tabular figures, tween on change.
- `ProvenanceChip` — data (solid teal), derived (solid slate), assumption (dashed amber ◇), placeholder (striped red ▨); tooltip lists sources.
- `DeltaPill` — Today → 2040 change, arrow + %; uses risk colours only if crossing a band.
- `RiskBand` — colour swatch + text label always.
- `HazardIcon` — 4 simple line icons (sun, droplet, wave, cyclone).

### 9.4 Formatting
- Currency: ₹ crore, 1 decimal; percentages 1 decimal; days 1 decimal; Mt 2 decimals.
- Dates: "21 Nov 2026".
- Plain English labels: "Revenue at risk each year", not "EAL_rev". Define "expected annual loss" once in a tooltip.

---

## 10. Pages

### Page 1 — Overview `/`
**Job:** give Meera the board answer in 10 seconds.
1. **Headline sentence** (display font, hero size):
   "Climate hazards put **₹{X} cr** of Nimbus's annual revenue at risk today, rising to **₹{Y} cr** by 2040."
   Sub-line: "{X%} → {Y%} of revenue · plus ₹{a} cr → ₹{b} cr expected asset damage a year".
2. **KPI row (3 cards):** Revenue at risk (today vs 2040), Expected asset damage, Plants in High or Severe band (n/9). Each with provenance chip.
3. **Hazard matrix:** rows = 9 plants sorted by 2040 total, columns = Heat, Water, Flood, Coastal, Inherited, Total. Cells filled by band, value in ₹ cr. Click row → plant detail. Today/2040 toggle animates cells.
4. **What changes by 2040:** waterfall — Today total → +heat → +water → +flood → +coastal → 2040 total.
5. **Key findings:** 3–5 sentences from `findings.py`, each linking to the relevant page.
6. **Mini map** linking to Plants.

**Acceptance:** loads < 1.5 s on Vercel; headline numbers equal sum of matrix; toggle updates all sections; every number has a chip.

### Page 2 — Plants `/plants`
**Job:** see where risk sits geographically and compare plants.
- Left (60%): India map (9.2). **Hazard lens** selector above it: Total | Heat | Water | Flood | Coastal recolours markers.
- Right (40%): sortable table — Plant, State, Type, Revenue, Total at risk (₹ cr, % rev), Band, Top hazard, Δ to 2040.
- Hover syncs map ↔ table. Click → plant detail.

**Acceptance:** keyboard navigable table; map renders without network calls; correct India boundary.

### Page 3 — Plant detail `/plants/[id]`
**Job:** explain one plant's exposure well enough to defend it to an auditor.
1. **Header:** name, town, state, type badge, key facts strip (capacity, FY26 output, revenue, asset value, employees, water source, coastal), notes from CSV.
2. **Exposure summary:** "₹{x} cr a year at risk today → ₹{y} cr by 2040 ({band})", split own vs inherited.
3. **Hazard cards (2×2):** each shows metric today vs 2040 (e.g. "18 → 31 days ≥ 40 °C"), what it means in plain English, ₹ impact, provenance chip, "How we calculate this" expander with the formula and the assumptions used (editable link to Methodology).
4. **Heat time series:** days ≥ 40 °C by year 1980–2050 (ensemble median line, min–max band), Today and 2040 windows shaded.
5. **Dependencies:** "Supplies P07 Mundra by rail (1.12 Mt clinker)" or "Depends entirely on P06 Baloda Bazar for clinker; 10-day buffer assumed." Link to Network.
6. **Optional:** flood history (Open-Meteo Flood API) for river plants.
7. **Data table:** all inputs for this plant with source and access date.

**Acceptance:** every plant ID P01–P09 renders; grinding units show inherited exposure; unknown ID → 404 page in brand style.

### Page 4 — Network & stress test `/network`
**Job:** show the hidden concentration risk in the clinker supply chain.
1. **Headline:** "Two kilns feed three grinding units. A disruption at Baloda Bazar puts ₹{z} cr of revenue in play across 3 plants."
2. **Network diagram:** kilns left, grinding units right, flow width = clinker Mt, node size = revenue, node colour = band.
3. **Stress test panel:** select kiln (P01 or P06; others show own-loss only), slider for outage days (1–90), buffer days shown (editable via assumption). Output: lost revenue own + each child, total, % of company revenue, simple timeline bar showing when each grinding unit runs out of clinker.
4. **Note:** "Rail route disruption is not modelled in v1."

**Acceptance:** stress output matches hand calculation (7.6); slider updates < 200 ms.

### Page 5 — Methodology & assumptions `/methodology`
**Job:** earn the auditor's trust.
1. **How it works:** 4-step explainer (Hazard data → Plant exposure → Downtime & damage → ₹ at risk), one short paragraph each.
2. **Data sources:** table from `/api/sources` (name, what we use it for, resolution, version, accessed date, link).
3. **Assumptions:** grouped list from `/api/assumptions`. Each row: label, value (editable number input/slider within min–max), unit, rationale, source. "Reset all". Edits are session-only and apply app-wide.
4. **Limitations & not in v1:** transition risk (CCTS) and why it is v2; single climate pathway; Aqueduct 2040 interpolated; chronic hazards not propagated; no route disruption; revenue not margin; fictional data.
5. **Glossary:** expected annual loss, water stress score, Rx1day, clinker, grinding unit.

**Acceptance:** changing any assumption visibly updates Overview numbers; out-of-range input blocked with message.

### Page 6 — Board pack `/report`
**Job:** one A4 page Meera can attach to board papers.
- Print stylesheet (`@media print`, A4, 15 mm margins, no nav, greyscale-safe).
- Contents: headline sentence, KPI row, compact hazard matrix, top 3 findings, network one-liner, footnote with method summary, scenario label, list of assumptions changed from default (if any), generation date.
- "Print / Save as PDF" button (browser print).

**Acceptance:** fits on one A4 page in Chrome print preview; readable in greyscale.

---

## 11. Edge cases (handle and test)
- Grinding units have no kiln emissions or clinker production: never divide by zero; scope 1 not used in v1 maths.
- P01's scope 1 includes the captive power plant and shipped clinker: display only, with a note; do not compute intensity in v1.
- Coastal hazard only for `coastal = Y` (P07, P08); others return 0 with kind `derived` and note "not coastal".
- Plant in a no-data Aqueduct basin → nearest basin within 10 km, else placeholder.
- Heat days = 0 in both windows (possible for coastal sites): show "0 → 0", not a misleading %.
- Percent change from 0 → show "new" instead of ∞.
- Overrides that make results negative → impossible by min/max; enforce server-side.
- Stress test outage shorter than buffer → children show ₹0 with "covered by clinker buffer".
- Horizon param missing or invalid → default `today` on pages, 422 on API.
- API cold start on Vercel: show skeleton loaders in token styles, never layout shift.

## 12. Build phases (stop after each)
1. **Scaffold + theme:** Next.js + FastAPI on the Vercel pattern, tokens.ts wired end to end, fonts, shell (top bar, toggle, footer), a token showcase page at `/_tokens` (dev only). Deploy a hello-world to Vercel.
2. **Data pipeline:** fetch_openmeteo, process_aqueduct, build_hazards → `hazards.json`, `sources.json`. Report verified field names and any placeholders.
3. **Engine + API:** exposure, network, bands, findings, all endpoints, pytest passing including the 7.7 fixture.
4. **Pages 1–3:** Overview, Plants, Plant detail.
5. **Pages 4–6:** Network, Methodology (with live assumption editing), Board pack.
6. **Polish + deploy:** motion, empty/loading states, accessibility pass (contrast AA, keyboard, labels), hex grep check, Lighthouse ≥ 90 performance and accessibility, production deploy, README.

## 13. Definition of done (v1 prototype)
- Public Vercel URL, no login, all 6 pages work for all 9 plants and both horizons.
- No hard-coded visual values outside `src/theme/`.
- Every number has a provenance chip; zero placeholders remaining (or each one explicitly listed in the README if a source could not be obtained).
- Engine tests pass; stress test matches hand calculation.
- Board pack prints on one A4 page.

## 14. Open questions (for me, not blockers)
- Revenue vs EBITDA at risk: board may prefer margin. v1 uses revenue; confirm.
- Should Today use observed climate (IMD) for credibility? v1 uses model climate for consistency.
- Real Nimbus operating days, clinker buffer stock and insurance cover would replace 3 of the largest assumptions.
- v2 transition module: CCTS 2025-26/2026-27 targets vs 2023-24 baseline (not in the file) and credit price path.
