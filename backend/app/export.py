"""Data export (spec: board / auditor hand-off). XLSX workbook and per-table CSV, built from the same
engine run the app shows, with the caller's assumption overrides applied. Physical risk only.

The assumption set ID is computed exactly as the frontend does (src/lib/assumptionSet.ts), so the ID
printed in a downloaded file matches the one in the app's top bar.
"""
from __future__ import annotations

import csv
import hashlib
import io
from datetime import datetime, timezone

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from .engine.params import Params, load_assumptions
from .engine.presets import preset_overrides
from .engine.run import run_exposure
from .loaders import load_hazards, load_plants, load_sources

SET_VERSION = 1
SCOPE_NOTE = "Physical risk only · transition risk not yet included"
TABLES = ("exposure", "hazards", "assumptions", "sources")
HAZARDS = (("heat", "Heat"), ("water", "Water stress"), ("flood", "Riverine flood"), ("coastal", "Coastal"))
SET_LABEL = {"central": "Central", "conservative": "Conservative", "severe": "Severe", "custom": "Custom"}


# ------------------------------------------------------------------ assumption set ID

def _js_num(v: float | int) -> str:
    """Number → text exactly as JavaScript's String(n) writes it (for the values used here)."""
    f = float(v)
    if f.is_integer() and abs(f) < 1e21:
        return str(int(f))
    r = repr(f)
    if "e" in r:  # JS writes 1e-7, Python 1e-07
        m, e = r.split("e")
        r = f"{m}e{'+' if int(e) > 0 else '-'}{abs(int(e))}"
    return r


def data_versions() -> tuple[str | None, str | None]:
    generated = load_hazards().get("generated_at")
    acc = [x.get("accessed") for x in load_sources()["sources"] if x.get("accessed")]
    return generated, (max(acc) if acc else None)


def set_values(overrides: dict[str, float]) -> dict[str, float]:
    return {a["id"]: overrides.get(a["id"], a["value"]) for a in load_assumptions()}


def set_fingerprint(values: dict[str, float], generated: str | None, as_of: str | None) -> str:
    rows = [f"{k}={_js_num(values[k])}" for k in sorted(values)]
    text = "\n".join([f"horizon-set-v{SET_VERSION}", f"data={generated or ''}", f"as_of={as_of or ''}", *rows])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def active_set(overrides: dict[str, float]) -> str:
    if not overrides:
        return "central"
    for pid in ("conservative", "severe"):
        po = preset_overrides(pid)
        if po.keys() == overrides.keys() and all(float(overrides[k]) == po[k] for k in po):
            return pid
    return "custom"


class SetInfo:
    def __init__(self, p: Params):
        self.params = p
        self.overrides = dict(p.overridden)
        self.generated, self.as_of = data_versions()
        self.values = set_values(self.overrides)
        self.hash = set_fingerprint(self.values, self.generated, self.as_of)
        self.id = self.hash[:4].upper()
        self.set = active_set(self.overrides)
        self.label = SET_LABEL[self.set]

    @property
    def as_of_text(self) -> str:
        d = datetime.fromisoformat(self.as_of) if self.as_of else None
        return f"{d.day} {d:%b %Y}" if d else "unknown"

    @property
    def stamp(self) -> str:
        d = datetime.fromisoformat(self.as_of) if self.as_of else None
        short = f"{d.day} {d:%b}" if d else "?"
        return f"{self.label} · {self.id} · data {short}"


# ------------------------------------------------------------------ tables (header, rows)

def _r(v: float | None, nd: int = 2) -> float | None:
    return None if v is None else round(v, nd)


