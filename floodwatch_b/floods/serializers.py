"""
Response shapes for the API.

These mirror `src/types/floodwatch.ts` in the Next.js frontend field for
field, so the frontend runs against Django with no component changes. Where
the backend knows more than the frontend asks for (estimated km², image
counts, the backend's own alert colours), the extra fields are added
alongside; nothing the frontend reads is renamed.

Most payloads are aggregates over a whole season, so instead of one DRF
serializer per model they are built from a `Season` snapshot: every cycle
row loaded once, with `select_related`, then indexed in memory.
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import date, timedelta
from functools import cached_property

from django.conf import settings
from django.db.models import Max, Sum
from rest_framework import serializers

from .models import (
    DataSource,
    District,
    DistrictCycle,
    NationalCycle,
    Overlay,
    Scene,
    UpdateRun,
)

MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def cycle_label(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]}"


def r1(value: float | None) -> float | None:
    return None if value is None else round(value, 1)


def r2(value: float | None) -> float | None:
    return None if value is None else round(value, 2)


class DistrictListSerializer(serializers.ModelSerializer):
    """`/api/districts/?format=list` - the search box, without geometry."""

    id = serializers.CharField(source="slug")
    pk = serializers.IntegerField(source="id")

    class Meta:
        model = District
        fields = ["id", "pk", "name_en", "name_bn", "source_name", "division", "area_km2"]


class Season:
    """Everything one request needs about the imported season, loaded once."""

    def __init__(self):
        self.districts: list[District] = list(District.objects.all())
        self.by_pk = {d.pk: d for d in self.districts}
        self.rows: dict[date, dict[int, DistrictCycle]] = defaultdict(dict)
        for row in DistrictCycle.objects.order_by("cycle_start"):
            self.rows[row.cycle_start][row.district_id] = row
        self.national = {n.cycle_start: n for n in NationalCycle.objects.all()}
        self.dates: list[date] = sorted(set(self.rows) | set(self.national))
        self.index = {d: i for i, d in enumerate(self.dates)}
        self.t = settings.FLOOD_ALERTS
        self.cycle_days = settings.FLOODWATCH["CYCLE_LENGTH_DAYS"]

    # ---- lookups ---------------------------------------------------------

    @property
    def latest(self) -> date | None:
        return self.dates[-1] if self.dates else None

    def resolve_cycle(self, value: str | None) -> date | None:
        """ISO date or 'latest'. None when the cycle does not exist."""
        if not value or value == "latest":
            return self.latest
        try:
            wanted = date.fromisoformat(value)
        except ValueError:
            return None
        return wanted if wanted in self.index else None

    def find_district(self, key: str) -> District | None:
        key = key.strip()
        if key.isdigit():
            return self.by_pk.get(int(key))
        needle = key.lower()
        slug = "-".join(filter(None, "".join(c if c.isalnum() else "-" for c in needle).split("-")))
        for d in self.districts:
            if needle in (d.slug, d.name_en.lower(), d.source_name.lower()) or d.slug == slug or d.name_bn == key:
                return d
        return None

    @cached_property
    def country_area_km2(self) -> float:
        return round(sum(d.area_km2 for d in self.districts), 1)

    # ---- per-district stats ---------------------------------------------

    @staticmethod
    def stat(row: DistrictCycle | None) -> dict:
        """DistrictCycleStat. Unobserved districts have flooded_pct None, never 0."""
        if row is None or row.observed_km2 <= 0:
            return {"observed": False, "coverage_pct": 0.0, "flooded_km2": 0.0, "flooded_pct": None}
        return {
            "observed": True,
            "coverage_pct": r1(row.coverage_pct),
            # Measured flood within the observed part of the district.
            "flooded_km2": r1(row.flood_km2_seen),
            "flooded_pct": r1(row.flood_pct),
            "observed_km2": r1(row.observed_km2),
            # flood_pct applied to the whole district: an estimate, labelled so.
            "flood_km2_est": r1(row.flood_km2_est),
            "images": row.images,
            "last_image": row.last_image.isoformat() if row.last_image else None,
        }

    def ranked(self, cycle: date) -> list[tuple[District, DistrictCycle]]:
        """Observed districts, worst first. Unobserved ones are not ranked as 0%."""
        rows = [(self.by_pk[pk], row) for pk, row in self.rows.get(cycle, {}).items()
                if row.observed_km2 > 0 and pk in self.by_pk]
        return sorted(rows, key=lambda dr: (-dr[1].flood_pct, dr[0].name_en))

    def rank_of(self, district: District, cycle: date | None) -> int | None:
        if cycle is None:
            return None
        for i, (d, _) in enumerate(self.ranked(cycle), start=1):
            if d.pk == district.pk:
                return i
        return None

    @cached_property
    def peaks(self) -> dict[int, dict]:
        """Peak / baseline / observed-count per district, over the season."""
        low = self.t["MIN_COVERAGE_PCT"]
        out: dict[int, dict] = {}
        for d in self.districts:
            seen = [(c, self.rows[c][d.pk]) for c in self.dates
                    if d.pk in self.rows.get(c, {}) and self.rows[c][d.pk].observed_km2 > 0]
            good = [(c, r) for c, r in seen if r.coverage_pct >= low] or seen
            peak = max(good, key=lambda cr: cr[1].flood_pct, default=None)
            out[d.pk] = {
                "peak_cycle": peak[0].isoformat() if peak else None,
                "peak_flooded_pct": r1(peak[1].flood_pct) if peak else None,
                "peak_flooded_km2": r1(peak[1].flood_km2_seen) if peak else None,
                "baseline_cycle": good[0][0].isoformat() if good else None,
                "cycles_observed": len(seen),
            }
        return out

    def district_record(self, d: District) -> dict:
        """The `District` interface."""
        return {
            "id": d.slug,
            "pk": d.pk,
            "name_en": d.name_en,
            "name_bn": d.name_bn,
            "source_name": d.source_name,
            "shape_id": d.shape_id or None,
            "division": d.division,
            "regime": d.regime,
            "area_km2": r1(d.area_km2),
            "permanent_water_km2": r1(d.permanent_water_km2),
            "centroid": d.centroid,
            "bbox": d.bbox,
            **self.peaks[d.pk],
        }

    # ---- national ---------------------------------------------------------

    def national_stat(self, cycle: date) -> dict:
        rows = self.rows.get(cycle, {})
        observed = [r for r in rows.values() if r.observed_km2 > 0]
        nc = self.national.get(cycle)
        seen_km2 = sum(r.flood_km2_seen for r in observed)
        observed_km2 = nc.area_seen_km2 if nc else sum(r.observed_km2 for r in observed)
        districts_seen = nc.districts_seen if nc else len(observed)
        est_km2 = nc.flood_km2_est if nc else sum(r.flood_km2_est for r in observed)
        # Without district rows (national file only) the measured figure is
        # unknown; fall back to the national estimate rather than report zero.
        flooded_km2 = seen_km2 if observed else est_km2
        ranked = self.ranked(cycle)
        worst = None
        if ranked:
            d, r = ranked[0]
            worst = {"id": d.slug, "name_en": d.name_en, "name_bn": d.name_bn,
                     "flooded_pct": r1(r.flood_pct), "flooded_km2": r1(r.flood_km2_seen)}
        country = self.country_area_km2
        return {
            "flooded_km2": r1(flooded_km2),
            "observed_km2": r1(observed_km2),
            "flooded_pct": r2(flooded_km2 / observed_km2 * 100) if observed_km2 else 0.0,
            "coverage_pct": r1(min(100.0, observed_km2 / country * 100)) if country else 0.0,
            "districts_observed": districts_seen,
            "districts_total": len(self.districts),
            "flood_km2_est": r1(est_km2),
            "worst": worst,
        }

    # ---- overlays -----------------------------------------------------------

    @cached_property
    def overlays(self) -> list[Overlay]:
        return list(Overlay.objects.select_related("frame").order_by("date", "key"))

    def overlays_for(self, cycle: date) -> dict:
        end = cycle + timedelta(days=self.cycle_days)
        flood = [o for o in self.overlays if o.kind == Overlay.Kind.FLOOD and cycle <= o.date < end]
        water_all = [o for o in self.overlays if o.kind == Overlay.Kind.WATER]
        # The newest normal-water layer that already existed in this cycle.
        water = [o for o in water_all if o.date < end][-1:] or water_all[:1]
        return {"flood": flood, "water": water}

    @staticmethod
    def overlay_item(o: Overlay) -> dict:
        return {
            "kind": o.kind,
            "url": o.image.url,
            "bounds": o.leaflet_bounds,
            "date": o.date.isoformat(),
            "frame": o.frame.key if o.frame else None,
            "width": o.width,
            "height": o.height,
        }

    def cycle_overlay(self, cycle: date) -> tuple[dict, list[dict]]:
        found = self.overlays_for(cycle)
        flood, water = found["flood"], found["water"]
        primary = {
            "flood": flood[0].image.url if flood else None,
            "water": water[0].image.url if water else None,
        }
        return primary, [self.overlay_item(o) for o in water + flood]

    @staticmethod
    def _m_per_px(overlays) -> int | None:
        """Typical ground size of one pixel, measured per image (median)."""
        sizes = sorted(
            (o.east - o.west) * 111_320 * math.cos(math.radians((o.south + o.north) / 2)) / o.width
            for o in overlays if o.width
        )
        return round(sizes[len(sizes) // 2]) if sizes else None

    @cached_property
    def grid(self) -> dict:
        """Where national rasters sit. Prefers the normal-water layer's extent."""
        water = [o for o in self.overlays if o.kind == Overlay.Kind.WATER]
        source = water[-1:] or self.overlays
        if source:
            s = min(o.south for o in source)
            w = min(o.west for o in source)
            n = max(o.north for o in source)
            e = max(o.east for o in source)
            width = max((o.width for o in source), default=0)
            height = max((o.height for o in source), default=0)
        elif self.districts:
            s = min(d.bbox_south for d in self.districts)
            w = min(d.bbox_west for d in self.districts)
            n = max(d.bbox_north for d in self.districts)
            e = max(d.bbox_east for d in self.districts)
            width = height = 0
        else:
            return {"width": 0, "height": 0, "projection": "EPSG:3857", "bounds": None,
                    "leaflet_bounds": None, "approx_m_per_px": None}
        m_per_deg = 111_320 * math.cos(math.radians((s + n) / 2))
        return {
            "width": width,
            "height": height,
            "projection": "EPSG:3857 (linear in lon / mercator-y)",
            "bounds": {"west": w, "south": s, "east": e, "north": n},
            "leaflet_bounds": [[s, w], [n, e]],
            "approx_m_per_px": self._m_per_px(source) if source else None,
        }

    # ---- cycles -----------------------------------------------------------

    def cycle_summary(self, cycle: date) -> dict:
        overlay, overlays = self.cycle_overlay(cycle)
        return {
            "date": cycle.isoformat(),
            "cycle_start": cycle.isoformat(),
            "cycle_end": (cycle + timedelta(days=self.cycle_days - 1)).isoformat(),
            "index": self.index[cycle],
            "label": cycle_label(cycle),
            "provisional": self.provisional,
            "national": self.national_stat(cycle),
            "overlay": overlay,
            "overlays": overlays,
        }

    def cycle_detail(self, cycle: date) -> dict:
        rows = self.rows.get(cycle, {})
        districts = {}
        for d in self.districts:
            entry = self.stat(rows.get(d.pk))
            entry["pk"] = d.pk
            entry["name_en"] = d.name_en
            districts[d.slug] = entry
        return {**self.cycle_summary(cycle), "districts": districts}

    # ---- meta ---------------------------------------------------------------

    @cached_property
    def source(self) -> DataSource:
        return DataSource.current()

    @cached_property
    def provisional(self) -> bool:
        merged = {**settings.FLOODWATCH["META_DEFAULTS"], **self.source.meta}
        return bool(merged.get("provisional", True))

    def alert_levels(self) -> dict:
        t = self.t
        return {
            # Names the frontend reads...
            "warning_pct": t["ORANGE_PCT"],
            "severe_pct": t["RED_PCT"],
            # ...and the rest of the rule set, so the UI can explain it.
            "orange_pct": t["ORANGE_PCT"],
            "red_pct": t["RED_PCT"],
            "rise_pp": t["RISE_PP"],
            "close_pct": t["CLOSE_PCT"],
            "min_coverage_pct": t["MIN_COVERAGE_PCT"],
        }

    def meta(self) -> dict:
        defaults = settings.FLOODWATCH["META_DEFAULTS"]
        file_meta = self.source.meta or {}
        merged = {**defaults, **file_meta}
        boundaries = {**defaults["boundaries"], **(file_meta.get("boundaries") or {})}

        last_run = UpdateRun.objects.order_by("-started_at").first()
        last_finished = UpdateRun.objects.exclude(finished_at=None).order_by("-finished_at").first()
        imported = self.source.imported_at
        last_checked = (last_finished.finished_at if last_finished else None) or imported
        latest_image = (
            Scene.objects.aggregate(m=Max("date"))["m"]
            or DistrictCycle.objects.aggregate(m=Max("last_image"))["m"]
        )

        return {
            "mission": merged["mission"],
            "instrument": merged["instrument"],
            "distributor": merged["distributor"],
            "product": merged["product"],
            "provisional": bool(merged.get("provisional", True)),
            "demo_data": bool(merged.get("demo_data", True)),
            "demo_note": merged.get("demo_note", ""),
            "generated_at": merged.get("generated_at") or (imported.isoformat() if imported else None),
            "seed": merged.get("seed"),
            "cycle_length_days": self.cycle_days,
            "season": {
                "start": self.dates[0].isoformat() if self.dates else None,
                "end": self.dates[-1].isoformat() if self.dates else None,
            },
            "latest_cycle": self.latest.isoformat() if self.latest else None,
            "latest_image": latest_image.isoformat() if latest_image else None,
            "last_checked": last_checked.isoformat() if last_checked else None,
            "country_area_km2": self.country_area_km2,
            "alert_levels": self.alert_levels(),
            "low_coverage_pct": self.t["MIN_COVERAGE_PCT"],
            "grid": self.grid,
            "boundaries": boundaries,
            "revisit": {
                "days": self.cycle_days,
                "note": (
                    f"NISAR revisits each location about every {self.cycle_days} days. "
                    "The backend checks for processed data daily, so most daily checks "
                    "correctly find no new radar images."
                ),
            },
            "data_source": {
                "source": self.source.source or None,
                "imported_at": imported.isoformat() if imported else None,
                "fingerprint": self.source.fingerprint or None,
            },
            "last_update": UpdateRunSerializer(last_run).data if last_run else None,
            "counts": {
                "districts": len(self.districts),
                "cycles": len(self.dates),
                "scenes": Scene.objects.count(),
                "overlays": len(self.overlays),
                "flooded_km2_all_cycles": r1(
                    DistrictCycle.objects.aggregate(s=Sum("flood_km2_seen"))["s"] or 0.0
                ),
            },
        }

    def meta_subset(self, *keys: str) -> dict:
        full = {
            "latest_cycle": self.latest.isoformat() if self.latest else None,
            "cycle_length_days": self.cycle_days,
            "season": {
                "start": self.dates[0].isoformat() if self.dates else None,
                "end": self.dates[-1].isoformat() if self.dates else None,
            },
            "alert_levels": self.alert_levels(),
            "low_coverage_pct": self.t["MIN_COVERAGE_PCT"],
            "country_area_km2": self.country_area_km2,
        }
        return {k: full[k] for k in keys}


def feature_collection(season: Season) -> dict:
    """`/api/districts/` - GeoJSON for Leaflet. Every feature carries its full record."""
    return {
        "type": "FeatureCollection",
        "name": "bgd_adm2_districts",
        "attribution": "{name} ({licence})".format(
            **{**settings.FLOODWATCH["META_DEFAULTS"]["boundaries"], **(season.source.meta.get("boundaries") or {})}
        ),
        "features": [
            {
                "type": "Feature",
                "id": d.slug,
                "properties": season.district_record(d),
                "geometry": json.loads(d.geometry),
            }
            for d in season.districts
        ],
    }


class UpdateRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = UpdateRun
        fields = ["id", "status", "started_at", "finished_at", "new_images", "message", "triggered_by"]
