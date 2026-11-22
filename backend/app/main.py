"""Horizon API. Plants + network endpoints are live; the exposure engine arrives in Phase 3."""
import json
import os

from fastapi.responses import Response

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import export as xp
from .loaders import DATA_DIR, climate_brief, climate_detail, load_hazards, load_issues, load_network, load_plants, load_sources
from .engine.exposure import V
from .engine.findings import build_findings
from .engine.network import stress as run_stress
from .engine.params import OverrideError, Params, load_assumptions, make_params
from .engine.presets import preset_overrides, presets as list_presets, range_sensitivity, sensitivity as run_sensitivity
from .engine.run import engine_inputs, run_exposure
from .schemas import (
    Assumption, Catalog, ExposureRequest, Preset, PresetRange, RangeSensitivityResponse, SensitivityRequest, SensitivityResponse, ExposureResponse, Health, Horizon, Issues, Link, Network, Plant, PlantDetail,
    StressChild, StressRequest, StressResponse, SummaryRequest, SummaryResponse, WaterfallStep,
)

app = FastAPI(title="Horizon API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

if os.environ.get("VERCEL") is None:  # dev only
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])

# Warm the caches at cold start.
load_plants()
load_network()
load_hazards()
load_issues()


@app.get("/api/health", response_model=Health)
def health() -> Health:
    path = DATA_DIR / "hazards.json"
    generated = json.loads(path.read_text()).get("generated_at") if path.exists() else None
    acc = [x.get("accessed") for x in load_sources()["sources"] if x.get("accessed")]
    return Health(status="ok", data_generated_at=generated, data_as_of=max(acc) if acc else None)


def _params(overrides: dict[str, float] | None) -> Params:
    try:
        return make_params(overrides)
    except OverrideError as e:
        raise HTTPException(422, str(e)) from e


@app.get("/api/plants", response_model=list[Plant])
def plants(horizon: Horizon = Query("today")) -> list[Plant]:
    bands = {r.plant_id: r.band for r in run_exposure(horizon, _params(None)).plants}
    return [p.model_copy(update={"climate": climate_brief(p.id), "band": bands[p.id]}) for p in load_plants().values()]


@app.get("/api/plants/{plant_id}", response_model=PlantDetail)
def plant(plant_id: str, horizon: Horizon = Query("today")) -> PlantDetail:
    pid = plant_id.upper()
    p = load_plants().get(pid)
    if p is None:
        raise HTTPException(404, f"Unknown plant {plant_id}")
    all_p, edges = load_plants(), load_network().edges
    hz = load_hazards()
    return PlantDetail(
        plant=p.model_copy(update={"band": next(r.band for r in run_exposure(horizon, _params(None)).plants if r.plant_id == pid)}),
        climate=climate_detail(pid),
        supplies=[Link(plant_id=e.to_id, short_name=all_p[e.to_id].short_name, clinker=e.clinker, mode=e.mode) for e in edges if e.from_id == pid],
        supplied_by=[Link(plant_id=e.from_id, short_name=all_p[e.from_id].short_name, clinker=e.clinker, mode=e.mode) for e in edges if e.to_id == pid],
        scenario_label=hz["scenario_label"],
        windows=hz["windows"],
        assets_people={h: next(r.assets_people for r in run_exposure(h, _params(None)).plants if r.plant_id == pid) for h in ("today", "2040")},
    )


@app.get("/api/issues", response_model=Issues)
def issues() -> Issues:
    return load_issues()


@app.get("/api/catalog", response_model=Catalog)
def catalog() -> Catalog:
    return Catalog.model_validate_json((DATA_DIR / "catalog.json").read_text())


@app.get("/api/sources")
def sources() -> dict:
    return load_sources()


@app.get("/api/network", response_model=Network)
def network() -> Network:
    return load_network()


@app.get("/api/assumptions", response_model=list[Assumption])
def assumptions() -> list[Assumption]:
    return [Assumption(**a, default=a["value"]) for a in load_assumptions()]


@app.get("/api/presets", response_model=list[Preset])
def presets() -> list[Preset]:
    return [Preset(**p) for p in list_presets()]


@app.get("/api/sensitivity", response_model=RangeSensitivityResponse)
def sensitivity_range() -> RangeSensitivityResponse:
    """Tornado: 2040 total with each assumption at its allowed min and max, all others at Central."""
    return RangeSensitivityResponse(**range_sensitivity())


@app.post("/api/sensitivity", response_model=SensitivityResponse)
def sensitivity(req: SensitivityRequest) -> SensitivityResponse:
    _params(req.overrides)  # validate first (422 on bad input)
    return SensitivityResponse(**run_sensitivity(req.overrides))


