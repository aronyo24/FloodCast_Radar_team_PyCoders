"""
Bangladesh Meteorological Department (BMD) field portal.

BMD officers posted to a district register, sign in, and file field reports:
the situation they are seeing right now and the steps they have taken. The
reports feed a public dashboard next to the radar flood map.

    GET  /api/bmd/csrf/                 set the CSRF cookie (call before the first POST)
    POST /api/bmd/register/             create an officer account and sign in
    POST /api/bmd/login/                sign in with e-mail + password
    POST /api/bmd/logout/               sign out
    GET  /api/bmd/me/                   the signed-in officer, or {"authenticated": false}
    GET  /api/bmd/reports/              public feed (?district= &level= &division= &hours= &mine=1 &limit=)
    POST /api/bmd/reports/              file a report (signed-in officer, for their own district)
    GET  /api/bmd/reports/<id>/         one report
    PATCH/DELETE /api/bmd/reports/<id>/ edit or withdraw your own report
    GET  /api/bmd/summary/              KPIs + the latest report per district

Authentication is Django's session cookie. The Next.js server proxies /api/,
so the browser sees one origin and no CORS is needed; DRF's
SessionAuthentication enforces CSRF on every signed-in write.
"""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import District, FieldReport, Officer
from .serializers import Season

LEVEL_ORDER = {lvl: i for i, lvl in enumerate(FieldReport.Level.values)}
MAX_TEXT = 4000


def bad_request(errors: dict[str, str]) -> Response:
    return Response({"error": next(iter(errors.values())), "fields": errors},
                    status=status.HTTP_400_BAD_REQUEST)


def officer_of(request: Request) -> Officer | None:
    user = request.user
    if not user or not user.is_authenticated:
        return None
    return Officer.objects.select_related("station", "user").filter(user=user).first()


def require_verification() -> bool:
    return getattr(settings, "BMD_REQUIRE_VERIFICATION", False)


class IsActiveOfficer(BasePermission):
    message = "Sign in with a BMD officer account to do this."

    def has_permission(self, request, view):
        officer = officer_of(request)
        if officer is None:
            return False
        if officer.status == Officer.Status.SUSPENDED:
            self.message = "This officer account is suspended. Contact the FloodCast Radar administrator."
            return False
        return True


# ---- serialisation ----------------------------------------------------------


def district_ref(d: District) -> dict:
    return {"id": d.slug, "name_en": d.name_en, "name_bn": d.name_bn, "division": d.division}


def officer_public(o: Officer) -> dict:
    """What the public sees about who filed a report. No phone, e-mail or ID."""
    return {
        "name": o.full_name,
        "designation": o.designation,
        "office": o.office_name,
        "verified": o.verified,
    }


def officer_private(o: Officer) -> dict:
    return {
        **officer_public(o),
        "id": o.pk,
        "email": o.user.email,
        "phone": o.phone,
        "employee_id": o.employee_id,
        "status": o.status,
        "station": district_ref(o.station),
        "joined": o.created_at.isoformat(),
        "report_count": o.reports.count(),
    }


def report_json(r: FieldReport, viewer: Officer | None = None) -> dict:
    return {
        "id": r.pk,
        "district": district_ref(r.district),
        "officer": officer_public(r.officer),
        "level": r.level,
        "water_trend": r.water_trend,
        "rainfall_24h_mm": r.rainfall_24h_mm,
        "river_station": r.river_station,
        "water_level_m": r.water_level_m,
        "danger_level_m": r.danger_level_m,
        "affected_people": r.affected_people,
        "shelters_open": r.shelters_open,
        "conditions": r.conditions,
        "actions_taken": r.actions_taken,
        "needs": r.needs,
        "observed_at": r.observed_at.isoformat(),
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
        "mine": viewer is not None and r.officer_id == viewer.pk,
    }


# ---- auth -------------------------------------------------------------------


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request: Request):
        return Response({"ok": True})


