"""
Flood alert engine.

Rules (thresholds in settings.FLOOD_ALERTS):

  * Only cycles where the radar saw >= MIN_COVERAGE_PCT of a district count.
    A half-seen district neither opens nor closes an alert: a low number from
    a partial view is not evidence that the water has gone.
  * RED     flood_pct >= RED_PCT, or a rise of >= RISE_PP percentage points
            since the district's previous well-observed cycle.
  * ORANGE  flood_pct >= ORANGE_PCT.
  * An open alert stays open (as ORANGE) while CLOSE_PCT <= flood_pct <
    ORANGE_PCT, and closes when flood_pct < CLOSE_PCT. The gap stops an alert
    flickering on and off around a single threshold.

The engine is a pure replay of the season: the alert state at any cycle is
derived by applying the rules cycle by cycle from the first one. That makes
`compute_alerts()` idempotent (run it twice, get the same rows) and lets the
API answer "what were the alerts on 23 July?" with exactly the logic that
produced today's alerts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import District, DistrictCycle, FloodAlert

ORANGE = FloodAlert.Level.ORANGE
RED = FloodAlert.Level.RED


def thresholds() -> dict[str, float]:
    return dict(settings.FLOOD_ALERTS)


@dataclass
class AlertState:
    district_id: int
    level: str
    flood_pct: float
    flood_km2: float
    coverage_pct: float
    previous_pct: float | None
    cycle_start: date
    since: date  # first cycle of this continuous alert

    @property
    def change_pct(self) -> float | None:
        if self.previous_pct is None:
            return None
        return round(self.flood_pct - self.previous_pct, 1)


def classify(flood_pct: float, coverage_pct: float, previous_pct: float | None,
             current_level: str | None, t: dict[str, float] | None = None) -> str | None:
    """
    The next level for one district. Returns ORANGE, RED, or None (no alert).

    `current_level` is the level of the open alert, if any. Low coverage keeps
    whatever was there before.
    """
    t = t or thresholds()
    if coverage_pct < t["MIN_COVERAGE_PCT"]:
        return current_level
    rise = previous_pct is not None and flood_pct - previous_pct >= t["RISE_PP"]
    if flood_pct >= t["RED_PCT"] or rise:
        return RED
    if flood_pct >= t["ORANGE_PCT"]:
        return ORANGE
    if current_level and flood_pct >= t["CLOSE_PCT"]:
        return ORANGE
    return None


def replay(until: date | None = None) -> tuple[date | None, dict[int, AlertState]]:
    """
    Apply the rules cycle by cycle up to and including `until` (default: the
    newest cycle). Returns (that cycle, open alerts by district id).
    """
    t = thresholds()
    rows = DistrictCycle.objects.order_by("cycle_start").values_list(
        "cycle_start", "district_id", "flood_pct", "flood_km2_seen", "coverage_pct"
    )
    if until is not None:
        rows = rows.filter(cycle_start__lte=until)

    by_cycle: dict[date, list[tuple]] = {}
    for row in rows:
        by_cycle.setdefault(row[0], []).append(row[1:])

    state: dict[int, AlertState] = {}
    last_good: dict[int, float] = {}  # previous well-observed flood_pct per district
    cycle = None
    for cycle, entries in by_cycle.items():
        for district_id, pct, km2, coverage in entries:
            current = state.get(district_id)
            previous = last_good.get(district_id)
            level = classify(pct, coverage, previous, current.level if current else None, t)
            if coverage >= t["MIN_COVERAGE_PCT"]:
                last_good[district_id] = pct
            if level is None:
                state.pop(district_id, None)
            elif coverage >= t["MIN_COVERAGE_PCT"] or current is None:
                state[district_id] = AlertState(
                    district_id=district_id, level=level, flood_pct=pct, flood_km2=km2,
                    coverage_pct=coverage, previous_pct=previous, cycle_start=cycle,
                    since=current.since if current else cycle,
                )
            # Low coverage with an open alert: keep the last good reading as is.
    return cycle, state


@dataclass
class ComputeResult:
    cycle: date | None
    opened: int = 0
    updated: int = 0
    unchanged: int = 0
    closed: int = 0

    def __str__(self) -> str:
        return (f"cycle {self.cycle}: {self.opened} opened, {self.updated} updated, "
                f"{self.unchanged} unchanged, {self.closed} closed")


@transaction.atomic
def compute_alerts() -> ComputeResult:
    """Bring FloodAlert rows in line with the rules at the newest cycle."""
    cycle, state = replay()
    result = ComputeResult(cycle=cycle)
    if cycle is None:
        return result

    now = timezone.now()
    open_alerts = {a.district_id: a for a in FloodAlert.objects.select_for_update().filter(active=True)}

    for district_id, s in state.items():
        alert = open_alerts.pop(district_id, None)
        if alert is None:
            FloodAlert.objects.create(
                district_id=district_id, cycle_start=s.cycle_start, level=s.level,
                flood_pct=s.flood_pct, active=True,
            )
            result.opened += 1
        elif (alert.level, alert.flood_pct, alert.cycle_start) != (s.level, s.flood_pct, s.cycle_start):
            alert.level, alert.flood_pct, alert.cycle_start = s.level, s.flood_pct, s.cycle_start
            alert.save(update_fields=["level", "flood_pct", "cycle_start", "updated_at"])
            result.updated += 1
        else:
            result.unchanged += 1

    # Anything still open that the rules no longer support has receded.
    for alert in open_alerts.values():
        alert.active = False
        alert.closed_at = now
        alert.save(update_fields=["active", "closed_at", "updated_at"])
        result.closed += 1
    return result


def describe(states: dict[int, AlertState], cycle: date | None) -> list[dict]:
    """Alerts in the shape the frontend's AlertBanner reads, worst first."""
    districts = District.objects.in_bulk(list(states))
    out = []
    for s in states.values():
        d = districts.get(s.district_id)
        if d is None:
            continue
        out.append({
            "district_id": d.slug,
            "district_pk": d.pk,
            "name_en": d.name_en,
            "name_bn": d.name_bn,
            # The frontend's vocabulary, plus the backend's own colour code.
            "level": "severe" if s.level == RED else "warning",
            "level_code": s.level,
            "flooded_pct": s.flood_pct,
            "flooded_km2": s.flood_km2,
            "coverage_pct": s.coverage_pct,
            "previous_pct": s.previous_pct,
            "change_pct": s.change_pct,
            "cycle": (s.cycle_start or cycle).isoformat(),
            "since": s.since.isoformat(),
        })
    out.sort(key=lambda a: (a["level"] != "severe", -a["flooded_pct"]))
    return out
