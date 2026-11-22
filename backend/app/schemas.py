"""Pydantic models. Every number leaves the API as a Value carrying provenance (spec §7.3)."""
from typing import Literal

from pydantic import BaseModel, Field

Kind = Literal["data", "derived", "assumption", "placeholder"]


class Value(BaseModel):
    value: float | None  # None only when kind == "placeholder"
    unit: str
    kind: Kind
    source_ids: list[str]
    note: str | None = None
    range: tuple[float, float] | None = None  # model spread (min, max) where relevant
    flags: list[str] = []  # IDs of data issues touching this value (see /api/issues)
    label: str | None = None  # category label where the source gives one (e.g. "Extremely High")


class Plant(BaseModel):
    id: str
    name: str
    short_name: str
    town: str
    state: str
    lat: float
    lon: float
    type: Literal["integrated", "grinding"]
    cement_capacity: Value
    cement_output: Value
    clinker_produced: Value
    clinker_shipped: Value
    scope1_co2: Value
    water_source: str
    coastal: bool
    asset_value: Value
    revenue: Value
    employees: Value
    notes: str | None
    band: str | None = None  # filled once the engine exists (Phase 3)
    climate: "ClimateBrief | None" = None


class ClimateBrief(BaseModel):
    heat_days_40c_today: Value
    heat_days_40c_2040: Value
    rx1day_change_pct: Value
    water_stress_today: Value
    water_stress_2040: Value
    riverine_flood: Value
    coastal_flood: Value


class SeriesPoint(BaseModel):
    year: int
    value: float
    min: float
    max: float


class ModelRow(BaseModel):
    model: str
    heat_days_40c_today: float | None
    heat_days_40c_2040: float | None
    years_used_today: int
    years_used_2040: int
    rx1day_mm_today: float | None
    rx1day_mm_2040: float | None
    rx1day_change_pct: float | None
    tmax_max_c: float
    flags: list[str]


class ClimateDetail(ClimateBrief):
    rx1day_mm_today: Value | None = None
    rx1day_mm_2040: Value | None = None
    heat_series: list[SeriesPoint] = []
    heat_series_flags: list[str] = []
    per_model: list[ModelRow] = []
    grid: dict | None = None
    water_stress_by_scenario: dict[str, dict[str, dict]] = {}
    water_stress_scenario: str | None = None
    coastal_flood_aqueduct_score: float | None = None
    basin: dict | None = None


class Link(BaseModel):
    plant_id: str
    short_name: str
    clinker: Value
    mode: str


class PlantDetail(BaseModel):
    plant: Plant
    climate: ClimateDetail
    supplies: list[Link]
    supplied_by: list[Link]
    scenario_label: str
    windows: dict[str, list[int]]
    assets_people: "dict[str, AssetsPeople]"  # {"today": .., "2040": ..}, official (Central) set


class Issue(BaseModel):
    id: str
    severity: Literal["warning", "danger", "info"]
    title: str
    detail: str
    handling: str
    source: str
    plants: list[str]
    models: list[str]
    metrics: list[str]


class Issues(BaseModel):
    generated_at: str
    issues: list[Issue]


class Edge(BaseModel):
    from_id: str
    to_id: str
    clinker: Value
    mode: str


class Network(BaseModel):
    nodes: list[Plant]
    edges: list[Edge]


class Health(BaseModel):
    status: str
    data_generated_at: str | None
    data_as_of: str | None  # latest source download date (sources.json "accessed")


# ---------------------------------------------------------------- Engine (spec 7, 8)
Horizon = Literal["today", "2040"]
Band = Literal["Low", "Moderate", "High", "Severe"]
HazardKey = Literal["heat", "water", "flood", "coastal"]


class Assumption(BaseModel):
    id: str
    label: str
    value: float
    default: float
    min: float
    max: float
    conservative: float | None = None  # lower-loss end of the plausible range (judgment)
    severe: float | None = None        # higher-loss end of the plausible range (judgment)
    unit: str
    group: str
    rationale: str
    source: str


class Preset(BaseModel):
    id: Literal["conservative", "central", "severe"]
    label: str
    description: str
    overrides: dict[str, float]  # empty for central = the official set


class SensitivityRow(BaseModel):
    id: str
    revenue_low: float   # 2040 company revenue at risk with this assumption at its conservative value (others as now)
    revenue_high: float  # ... at its severe value
    asset_low: float
    asset_high: float
    swing: float         # revenue_high - revenue_low (₹ cr)
    key: bool
    key_reason: str | None = None


class SensitivityRequest(BaseModel):
    overrides: dict[str, float] = {}


class SensitivityResponse(BaseModel):
    horizon: Literal["2040"]
    revenue_now: float
    asset_now: float
    rows: list[SensitivityRow]
    key_threshold: float  # ₹ cr: a key driver swings the 2040 total by at least this much at defaults


class PresetRange(BaseModel):
    conservative: dict[str, Value]  # {"today": .., "2040": ..} company revenue at risk
    central: dict[str, Value]       # the official set (ignores session overrides)
    severe: dict[str, Value]


class HazardEAL(BaseModel):
    downtime_days: Value
    revenue_at_risk: Value
    asset_damage: Value | None = None
    probability: Value | None = None