class AuthThrottled(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "bmd_auth"
    permission_classes = [AllowAny]


def _text(data, key: str, limit: int = 200) -> str:
    value = data.get(key, "")
    return str(value).strip()[:limit] if value is not None else ""


class RegisterView(AuthThrottled):
    def post(self, request: Request):
        data = request.data
        full_name = _text(data, "full_name", 120)
        email = _text(data, "email", 254).lower()
        password = str(data.get("password") or "")
        designation = _text(data, "designation", 120)
        employee_id = _text(data, "employee_id", 40)
        phone = _text(data, "phone", 20)
        office_name = _text(data, "office_name", 160)
        district_key = _text(data, "district", 100)

        errors: dict[str, str] = {}
        if len(full_name) < 3:
            errors["full_name"] = "Enter your full name."
        try:
            validate_email(email)
        except ValidationError:
            errors["email"] = "Enter a valid official e-mail address."
        if len(designation) < 2:
            errors["designation"] = "Enter your designation."
        if len(employee_id) < 3:
            errors["employee_id"] = "Enter your BMD employee ID."
        digits = "".join(c for c in phone if c.isdigit())
        if not 10 <= len(digits) <= 15:
            errors["phone"] = "Enter a valid phone number, e.g. 01712345678."
        if len(office_name) < 3:
            errors["office_name"] = "Enter your office or station name."
        district = Season().find_district(district_key) if district_key else None
        if district is None:
            errors["district"] = "Choose the district you are posted to."
        if "email" not in errors and User.objects.filter(username=email).exists():
            errors["email"] = "An account with this e-mail already exists. Sign in instead."
        if "employee_id" not in errors and Officer.objects.filter(employee_id__iexact=employee_id).exists():
            errors["employee_id"] = "This employee ID is already registered."
        if not errors:
            try:
                validate_password(password, user=User(username=email, email=email, first_name=full_name))
            except ValidationError as exc:
                errors["password"] = " ".join(exc.messages)
        if errors:
            return bad_request(errors)

        try:
            with transaction.atomic():
                user = User.objects.create_user(username=email, email=email, password=password,
                                                first_name=full_name[:150])
                officer = Officer.objects.create(
                    user=user, full_name=full_name, designation=designation, employee_id=employee_id,
                    phone=phone, station=district, office_name=office_name,
                )
        except IntegrityError:
            return bad_request({"email": "This account already exists. Sign in instead."})

        login(request._request, user)
        return Response({"authenticated": True, "officer": officer_private(officer)},
                        status=status.HTTP_201_CREATED)


class LoginView(AuthThrottled):
    def post(self, request: Request):
        email = _text(request.data, "email", 254).lower()
        password = str(request.data.get("password") or "")
        if not email or not password:
            return bad_request({"email": "Enter your e-mail and password."})
        user = authenticate(request._request, username=email, password=password)
        officer = Officer.objects.select_related("station", "user").filter(user=user).first() if user else None
        if user is None or officer is None:
            return Response({"error": "E-mail or password is incorrect."}, status=status.HTTP_401_UNAUTHORIZED)
        if officer.status == Officer.Status.SUSPENDED:
            return Response({"error": "This officer account is suspended. Contact the FloodCast Radar administrator."},
                            status=status.HTTP_403_FORBIDDEN)
        login(request._request, user)
        return Response({"authenticated": True, "officer": officer_private(officer)})


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request):
        logout(request._request)
        return Response({"authenticated": False})


@method_decorator(ensure_csrf_cookie, name="get")
class MeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request: Request):
        officer = officer_of(request)
        if officer is None:
            return Response({"authenticated": False, "officer": None})
        return Response({"authenticated": True, "officer": officer_private(officer)})


# ---- reports ----------------------------------------------------------------


def parse_report(data, partial: bool = False) -> tuple[dict, dict[str, str]]:
    """Validate a report body. Returns (clean fields, errors)."""
    clean: dict = {}
    errors: dict[str, str] = {}

    def present(key):
        return not partial or key in data

    if present("level"):
        level = _text(data, "level", 10)
        if level not in FieldReport.Level.values:
            errors["level"] = "Choose the current situation level."
        clean["level"] = level
    if present("water_trend"):
        trend = _text(data, "water_trend", 10) or FieldReport.Trend.UNKNOWN
        if trend not in FieldReport.Trend.values:
            errors["water_trend"] = "Choose rising, steady, falling or not measured."
        clean["water_trend"] = trend
    for key, label in (("conditions", "Describe the current conditions"),
                       ("actions_taken", "Describe the steps you have taken")):
        if present(key):
            text = _text(data, key, MAX_TEXT)
            if len(text) < 10:
                errors[key] = f"{label} (at least 10 characters)."
            clean[key] = text
    if present("needs"):
        clean["needs"] = _text(data, "needs", MAX_TEXT)
    if present("river_station"):
        clean["river_station"] = _text(data, "river_station", 120)

    for key, lo, hi, as_int in (
        ("rainfall_24h_mm", 0, 2000, False),
        ("water_level_m", -50, 200, False),
        ("danger_level_m", -50, 200, False),
        ("affected_people", 0, 50_000_000, True),
        ("shelters_open", 0, 100_000, True),
    ):
        if not present(key):
            continue
        raw = data.get(key)
        if raw in (None, ""):
            clean[key] = None
            continue
        try:
            value = int(raw) if as_int else float(raw)
        except (TypeError, ValueError):
            errors[key] = "Enter a number."
            continue
        if not lo <= value <= hi:
            errors[key] = f"Must be between {lo} and {hi}."
            continue
        clean[key] = value

    if present("observed_at"):
        raw = data.get("observed_at")
        when = parse_datetime(str(raw)) if raw else timezone.now()
        if when is None:
            errors["observed_at"] = "Enter a valid date and time."
        else:
            if timezone.is_naive(when):
                when = timezone.make_aware(when)
            now = timezone.now()
            if when > now + timedelta(minutes=10):
                errors["observed_at"] = "Observation time cannot be in the future."
            elif when < now - timedelta(days=14):
                errors["observed_at"] = "Reports must be about the last 14 days."
            clean["observed_at"] = when
    return clean, errors


def public_reports():
    return FieldReport.objects.filter(hidden=False).select_related("district", "officer", "officer__user")


