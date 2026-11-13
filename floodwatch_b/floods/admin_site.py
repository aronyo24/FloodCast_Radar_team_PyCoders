"""
FloodCast Radar admin site: a dashboard home page and a guided "Import data" flow
on top of the regular Django admin.

    /admin/                         dashboard: data freshness, alerts, quick actions
    /admin/data/import/             upload a .zip or individual files
    /admin/data/import/<token>/     check result -> "Import now" or "Cancel"
    /admin/data/template/<file>     example file with the right columns
    /admin/data/download/           the current web_data as a .zip
    /admin/data/check-now/          POST: run the update job
    /admin/data/recompute-alerts/   POST: re-run the alert rules
"""

from __future__ import annotations

import io
import zipfile

from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone
from django.views.decorators.http import require_POST


def can_manage_data(user) -> bool:
    return user.is_active and (user.is_superuser or user.has_perm("floods.change_datasource"))


class FloodWatchAdminSite(admin.AdminSite):
    site_header = "FloodCast Radar administration"
    site_title = "FloodCast Radar admin"
    index_title = "Dashboard"
    index_template = "admin/floodwatch/index.html"

    # ---- URLs -------------------------------------------------------------

    def get_urls(self):
        v = self.admin_view
        return [
            path("data/import/", v(self.import_view), name="floods_import"),
            path("data/import/<str:token>/", v(self.import_review), name="floods_import_review"),
            path("data/template/<str:name>", v(self.template_view), name="floods_template"),
            path("data/download/", v(self.download_view), name="floods_download"),
            path("data/check-now/", v(require_POST(self.check_now)), name="floods_check_now"),
            path("data/recompute-alerts/", v(require_POST(self.recompute_alerts)), name="floods_recompute_alerts"),
        ] + super().get_urls()

    def _require_manager(self, request):
        if not can_manage_data(request.user):
            raise PermissionDenied("You need permission to change FloodCast Radar data.")

    def _render(self, request, template, context):
        ctx = {**self.each_context(request), **context}
        return TemplateResponse(request, template, ctx)

    # ---- Dashboard --------------------------------------------------------

    def index(self, request, extra_context=None):
        from django.conf import settings
        from django.db.models import Count, Max

        from .models import DataSource, District, DistrictCycle, FloodAlert, NationalCycle, Overlay, Scene, UpdateRun

        cycles = DistrictCycle.objects.aggregate(latest=Max("cycle_start"), n=Count("cycle_start", distinct=True))
        latest = cycles["latest"]
        national = NationalCycle.objects.filter(cycle_start=latest).first() if latest else None
        ds = DataSource.objects.filter(pk=1).first()
        meta = (ds.meta if ds else {}) or {}
        last_image = Scene.objects.aggregate(d=Max("date"))["d"] or DistrictCycle.objects.aggregate(d=Max("last_image"))["d"]
        alerts = FloodAlert.objects.filter(active=True).select_related("district")
        cfg = settings.FLOODWATCH
        age_days = (timezone.localdate() - last_image).days if last_image else None

        dashboard = {
            "latest_cycle": latest,
            "cycle_count": cycles["n"],
            "district_count": District.objects.count(),
            "overlay_count": Overlay.objects.count(),
            "national": national,
            "last_image": last_image,
            "age_days": age_days,
            "stale": age_days is not None and age_days > cfg["CYCLE_LENGTH_DAYS"] + 3,
            "datasource": ds,
            "demo_data": meta.get("demo_data", True) is not False,
            "red_count": alerts.filter(level=FloodAlert.Level.RED).count(),
            "orange_count": alerts.filter(level=FloodAlert.Level.ORANGE).count(),
            "top_alerts": alerts.order_by("-flood_pct")[:6],
            "runs": UpdateRun.objects.all()[:5],
            "scheduler": (f"Automatic check daily at {cfg['SCHEDULE_HOUR']:02d}:{cfg['SCHEDULE_MINUTE']:02d}"
                          if cfg["SCHEDULER_ENABLED"] else "Automatic in-app check is off (cron or manual)"),
            "has_source": bool(cfg["WEB_DATA_URL"] or cfg["PIPELINE_COMMAND"] or cfg["WEB_DATA_PATH"]),
            "can_manage": can_manage_data(request.user),
        }
        return super().index(request, {**(extra_context or {}), "fw": dashboard})

    # ---- Import -----------------------------------------------------------

    def import_view(self, request):
        from . import data_import
        from .importer import WebDataError

        self._require_manager(request)
        if request.method == "POST":
            uploads = request.FILES.getlist("files")
            try:
                token = data_import.stage_upload(uploads, request.user.pk)
            except WebDataError as exc:
                messages.error(request, str(exc))
                return redirect("admin:floods_import")
            if request.POST.get("real_data"):
                data_import.set_real_data(token, request.user.pk, real=True)
            data_import.preview(token, request.user.pk, with_alerts=bool(request.POST.get("compute_alerts")))
            return redirect("admin:floods_import_review", token=token)

        current = data_import.current_files()
        guide = [
            {"name": n, "required": req, "help": text, "current": current.get(n),
             "template": data_import.template_file(n) is not None}
            for n, req, text in data_import.FILE_GUIDE
        ]
        return self._render(request, "admin/floodwatch/import.html", {
            "title": "Import analysis data",
            "guide": guide,
            "has_current": bool(current),
            "web_data_name": data_import.web_data_path().name,
            "real_data": data_import.current_is_real(),
        })

    def import_review(self, request, token):
        from . import data_import
        from .importer import WebDataError
        from .updater import UpdateInProgress, _lock

        self._require_manager(request)
        try:
            info = data_import.load_info(token, request.user.pk)
        except WebDataError as exc:
            messages.error(request, str(exc))
            return redirect("admin:floods_import")

        if request.method == "POST":
            action = request.POST.get("action")
            if action == "cancel":
                data_import.discard(token)
                messages.info(request, "Upload discarded. Nothing was changed.")
                return redirect("admin:floods_import")
            if action == "import":
                try:
                    summary, run = data_import.apply(token, request.user, _lock)
                except UpdateInProgress as exc:
                    messages.warning(request, str(exc))
                    return redirect("admin:floods_import_review", token=token)
                except WebDataError as exc:
                    messages.error(request, f"Import failed, nothing was changed: {exc}")
                    return redirect("admin:floods_import_review", token=token)
                text = f"Import complete. {summary.headline}"
                if summary.alerts:
                    a = summary.alerts
                    text += f" Alerts: {a['opened']} opened, {a['updated']} updated, {a['closed']} closed."
                messages.success(request, text)
                for w in summary.warnings:
                    messages.warning(request, w)
                return redirect("admin:index")

        summary = data_import.summary_from_info(info)
        return self._render(request, "admin/floodwatch/review.html", {
            "title": "Check the upload",
            "token": token,
            "summary": summary,
            "files": info.get("files", []),
            "mode": info.get("mode"),
            "with_alerts": info.get("with_alerts", True),
        })

    def template_view(self, request, name):
        from . import data_import

        found = data_import.template_file(name)
        if found is None:
            raise Http404("No template for that file.")
        body, ctype = found
        response = HttpResponse(body, content_type=f"{ctype}; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{name}"'
        return response

    def download_view(self, request):
        from . import data_import

        self._require_manager(request)
        src = data_import.web_data_path()
        if src.is_file():
            return FileResponse(open(src, "rb"), as_attachment=True, filename=src.name)
        if not src.is_dir():
            raise Http404("There is no current web_data bundle on the server.")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in sorted(src.rglob("*")):
                if p.is_file():
                    zf.write(p, p.relative_to(src).as_posix())
        buf.seek(0)
        stamp = timezone.localtime().strftime("%Y-%m-%d")
        return FileResponse(buf, as_attachment=True, filename=f"web_data-{stamp}.zip")

    # ---- Quick actions ----------------------------------------------------

    def check_now(self, request):
        from .models import UpdateRun
        from .updater import UpdateInProgress, run_update

        self._require_manager(request)
        try:
            outcome = run_update(triggered_by=f"admin:{request.user.get_username()}")
        except UpdateInProgress as exc:
            messages.warning(request, str(exc))
            return redirect("admin:index")
        run = outcome.run
        first = (run.message.splitlines() or [""])[-1 if run.status == UpdateRun.Status.FAILED else 0]
        if run.status == UpdateRun.Status.SUCCESS:
            new = f" New cycle(s): {', '.join(outcome.new_cycles)}." if outcome.new_cycles else ""
            messages.success(request, f"New data imported.{new} {run.new_images} new image(s).")
        elif run.status == UpdateRun.Status.NO_CHANGE:
            messages.info(request, "Checked: no new data yet. " + first)
        else:
            link = reverse("admin:floods_updaterun_change", args=[run.pk])
            messages.error(request, f"Update failed; the site still shows the previous data. {first} (details: {link})")
        return redirect("admin:index")

    def recompute_alerts(self, request):
        from .alerts import compute_alerts

        self._require_manager(request)
        result = compute_alerts()
        if result.cycle is None:
            messages.warning(request, "No data imported yet, so there is nothing to compute.")
        else:
            messages.success(request, f"Alerts recomputed for {result}.")
        return redirect("admin:index")