def _preset_range() -> PresetRange:
    out = {}
    for pid in ("conservative", "central", "severe"):
        p = make_params(preset_overrides(pid))
        out[pid] = {h: run_exposure(h, p).company.revenue_at_risk.model_copy(update={"note": f"{pid.title()} preset"}) for h in ("today", "2040")}
    return PresetRange(**out)


@app.post("/api/exposure", response_model=ExposureResponse)
def exposure(req: ExposureRequest) -> ExposureResponse:
    return run_exposure(req.horizon, _params(req.overrides))


def _summary(overrides: dict[str, float]) -> SummaryResponse:
    p = _params(overrides)
    today, future = run_exposure("today", p), run_exposure("2040", p)
    steps = [WaterfallStep(label="Today", kind="total", value=today.company.revenue_at_risk)]
    labels = {"heat": "Heat", "water": "Water stress", "flood": "Riverine flood", "coastal": "Coastal"}
    for h, lab in labels.items():
        a, b = today.company.by_hazard[h], future.company.by_hazard[h]
        steps.append(WaterfallStep(label=lab, kind="delta", hazard=h,
                                   value=V((b.value or 0) - (a.value or 0), "inr_cr", a.source_ids + b.source_ids, flags=a.flags + b.flags)))
    steps.append(WaterfallStep(label="2040", kind="total", value=future.company.revenue_at_risk))
    pins, _, edges, hz = engine_inputs()
    findings = build_findings(today, future, pins, edges, {k: v.water_source for k, v in load_plants().items()},
                              {k: v["water_stress"]["today"]["cat"] for k, v in hz.items()}, p)
    return SummaryResponse(preset_range=_preset_range(), today=today.company, future=future.company, waterfall=steps, findings=findings,
                           scenario_label=load_hazards()["scenario_label"], windows=load_hazards()["windows"], overrides=p.overridden)


@app.get("/api/summary", response_model=SummaryResponse)
def summary(horizon: Horizon = Query("today")) -> SummaryResponse:  # horizon accepted per spec; both are returned
    return _summary({})


@app.post("/api/summary", response_model=SummaryResponse)
def summary_with_overrides(req: SummaryRequest) -> SummaryResponse:
    return _summary(req.overrides)


@app.post("/api/stress", response_model=StressResponse)
def stress(req: StressRequest) -> StressResponse:
    pid = req.plant_id.upper()
    all_p = load_plants()
    if pid not in all_p:
        raise HTTPException(404, f"Unknown plant {req.plant_id}")
    pins, _, edges, _ = engine_inputs()
    r = run_stress(pid, req.days, pins, edges, _params(req.overrides))
    return StressResponse(
        plant_id=pid, short_name=all_p[pid].short_name, days=req.days,
        own_lost_revenue=r["own_lost_revenue"],
        children=[StressChild(short_name=all_p[c["plant_id"]].short_name, **c) for c in r["children"]],
        total_lost_revenue=r["total_lost_revenue"], pct_company_revenue=r["pct_company_revenue"],
        buffer_days=r["buffer_days"], note=r["note"],
    )


# ---------------------------------------------------------------- Data export (physical risk only)

def _export_params(overrides: str | None) -> Params:
    """`overrides` is a JSON object {assumption_id: value}, the same set the app is showing."""
    try:
        o = json.loads(overrides) if overrides else {}
    except json.JSONDecodeError as e:
        raise HTTPException(422, "overrides must be a JSON object") from e
    if not isinstance(o, dict) or not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in o.values()):
        raise HTTPException(422, "overrides must map assumption ids to numbers")
    return _params({k: float(v) for k, v in o.items()})


def _download(body: bytes, media: str, name: str, info: "xp.SetInfo") -> Response:
    return Response(body, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{name}"',
        "X-Assumption-Set": info.stamp.replace(" · ", " - "),
        "Cache-Control": "no-store",
    })


@app.get("/api/export.xlsx", response_class=Response, responses={200: {"content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}}}})
def export_xlsx(overrides: str | None = Query(None, description="JSON object of assumption overrides")) -> Response:
    info = xp.SetInfo(_export_params(overrides))
    return _download(xp.to_xlsx(info), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                     xp.filename(info, "physical-risk", "xlsx"), info)


@app.get("/api/export/{table}.csv", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
def export_csv(table: str, overrides: str | None = Query(None, description="JSON object of assumption overrides")) -> Response:
    if table not in xp.TABLES:
        raise HTTPException(404, f"Unknown table '{table}'. Use one of: {', '.join(xp.TABLES)}")
    info = xp.SetInfo(_export_params(overrides))
    return _download(xp.to_csv(table, info), "text/csv; charset=utf-8", xp.filename(info, table, "csv"), info)
