"""
REST API for the FloodCast Radar frontend.

    GET  /api/districts/                  GeoJSON FeatureCollection (?format=list: no geometry)
    GET  /api/districts/<id>/timeline/    one district across the season (id, slug or name)
    GET  /api/cycles/                     cycle index + national summary per cycle
    GET  /api/cycles/<date>/              per-district stats (?format=csv to download)
    GET  /api/national/                   national timeline + season peak
    GET  /api/overlays/?cycle=<date>      overlay PNG URLs + bounds
    GET  /api/alerts/                     open alerts (?cycle=<date>: alerts as of that cycle)
    GET  /api/meta/                       freshness, provenance, thresholds
    POST /api/update/                     run an update (staff only)
    GET  /api/districts/<id>/risk/        flood-risk outlook (?cycle=<date>)
    GET  /api/risk/                       outlook for every district, worst first
    POST /api/subscriptions/              sign up for e-mail flood alerts
    GET  /api/subscriptions/unsubscribe/<token>/   one-click unsubscribe

Public endpoints are read-only. Errors are JSON: {"error": "..."}.
"""

from __future__ import annotations

import csv
import io
from datetime import date

from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import HttpResponse
from django.utils.html import escape
from rest_framework.throttling import ScopedRateThrottle
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView, exception_handler

from . import alerts as alert_engine
from . import notify
from .models import FloodAlert, Subscriber
from .risk import district_risk, risk_for_all
from .serializers import DistrictListSerializer, Season, cycle_label, feature_collection
from .updater import UpdateInProgress, outcome_payload, run_update


def api_exception_handler(exc, context):
    """DRF errors carry `detail`; the frontend reads `error`. Send both."""
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and "detail" in response.data:
        response.data["error"] = str(response.data["detail"])
    return response


def not_found(message: str) -> Response:
    return Response({"error": message}, status=status.HTTP_404_NOT_FOUND)


def no_cycle(season: Season, requested: str | None) -> Response:
    if not season.dates:
        return not_found("No flood data has been imported yet. Run `manage.py import_web_data`.")
    return not_found(
        f"No radar cycle on {requested}. Cycles run every {season.cycle_days} days from "
        f"{season.dates[0].isoformat()}; available: {', '.join(d.isoformat() for d in season.dates)}."
    )


class ReadOnlyView(APIView):
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]


class DistrictsView(ReadOnlyView):
    def get(self, request: Request):
        season = Season()
        if request.query_params.get("format") == "list":
            return Response({"districts": DistrictListSerializer(season.districts, many=True).data})
        return Response(feature_collection(season), content_type="application/geo+json; charset=utf-8")


class DistrictTimelineView(ReadOnlyView):
    def get(self, request: Request, key: str):
        season = Season()
        district = season.find_district(key)
        if district is None:
            return not_found(f'No district called "{key}".')
        series = []
        for cycle in season.dates:
            series.append({
                "date": cycle.isoformat(),
                "label": cycle_label(cycle),
                "index": season.index[cycle],
                **season.stat(season.rows.get(cycle, {}).get(district.pk)),
            })
        return Response({
            "district": season.district_record(district),
            "series": series,
            "rank_latest": season.rank_of(district, season.latest),
            "meta": season.meta_subset("latest_cycle", "low_coverage_pct", "alert_levels"),
        })


class CyclesView(ReadOnlyView):
    def get(self, request: Request):
        season = Season()
        return Response({
            "meta": season.meta_subset("latest_cycle", "cycle_length_days", "season", "alert_levels", "low_coverage_pct"),
            "cycles": [season.cycle_summary(c) for c in season.dates],
        })


class CycleDetailView(ReadOnlyView):
    def get(self, request: Request, cycle_date: str):
        season = Season()
        cycle = season.resolve_cycle(cycle_date)
        if cycle is None:
            return no_cycle(season, cycle_date)
        if request.query_params.get("format") == "csv":
            return cycle_csv(season, cycle)
        return Response(season.cycle_detail(cycle))