class InheritedEAL(BaseModel):
    from_plant: str
    hazard: HazardKey
    downtime_days: Value
    revenue_at_risk: Value


class AssetsPeople(BaseModel):
    """Asset and people exposure for one plant (separate measures; never added to revenue at risk)."""
    asset_value: Value                     # gross block, from the plant register
    asset_damage: Value                    # expected flood + coastal damage a year
    high_risk_location: bool               # river or coastal flood rated High or Extremely High by Aqueduct
    location_hazards: list[HazardKey]      # which of flood / coastal are rated High or above
    location_ratings: dict[str, str]       # Aqueduct label per acute hazard, e.g. {"flood": "High (6 in 1,000 to 1 in 100)"}
    assets_in_high_risk_locations: Value   # asset_value if high_risk_location, else 0
    employees: Value
    worker_heat_days: Value                # employees × days ≥40 °C


class PlantExposure(BaseModel):
    plant_id: str
    name: str
    short_name: str
    type: Literal["integrated", "grinding"]
    revenue: Value
    hazards: dict[str, HazardEAL]
    inherited: list[InheritedEAL]
    own_revenue_at_risk: Value
    inherited_revenue_at_risk: Value
    total_revenue_at_risk: Value
    asset_damage: Value
    pct_revenue: Value
    band: Band
    top_hazard: str
    exposed_hazards: list[HazardKey]  # for map icons (display thresholds in assumptions.yaml)
    hazard_pct_revenue: dict[str, float]  # own revenue at risk per hazard as % of plant revenue (hazard lens)
    assets_people: AssetsPeople


class CompanyTotals(BaseModel):
    revenue: Value
    revenue_at_risk: Value
    asset_damage: Value
    pct_revenue: Value
    by_hazard: dict[str, Value]  # own + inherited, inherited folded into flood/coastal
    inherited: Value
    plants_high_or_severe: int
    plant_count: int
    gross_block: Value                     # total asset value of the nine plants
    assets_in_high_risk_locations: Value   # asset value of plants in High / Extremely High flood or coastal locations
    assets_in_high_risk_share: Value       # % of gross block
    plants_in_high_risk_locations: int
    employees: Value
    worker_heat_days: Value                # Σ employees × days ≥40 °C


class ExposureRequest(BaseModel):
    horizon: Horizon
    overrides: dict[str, float] = {}


class ExposureResponse(BaseModel):
    horizon: Horizon
    plants: list[PlantExposure]
    company: CompanyTotals
    overrides: dict[str, float]
    scenario_label: str


class WaterfallStep(BaseModel):
    label: str
    kind: Literal["total", "delta"]
    hazard: HazardKey | None = None
    value: Value


class Finding(BaseModel):
    kicker: str  # two-or-three-word label for editorial cards
    text: str
    href: str
    plant_ids: list[str]


class SummaryRequest(BaseModel):
    overrides: dict[str, float] = {}


class SummaryResponse(BaseModel):
    preset_range: PresetRange
    today: CompanyTotals
    future: CompanyTotals  # 2040
    waterfall: list[WaterfallStep]
    findings: list[Finding]
    scenario_label: str
    windows: dict[str, list[int]]
    overrides: dict[str, float]


class StressRequest(BaseModel):
    plant_id: str
    days: int = Field(ge=1, le=90)
    overrides: dict[str, float] = {}


class StressChild(BaseModel):
    plant_id: str
    short_name: str
    lost_revenue: Value
    lost_days: Value
    stops_on_day: int | None
    covered_by_buffer: bool


class StressResponse(BaseModel):
    plant_id: str
    short_name: str
    days: int
    own_lost_revenue: Value
    children: list[StressChild]
    total_lost_revenue: Value
    pct_company_revenue: Value
    buffer_days: Value
    note: str | None


# ---------------------------------------------------------------- Developer data catalogue (/data)
class CatalogLink(BaseModel):
    label: str
    url: str


class CatalogOutput(BaseModel):
    path: str
    role: str
    exists: bool
    bytes: int | None = None


class CatalogSource(BaseModel):
    id: str
    name: str
    group: Literal["v1", "v2"]
    purpose: str
    access: Literal["API", "Download", "Account needed", "Manual PDF", "Provided file"]
    status: Literal["Used in v1", "Optional", "v2"]
    links: list[CatalogLink]
    request: str
    sample: str | None
    sample_format: Literal["json", "csv"] | None
    outputs: list[CatalogOutput]
    scripts: list[str]
    last_refreshed: str | None
    caveats: list[str]
    licence: str


class Catalog(BaseModel):
    generated_at: str
    links_checked: str
    sources: list[CatalogSource]


class RangeSensitivityRow(BaseModel):
    id: str
    label: str
    unit: str
    group: str
    min: float
    max: float
    total_at_min: float  # 2040 company revenue at risk with this assumption at its min, others central
    total_at_max: float
    swing: float         # |total_at_max - total_at_min|


class RangeSensitivityResponse(BaseModel):
    horizon: Literal["2040"]
    central_total: float
    rows: list[RangeSensitivityRow]  # sorted by swing, largest first; assumptions with no ₹ effect left out
