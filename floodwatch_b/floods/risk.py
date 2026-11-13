"""
Flood-risk outlook for one district: "how likely is flooding in the next cycle?"

This is a transparent, rule-based score, not a hydrological forecast. Every
input is something the radar measured (or a fixed fact about the district),
and every input's contribution is returned, so a judge, a district officer or
a journalist can see *why* a district scores what it does.

Inputs, each normalised to 0..1, then weighted:

    current     latest well-observed flood share               w 0.30
    recent      weighted mean of the last three readings       w 0.15
    trend       rise versus the two readings before it         w 0.15
    frequency   share of the season's cycles at/above orange   w 0.10
    peak        worst reading so far this season               w 0.05
    terrain     river regime susceptibility (char, haor, ...)  w 0.10
    water       permanent water share of the district          w 0.05
    season      monsoon calendar (Jun-Sep high, Dec-Mar low)   w 0.10

Only cycles up to the requested one are used: asking for the outlook "as of
23 July" never peeks at August, so the slider shows what the model would have
said at the time.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from statistics import pstdev

from .models import District
from .serializers import Season, r1

WEIGHTS: dict[str, float] = {
    "current": 0.30,
    "recent": 0.15,
    "trend": 0.15,
    "frequency": 0.10,
    "peak": 0.05,
    "terrain": 0.10,
    "water": 0.05,
    "season": 0.10,
}

# How readily each river regime floods, from Bangladesh flood-hazard zoning:
# active chars and haor basins go under first, Barind and the hills last.
REGIME_SUSCEPTIBILITY: dict[str, float] = {
    "jamuna-char": 0.95,
    "brahmaputra": 0.90,
    "meghna-haor": 0.90,
    "padma": 0.80,
    "coastal": 0.75,
    "delta": 0.60,
    "urban": 0.55,
    "hill": 0.35,
    "barind": 0.25,
}

# Bangladesh monsoon: flooding peaks Jul-Sep, shoulders in Jun and Oct.
MONTH_SEASON: dict[int, float] = {
    1: 0.05, 2: 0.05, 3: 0.10, 4: 0.25, 5: 0.45, 6: 0.80,
    7: 1.00, 8: 1.00, 9: 0.90, 10: 0.55, 11: 0.25, 12: 0.10,
}

LEVELS = [  # (minimum probability, level)
    (65, "severe"),
    (45, "high"),
    (25, "moderate"),
    (0, "low"),
]
LEVEL_ORDER = {"low": 0, "moderate": 1, "high": 2, "severe": 3}


def level_for(probability: float) -> str:
    for floor, name in LEVELS:
        if probability >= floor:
            return name
    return "low"


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


@dataclass
class Reading:
    cycle: date
    pct: float
    coverage: float


def _readings(season: Season, district: District, until: date) -> tuple[list[Reading], list[Reading]]:
    """(every observed reading, the well-observed ones) up to and including `until`."""
    low = season.t["MIN_COVERAGE_PCT"]
    seen: list[Reading] = []
    for c in season.dates:
        if c > until:
            break
        row = season.rows.get(c, {}).get(district.pk)
        if row is not None and row.observed_km2 > 0:
            seen.append(Reading(c, row.flood_pct, row.coverage_pct))
    good = [r for r in seen if r.coverage >= low] or seen
    return seen, good


def district_risk(season: Season, district: District, cycle: date | None = None) -> dict:
    cycle = cycle or season.latest
    t = season.t
    seen, good = _readings(season, district, cycle) if cycle else ([], [])

    latest = good[-1] if good else None
    current = latest.pct if latest else 0.0
    last3 = [r.pct for r in good[-3:]]
    weights = [0.2, 0.3, 0.5][-len(last3):]
    recent = sum(p * w for p, w in zip(last3, weights)) / sum(weights) if last3 else 0.0
    before = [r.pct for r in good[-3:-1]]
    trend = current - (sum(before) / len(before)) if before else 0.0
    peak = max((r.pct for r in good), default=0.0)
    flood_cycles = sum(1 for r in good if r.pct >= t["ORANGE_PCT"])
    frequency = flood_cycles / len(good) if good else 0.0
    water_share = district.permanent_water_km2 / district.area_km2 if district.area_km2 else 0.0

    next_cycle = (cycle + timedelta(days=season.cycle_days)) if cycle else None
    month_for_season = (next_cycle or date.today()).month

    norm = {
        "current": clamp(current / 30.0),
        "recent": clamp(recent / 25.0),
        "trend": clamp(trend / 12.0),
        "frequency": clamp(frequency),
        "peak": clamp(peak / 40.0),
        "terrain": REGIME_SUSCEPTIBILITY.get(district.regime, 0.5),
        "water": clamp(water_share / 0.15),
        "season": MONTH_SEASON[month_for_season],
    }
    raw = {
        "current": r1(current),
        "recent": r1(recent),
        "trend": r1(trend),
        "frequency": r1(frequency * 100),
        "peak": r1(peak),
        "terrain": district.regime or "unknown",
        "water": r1(water_share * 100),
        "season": month_for_season,
    }

    score = sum(WEIGHTS[k] * norm[k] for k in WEIGHTS)
    probability = round(clamp(score * 100, 2, 98))
    level = level_for(probability)

    # Next-cycle flood share: momentum-adjusted recent mean, with a spread
    # from how jumpy this district has been.
    forecast = max(0.0, recent + 0.5 * trend)
    spread = pstdev([r.pct for r in good[-5:]]) if len(good) >= 2 else max(3.0, forecast * 0.5)
    spread = max(spread, 1.5)

    coverage = latest.coverage if latest else 0.0
    if latest is None:
        confidence = "low"
    elif coverage >= 80 and len(good) >= 5:
        confidence = "high"
    elif coverage >= t["MIN_COVERAGE_PCT"] and len(good) >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    factors = [
        {
            "key": k,
            "weight": WEIGHTS[k],
            "score": round(norm[k], 3),
            "contribution": round(WEIGHTS[k] * norm[k] * 100, 1),
            "value": raw[k],
        }
        for k in WEIGHTS
    ]
    factors.sort(key=lambda f: -f["contribution"])

    return {
        "district": {
            "id": district.slug,
            "name_en": district.name_en,
            "name_bn": district.name_bn,
            "division": district.division,
            "regime": district.regime,
            "area_km2": r1(district.area_km2),
        },
        "cycle": cycle.isoformat() if cycle else None,
        "outlook_until": next_cycle.isoformat() if next_cycle else None,
        "probability": probability,
        "level": level,
        "confidence": confidence,
        "observed": latest is not None,
        "last_observed": latest.cycle.isoformat() if latest else None,
        "current_pct": r1(current),
        "coverage_pct": r1(coverage),
        "trend_pp": r1(trend),
        "recent_pct": r1(recent),
        "forecast_pct": r1(forecast),
        "forecast_range": [r1(max(0.0, forecast - spread)), r1(min(100.0, forecast + spread))],
        "exposed_km2": r1(district.area_km2 * forecast / 100.0),
        "peak_pct": r1(peak),
        "flood_cycles": flood_cycles,
        "observed_cycles": len(good),
        "factors": factors,
        "method": "Weighted score of radar-measured flood share, trend, recurrence, terrain and season.",
    }


def risk_for_all(season: Season, cycle: date | None = None) -> list[dict]:
    out = [district_risk(season, d, cycle) for d in season.districts]
    out.sort(key=lambda r: -r["probability"])
    return out


# ---- plain-language guidance (used in emails; the frontend has its own, bilingual) ----

ACTIONS: dict[str, list[str]] = {
    "low": [
        "No action needed now. Keep following official forecasts from FFWC/BWDB.",
        "Save emergency numbers: 999 (national emergency) and 1090 (disaster warning).",
        "Know your nearest flood shelter and the safest route to it.",
    ],
    "moderate": [
        "Prepare an emergency bag: drinking water, dry food, medicine, torch, phone charger, ID papers in a waterproof bag.",
        "Move seed, fertiliser and valuables to a raised shelf or platform.",
        "Check on elderly neighbours, people with disabilities and pregnant women.",
        "Follow Bangladesh Water Development Board (FFWC) river-level bulletins daily.",
    ],
    "high": [
        "Be ready to move to a flood shelter at short notice. Plan for livestock too.",
        "Store at least 3 days of safe drinking water and water-purification tablets.",
        "Raise tubewell heads and cover latrines to keep water safe.",
        "Switch off electricity at the mains if water enters the house.",
        "Keep children away from flood water and river banks.",
    ],
    "severe": [
        "Move to a flood shelter or higher ground now if local authorities advise it.",
        "Never walk or drive through moving water: 15 cm can knock a person over.",
        "Call 999 for rescue. Call 1090 for the latest disaster warning.",
        "Drink only boiled or treated water; watch for diarrhoea and snake bites.",
        "Tell family where you are going; keep your phone charged.",
    ],
}