def cycle_csv(season: Season, cycle: date) -> HttpResponse:
    rank = {d.pk: i for i, (d, _) in enumerate(season.ranked(cycle), start=1)}
    meta = season.meta()
    source = "FloodCast Radar demo data (not NISAR measurements)" if meta["demo_data"] else meta["product"]
    rows = season.rows.get(cycle, {})

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow([
        "rank", "district_id", "district_pk", "district_en", "district_bn", "division", "observed",
        "coverage_pct", "district_area_km2", "observed_area_km2", "flooded_km2",
        "flooded_pct_of_observed", "flood_km2_est", "images", "last_image", "cycle_date", "source",
    ])
    ordered = sorted(season.districts, key=lambda d: (rank.get(d.pk, 9_999), d.name_en))
    for d in ordered:
        row = rows.get(d.pk)
        seen = row is not None and row.observed_km2 > 0
        writer.writerow([
            rank.get(d.pk, ""), d.slug, d.pk, d.name_en, d.name_bn, d.division,
            "yes" if seen else "no",
            round(row.coverage_pct, 1) if seen else "",
            round(d.area_km2, 1),
            round(row.observed_km2, 1) if seen else "",
            round(row.flood_km2_seen, 1) if seen else "",
            round(row.flood_pct, 1) if seen else "",
            round(row.flood_km2_est, 1) if seen else "",
            row.images if seen else "",
            row.last_image.isoformat() if seen and row.last_image else "",
            cycle.isoformat(), source,
        ])
    # BOM so Excel shows the Bangla names correctly.
    response = HttpResponse("﻿" + buf.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="floodcast-radar-{cycle.isoformat()}.csv"'
    return response


class NationalView(ReadOnlyView):
    def get(self, request: Request):
        season = Season()
        series = []
        for c in season.dates:
            n = season.national_stat(c)
            series.append({
                "date": c.isoformat(),
                "label": cycle_label(c),
                "index": season.index[c],
                "flooded_km2": n["flooded_km2"],
                "flooded_pct": n["flooded_pct"],
                "coverage_pct": n["coverage_pct"],
                "districts_observed": n["districts_observed"],
                "observed_km2": n["observed_km2"],
                "flood_km2_est": n["flood_km2_est"],
                "worst_id": n["worst"]["id"] if n["worst"] else None,
                "worst_name_en": n["worst"]["name_en"] if n["worst"] else None,
            })
        peak = max(series, key=lambda s: s["flooded_km2"], default=None)
        return Response({
            "meta": season.meta_subset("latest_cycle", "country_area_km2", "cycle_length_days"),
            "series": series,
            "peak": {"date": peak["date"], "flooded_km2": peak["flooded_km2"]} if peak else None,
        })


class OverlaysView(ReadOnlyView):
    def get(self, request: Request):
        season = Season()
        requested = request.query_params.get("cycle")
        cycle = season.resolve_cycle(requested)
        if cycle is None:
            return no_cycle(season, requested)
        primary, items = season.cycle_overlay(cycle)
        grid = season.grid
        return Response({
            "cycle": cycle.isoformat(),
            "flood": primary["flood"],
            "water": primary["water"],
            "bounds": grid["leaflet_bounds"],
            "opacity": {"flood": 0.8, "water": 0.65},
            "projection": grid["projection"],
            "approx_m_per_px": grid["approx_m_per_px"],
            "overlays": items,
        })


class AlertsView(ReadOnlyView):
    def get(self, request: Request):
        season = Season()
        levels = season.alert_levels()
        requested = request.query_params.get("cycle")
        if requested:
            cycle = season.resolve_cycle(requested)
            if cycle is None:
                return no_cycle(season, requested)
            _, states = alert_engine.replay(until=cycle)
            return Response({
                "cycle": cycle.isoformat(),
                "levels": levels,
                "source": "replayed",
                "alerts": alert_engine.describe(states, cycle),
            })

        # No cycle: the stored, currently-open alerts.
        open_alerts = list(FloodAlert.objects.filter(active=True).select_related("district"))
        latest = season.latest
        out = []
        for a in open_alerts:
            row = season.rows.get(a.cycle_start, {}).get(a.district_id)
            out.append({
                "district_id": a.district.slug,
                "district_pk": a.district_id,
                "name_en": a.district.name_en,
                "name_bn": a.district.name_bn,
                "level": "severe" if a.level == FloodAlert.Level.RED else "warning",
                "level_code": a.level,
                "flooded_pct": a.flood_pct,
                "flooded_km2": round(row.flood_km2_seen, 1) if row else None,
                "coverage_pct": round(row.coverage_pct, 1) if row else None,
                "previous_pct": None,
                "change_pct": None,
                "cycle": a.cycle_start.isoformat(),
                "since": a.created_at.isoformat(),
                "active": True,
            })
        # Fill in the change since the previous cycle from the replay, which
        # is the same computation that opened the alert.
        _, states = alert_engine.replay()
        for item in out:
            s = states.get(item["district_pk"])
            if s:
                item["previous_pct"], item["change_pct"] = s.previous_pct, s.change_pct
        out.sort(key=lambda a: (a["level"] != "severe", -a["flooded_pct"]))
        return Response({
            "cycle": latest.isoformat() if latest else None,
            "levels": levels,
            "source": "stored",
            "alerts": out,
        })


class MetaView(ReadOnlyView):
    def get(self, request: Request):
        return Response(Season().meta())


class UpdateView(APIView):
    """Staff only: session login (Django admin) or `Authorization: Token <key>`."""

    permission_classes = [IsAdminUser]
    http_method_names = ["post", "options"]

    def post(self, request: Request):
        try:
            outcome = run_update(triggered_by=f"api:{request.user.get_username()}")
        except UpdateInProgress as exc:
            return Response({"ok": False, "error": str(exc), "message": str(exc)}, status=status.HTTP_409_CONFLICT)
        payload = outcome_payload(outcome)
        if not payload["ok"]:
            payload["error"] = payload["message"]
        # A failed update is reported, not raised: the request itself worked,
        # and the frontend shows the message. The status code still says so.
        return Response(payload, status=status.HTTP_200_OK if payload["ok"] else status.HTTP_502_BAD_GATEWAY)


class DistrictRiskView(ReadOnlyView):
    def get(self, request: Request, key: str):
        season = Season()
        district = season.find_district(key)
        if district is None:
            return not_found(f'No district called "{key}".')
        requested = request.query_params.get("cycle")
        cycle = season.resolve_cycle(requested)
        if cycle is None and season.dates:
            return no_cycle(season, requested)
        return Response(district_risk(season, district, cycle))


class RiskView(ReadOnlyView):
    def get(self, request: Request):
        season = Season()
        requested = request.query_params.get("cycle")
        cycle = season.resolve_cycle(requested)
        if cycle is None and season.dates:
            return no_cycle(season, requested)
        items = risk_for_all(season, cycle)
        for item in items:
            item.pop("factors", None)
        return Response({"cycle": cycle.isoformat() if cycle else None, "districts": items})


class SubscribeView(APIView):
    """Public sign-up: name, e-mail, district, minimum level. Sends a welcome e-mail."""

    permission_classes = [AllowAny]
    authentication_classes = []  # no session -> no CSRF needed for an anonymous form
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "subscribe"
    http_method_names = ["post", "options"]

    def post(self, request: Request):
        data = request.data
        name = str(data.get("name", "")).strip()[:100]
        email = str(data.get("email", "")).strip().lower()[:254]
        district_key = str(data.get("district", "")).strip()
        min_level = str(data.get("min_level", "moderate"))
        language = "bn" if data.get("language") == "bn" else "en"

        errors = {}
        if len(name) < 2:
            errors["name"] = "Please enter your name."
        try:
            validate_email(email)
        except ValidationError:
            errors["email"] = "Please enter a valid e-mail address."
        if min_level not in Subscriber.MinLevel.values:
            errors["min_level"] = "Choose moderate, high or severe."
        season = Season()
        district = season.find_district(district_key) if district_key else None
        if district is None:
            errors["district"] = "Please choose a district."
        if errors:
            return Response({"error": next(iter(errors.values())), "fields": errors},
                            status=status.HTTP_400_BAD_REQUEST)

        sub = Subscriber.objects.filter(email=email, district=district).first()
        created = sub is None
        if created:
            try:
                sub = Subscriber.objects.create(
                    name=name, email=email, district=district, min_level=min_level,
                    language=language, token=notify.new_token(),
                )
            except IntegrityError:
                sub = Subscriber.objects.get(email=email, district=district)
                created = False
        if not created:
            sub.name, sub.min_level, sub.language, sub.active = name, min_level, language, True
            sub.save(update_fields=["name", "min_level", "language", "active"])

        risk = district_risk(season, district)
        note = notify.send(sub, risk, "welcome")
        return Response({
            "ok": True,
            "created": created,
            "email_sent": note.ok,
            "message": (
                f"Subscribed. A confirmation with today's outlook for {district.name_en} was sent to {email}."
                if note.ok else
                f"Subscribed, but the confirmation e-mail could not be sent right now. You will still get alerts."
            ),
            "district": district.slug,
            "min_level": sub.min_level,
            "risk": {"level": risk["level"], "probability": risk["probability"]},
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class UnsubscribeView(APIView):
    """One-click unsubscribe from the link in every e-mail. Returns a small HTML page."""

    permission_classes = [AllowAny]
    authentication_classes = []
    http_method_names = ["get", "post", "options"]

    def get(self, request: Request, token: str):
        sub = Subscriber.objects.filter(token=token).select_related("district").first()
        if sub is None:
            title, body = "Link not recognised", "This unsubscribe link is invalid or has already been used."
            code = 404
        else:
            if sub.active:
                sub.active = False
                sub.save(update_fields=["active"])
            title = "You are unsubscribed"
            body = (f"{escape(sub.email)} will no longer receive flood alerts for "
                    f"{escape(sub.district.name_en)}. You can subscribe again at any time.")
            code = 200
        html = (
            '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{title} · FloodCast Radar</title>"
            '<body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:#0b1220;color:#e2e8f0;'
            'display:grid;place-items:center;min-height:100vh;padding:16px">'
            '<div style="max-width:420px;background:#111a2e;border:1px solid #1e293b;border-radius:14px;padding:28px">'
            f'<h1 style="margin:0 0 8px;font-size:20px">{title}</h1><p style="color:#94a3b8;line-height:1.5">{body}</p>'
            f'<a href="{escape(notify.site_url("/explorer/"))}" style="color:#38bdf8;font-weight:700">Back to the flood map</a>'
            "</div></body>"
        )
        return HttpResponse(html, status=code)

    post = get