def exposure_table(info: SetInfo) -> tuple[list[str], list[list]]:
    windows = load_hazards()["windows"]
    head = ["Assumption set", "Horizon", "Climate window", "Plant ID", "Plant", "Type", "Revenue FY26 (₹ cr)",
            "Physical risk: revenue at risk (₹ cr/yr)", "Own (₹ cr/yr)", "Inherited from kiln (₹ cr/yr)", "% of revenue", "Risk band",
            *[f"{lab}, own (₹ cr/yr)" for _, lab in HAZARDS], "Expected asset damage (₹ cr/yr)", "Largest hazard",
            "Gross block (₹ cr)", "High-risk flood/coastal location (Aqueduct High or above)", "Assets in high-risk locations (₹ cr)",
            "Employees", "Worker heat-days (employees × days ≥40 °C)"]
    rows: list[list] = []
    for h, name in (("today", "Now"), ("2040", "2040")):
        res = run_exposure(h, info.params)
        win = "–".join(str(y) for y in windows[h]) + " model average"
        for p in res.plants:
            rows.append([info.id, name, win, p.plant_id, p.short_name, p.type, _r(p.revenue.value, 1),
                         _r(p.total_revenue_at_risk.value), _r(p.own_revenue_at_risk.value), _r(p.inherited_revenue_at_risk.value),
                         _r(p.pct_revenue.value), p.band, *[_r(p.hazards[k].revenue_at_risk.value) if k in p.hazards else 0.0 for k, _ in HAZARDS],
                         _r(p.asset_damage.value), p.top_hazard, *_ap_cols(p.assets_people)])
        c = res.company
        own_by = {k: sum((p.hazards[k].revenue_at_risk.value or 0) for p in res.plants if k in p.hazards) for k, _ in HAZARDS}
        rows.append([info.id, name, win, "ALL", "All plants", "", _r(c.revenue.value, 1), _r(c.revenue_at_risk.value),
                     _r(c.revenue_at_risk.value - c.inherited.value), _r(c.inherited.value), _r(c.pct_revenue.value),
                     f"{c.plants_high_or_severe} of {c.plant_count} High or Severe", *[_r(own_by[k]) for k, _ in HAZARDS],
                     _r(c.asset_damage.value), max(own_by, key=own_by.get),
                     _r(c.gross_block.value, 1), f"{c.plants_in_high_risk_locations} of {c.plant_count} plants · {c.assets_in_high_risk_share.value:.1f}% of gross block",
                     _r(c.assets_in_high_risk_locations.value, 1), _r(c.employees.value, 0), _r(c.worker_heat_days.value, 0)])
    return head, rows


def _ap_cols(a) -> list:
    loc = ("Yes: " + ", ".join("river flood" if h == "flood" else "coastal flood" for h in a.location_hazards)) if a.high_risk_location else "No"
    return [_r(a.asset_value.value, 1), loc, _r(a.assets_in_high_risk_locations.value, 1), _r(a.employees.value, 0), _r(a.worker_heat_days.value, 0)]


def hazards_table() -> tuple[list[str], list[list]]:
    hz, plants = load_hazards()["plants"], load_plants()
    head = ["Plant ID", "Plant", "State", "Type", "Water source", "Coastal",
            "Days ≥40 °C, now (median of models)", "Days ≥40 °C, now (model min)", "Days ≥40 °C, now (model max)",
            "Days ≥40 °C, 2040 (median)", "Days ≥40 °C, 2040 (model min)", "Days ≥40 °C, 2040 (model max)",
            "Wettest day, now (mm)", "Wettest day, 2040 (mm)", "Wettest-day change to 2040 (%)",
            "Water stress score, now (0–5)", "Water stress, now", "Water stress score, 2040 (0–5, estimated)", "Water stress, 2040",
            "Riverine flood score (0–5)", "Riverine flood", "Coastal flood score (0–5)", "Coastal flood", "Data issue IDs"]
    rows = []
    for pid, pl in plants.items():
        h = hz[pid]
        heat, rx, ws = h["heat_days_40c"], h["rx1day_mm"], h["water_stress"]
        flags = set()
        for blk in (heat, rx, h["rx1day_change_pct"], ws, h["riverine_flood_score"], h["coastal_flood_score"]):
            f = blk.get("flags", [])
            flags.update(sum(f.values(), []) if isinstance(f, dict) else f)
        rng = heat.get("range", {})
        rows.append([pid, pl.short_name, pl.state, pl.type, pl.water_source, "Yes" if pl.coastal else "No",
                     _r(heat["today"], 1), *(_r(x, 1) for x in rng.get("today", [None, None])),
                     _r(heat["2040"], 1), *(_r(x, 1) for x in rng.get("2040", [None, None])),
                     _r(rx["today"], 1), _r(rx["2040"], 1), _r(h["rx1day_change_pct"]["value"], 1),
                     _r(ws["today"]["score"]), ws["today"]["cat"], _r(ws["2040"]["score"]), ws["2040"]["cat"],
                     _r(h["riverine_flood_score"]["today"]), h["riverine_flood_score"].get("label"),
                     _r(h["coastal_flood_score"]["today"]), h["coastal_flood_score"].get("label"), ", ".join(sorted(flags))])
    return head, rows