class ReportsView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method in ("GET", "HEAD", "OPTIONS") else [IsActiveOfficer()]

    def get(self, request: Request):
        viewer = officer_of(request)
        qs = public_reports()
        q = request.query_params
        if q.get("mine") == "1":
            if viewer is None:
                return Response({"reports": [], "count": 0})
            qs = FieldReport.objects.filter(officer=viewer).select_related("district", "officer")
        if q.get("district"):
            district = Season().find_district(q["district"])
            if district is None:
                return Response({"error": f'No district called "{q["district"]}".'}, status=404)
            qs = qs.filter(district=district)
        if q.get("division"):
            qs = qs.filter(district__division__iexact=q["division"])
        if q.get("level"):
            levels = [lvl for lvl in q["level"].split(",") if lvl in FieldReport.Level.values]
            if levels:
                qs = qs.filter(level__in=levels)
        if q.get("verified") == "1":
            qs = qs.filter(officer__status=Officer.Status.VERIFIED)
        if q.get("hours", "").isdigit():
            qs = qs.filter(observed_at__gte=timezone.now() - timedelta(hours=int(q["hours"])))
        try:
            limit = max(1, min(200, int(q.get("limit", 50))))
        except ValueError:
            limit = 50
        total = qs.count()
        return Response({"count": total, "reports": [report_json(r, viewer) for r in qs[:limit]]})

    def post(self, request: Request):
        officer = officer_of(request)
        if require_verification() and not officer.verified:
            return Response({"error": "Your account is awaiting verification by an administrator."},
                            status=status.HTTP_403_FORBIDDEN)
        clean, errors = parse_report(request.data)
        if errors:
            return bad_request(errors)
        report = FieldReport.objects.create(officer=officer, district=officer.station, **clean)
        return Response(report_json(report, officer), status=status.HTTP_201_CREATED)


class ReportDetailView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method in ("GET", "HEAD", "OPTIONS") else [IsActiveOfficer()]

    def _get(self, request, pk: int):
        viewer = officer_of(request)
        report = FieldReport.objects.select_related("district", "officer", "officer__user").filter(pk=pk).first()
        if report is None or (report.hidden and (viewer is None or report.officer_id != viewer.pk)):
            return None, viewer
        return report, viewer

    def get(self, request: Request, pk: int):
        report, viewer = self._get(request, pk)
        if report is None:
            return Response({"error": "Report not found."}, status=404)
        return Response(report_json(report, viewer))

    def patch(self, request: Request, pk: int):
        report, viewer = self._get(request, pk)
        if report is None:
            return Response({"error": "Report not found."}, status=404)
        if report.officer_id != viewer.pk:
            return Response({"error": "You can only edit your own reports."}, status=403)
        clean, errors = parse_report(request.data, partial=True)
        if errors:
            return bad_request(errors)
        for key, value in clean.items():
            setattr(report, key, value)
        report.save()
        return Response(report_json(report, viewer))

    def delete(self, request: Request, pk: int):
        report, viewer = self._get(request, pk)
        if report is None:
            return Response({"error": "Report not found."}, status=404)
        if report.officer_id != viewer.pk:
            return Response({"error": "You can only withdraw your own reports."}, status=403)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SummaryView(APIView):
    """Dashboard header numbers and the newest report from every district."""

    permission_classes = [AllowAny]

    def get(self, request: Request):
        now = timezone.now()
        day = now - timedelta(hours=24)
        week = now - timedelta(days=7)
        reports = public_reports()
        recent = reports.filter(observed_at__gte=day)

        latest: dict[int, FieldReport] = {}
        for r in reports.filter(observed_at__gte=week):
            latest.setdefault(r.district_id, r)  # ordered newest first

        by_level = {lvl: 0 for lvl in FieldReport.Level.values}
        for r in latest.values():
            by_level[r.level] += 1

        board = sorted(latest.values(), key=lambda r: (-LEVEL_ORDER[r.level], -r.observed_at.timestamp()))
        officers = Officer.objects.exclude(status=Officer.Status.SUSPENDED).aggregate(
            total=Count("id"), verified=Count("id", filter=Q(status=Officer.Status.VERIFIED)),
        )
        return Response({
            "generated_at": now.isoformat(),
            "reports_24h": recent.count(),
            "reports_7d": reports.filter(observed_at__gte=week).count(),
            "districts_reporting_7d": len(latest),
            "districts_total": District.objects.count(),
            "danger_or_worse": by_level["danger"] + by_level["extreme"],
            "by_level": by_level,
            "officers": officers["total"],
            "officers_verified": officers["verified"],
            "people_affected": sum(r.affected_people or 0 for r in latest.values()),
            "shelters_open": sum(r.shelters_open or 0 for r in latest.values()),
            "board": [
                {
                    "district": district_ref(r.district),
                    "level": r.level,
                    "water_trend": r.water_trend,
                    "observed_at": r.observed_at.isoformat(),
                    "report_id": r.pk,
                    "officer": officer_public(r.officer),
                }
                for r in board
            ],
        })