def assumptions_table(info: SetInfo) -> tuple[list[str], list[list]]:
    head = ["ID", "Assumption", "Group", "Unit", "Default", "Value used", "Edited", "Allowed min", "Allowed max",
            "Conservative", "Severe", "Source", "Rationale"]
    rows = [[a["id"], a["label"], a["group"], a["unit"], a["value"], info.values[a["id"]], "Yes" if a["id"] in info.overrides else "No",
             a["min"], a["max"], a.get("conservative"), a.get("severe"), a["source"], a["rationale"]] for a in load_assumptions()]
    return head, rows


def sources_table() -> tuple[list[str], list[list]]:
    head = ["ID", "Name", "Provider", "Version", "Accessed", "Licence", "URL", "Used for", "Resolution", "Caveat / note"]
    rows = [[s["id"], s["name"], s.get("provider"), s.get("version"), s.get("accessed"), s.get("licence"), s.get("url"),
             s.get("used_for"), s.get("resolution"), s.get("caveat") or s.get("note")] for s in load_sources()["sources"]]
    return head, rows


def table(name: str, info: SetInfo) -> tuple[list[str], list[list]]:
    return {"exposure": lambda: exposure_table(info), "hazards": hazards_table,
            "assumptions": lambda: assumptions_table(info), "sources": sources_table}[name]()


# ------------------------------------------------------------------ outputs

def to_csv(name: str, info: SetInfo) -> bytes:
    head, rows = table(name, info)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(head)
    w.writerows(rows)
    return ("﻿" + buf.getvalue()).encode("utf-8")  # BOM so Excel reads ₹ and ° correctly


def about_rows(info: SetInfo, generated_at: str) -> list[tuple[str, str]]:
    hz = load_hazards()
    w = hz["windows"]
    spec = {a["id"]: a for a in load_assumptions()}
    changed = "; ".join(f"{spec[k]['label']}: {_js_num(spec[k]['value'])} → {_js_num(v)}" for k, v in info.overrides.items()) or "None (default values)"
    preset = {"central": "Central (official set)", "conservative": "Conservative preset", "severe": "Severe preset",
              "custom": f"Custom ({len(info.overrides)} assumptions changed)"}[info.set]
    return [
        ("Report", "Nimbus Cement · Physical climate risk exposure"),
        ("Scope", SCOPE_NOTE + ". Transition risk (e.g. India's Carbon Credit Trading Scheme) is not measured in v1."),
        ("Assumption set", info.stamp),
        ("Assumption set fingerprint (SHA-256)", info.hash),
        ("Preset", preset),
        ("Assumptions changed from default", changed),
        ("Data downloaded (as of)", info.as_of_text),
        ("Data build", info.generated or "unknown"),
        ("Generated at (UTC)", generated_at),
        ("Climate windows", f"Now = model climate averaged over {w['today'][0]}–{w['today'][1]}; 2040 = averaged over {w['2040'][0]}–{w['2040'][1]}"),
        ("Climate scenario", hz["scenario_label"]),
        ("Units", "₹ crore a year unless stated. Revenue at risk is revenue, not profit."),
        *measure_rows(info),
        ("Method 1 · Hazards", "Days ≥40 °C and the wettest day per plant: median of 7 CMIP6 HighResMIP models (Open-Meteo), no bias correction. "
                               "Water stress, riverine and coastal flood: WRI Aqueduct 4.0; 2040 water stress is the midpoint of 2030 and 2050 (SSP3-7.0)."),
        ("Method 2 · Lost days", "Each hazard becomes lost operating days through labelled assumptions (Assumptions sheet: default vs value used)."),
        ("Method 3 · ₹ at risk", "Revenue at risk = lost days × revenue per day. Expected asset damage = chance of a flood or coastal event × share of assets damaged × asset value."),
        ("Method 4 · Network", "A kiln stopped by a flood or coastal event stops the grinding units it supplies once their clinker stock runs out (inherited loss)."),
        ("Method 5 · Bands", "Plants are banded Low / Moderate / High / Severe by revenue at risk as a share of their own revenue."),
        ("Sheets", "Exposure (per plant, both horizons) · Hazard inputs · Assumptions · Sources"),
        ("Reproduce", f"Load the matching assumption set in Horizon (Methodology → Load a set); the top bar must show {info.id}."),
    ]


def measure_rows(info: SetInfo) -> list[tuple[str, str]]:
    now, fut = run_exposure("today", info.params).company, run_exposure("2040", info.params).company
    cr = lambda v: f"₹{v:,.1f} cr"  # noqa: E731
    return [
        ("Physical risk measures", "Four separate measures. They are not added together: revenue at risk and asset damage are different kinds of loss and overlap."),
        ("Operations: revenue at risk a year", f"Now {cr(now.revenue_at_risk.value)} ({now.pct_revenue.value:.1f}% of revenue) · 2040 {cr(fut.revenue_at_risk.value)} ({fut.pct_revenue.value:.1f}%)"),
        ("Assets: expected damage a year", f"Now {cr(now.asset_damage.value)} · 2040 {cr(fut.asset_damage.value)} (flood and coastal events)"),
        ("Assets in high-risk locations", f"{cr(now.assets_in_high_risk_locations.value)}, {now.assets_in_high_risk_share.value:.1f}% of {cr(now.gross_block.value)} gross block, "
                                          f"at {now.plants_in_high_risk_locations} plants whose own river or coastal flood rating is Aqueduct High or Extremely High. "
                                          "Aqueduct flood ratings are baseline only, so 2040 is the same."),
        ("People: worker heat-days a year", f"Now {now.worker_heat_days.value:,.0f} · 2040 {fut.worker_heat_days.value:,.0f} (employees × days ≥40 °C; exposure only, not health outcomes)"),
        ("Not in v1", "Insurance (premiums, cover, deductibles) · repair and extra energy or water costs · asset impairment and valuation effects · health costs to workers"),
    ]


def _write(ws, head: list[str], rows: list[list], widths: dict[int, int] | None = None) -> None:
    ws.append(head)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.alignment = Alignment(wrap_text=True, vertical="top")
    for r in rows:
        ws.append(r)
    ws.freeze_panes = "A2"
    for i, h in enumerate(head, start=1):
        longest = max([len(str(h)) // 2 + 2] + [len(str(r[i - 1])) if r[i - 1] is not None else 0 for r in rows])
        ws.column_dimensions[get_column_letter(i)].width = (widths or {}).get(i, min(max(longest + 2, 10), 48))


def to_xlsx(info: SetInfo) -> bytes:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    wb = Workbook()
    ws = wb.active
    ws.title = "About"
    ws.append(["Physical climate risk exposure", ""])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([SCOPE_NOTE, ""])
    ws["A2"].font = Font(italic=True)
    ws.append([])
    for k, v in about_rows(info, generated_at):
        ws.append([k, v])
        ws.cell(ws.max_row, 1).font = Font(bold=True)
        ws.cell(ws.max_row, 2).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(ws.max_row, 1).alignment = Alignment(vertical="top")
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 110

    for title, name in (("Exposure", "exposure"), ("Hazard inputs", "hazards"), ("Assumptions", "assumptions"), ("Sources", "sources")):
        head, rows = table(name, info)
        widths = {12: 60, 13: 80} if name == "assumptions" else None
        _write(wb.create_sheet(title), head, rows, widths)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def filename(info: SetInfo, stem: str, ext: str) -> str:
    return f"horizon-{stem}-{info.label.lower()}-{info.id}.{ext}"
