import json

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    DataSource,
    District,
    DistrictCycle,
    DistrictObservation,
    FieldReport,
    FloodAlert,
    Frame,
    NationalCycle,
    Overlay,
    Notification,
    Officer,
    Scene,
    Subscriber,
    UpdateRun,
)

BADGE = ('<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;'
         'font-weight:600;color:#fff;background:{}">{}</span>')
COLORS = {
    "red": "#c62828", "orange": "#e07b00",
    "low": "#15803d", "moderate": "#b45309", "high": "#c2410c", "severe": "#b91c1c",
    "verified": "#2e7d32", "pending": "#b45309", "suspended": "#6b7280",
    "normal": "#15803d", "alert": "#ca8a04", "warning": "#e07b00", "danger": "#c62828", "extreme": "#7f1d1d",
    "success": "#2e7d32", "no_change": "#6b7280", "failed": "#c62828", "running": "#1565c0",
}


def badge(key: str, text: str):
    return format_html(BADGE, COLORS.get(key, "#6b7280"), text)


def pct_bar(value: float | None, color: str = "#e07b00"):
    if value is None:
        return "—"
    width = max(0.0, min(100.0, value))
    return format_html(
        '<span style="display:inline-flex;align-items:center;gap:6px">'
        '<span style="display:inline-block;width:60px;height:6px;border-radius:3px;background:var(--darkened-bg)">'
        '<span style="display:block;height:6px;border-radius:3px;width:{}%;background:{}"></span></span>{}%</span>',
        f"{width:.0f}", color, f"{value:.1f}",
    )


class ReadOnlyAuditAdmin(admin.ModelAdmin):
    """Records written by the system: viewable, not hand-editable."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_bn", "division", "area_km2", "open_alert", "slug")
    search_fields = ("name_en", "name_bn", "slug", "source_name")
    list_filter = ("division", "regime")
    list_per_page = 70
    readonly_fields = ("centroid_lon", "centroid_lat", "bbox_west", "bbox_south", "bbox_east", "bbox_north")
    fieldsets = (
        (None, {"fields": ("name_en", "name_bn", "slug", "division", "regime", "area_km2", "permanent_water_km2")}),
        ("Source", {"fields": ("source_name", "shape_id"), "classes": ("collapse",)}),
        ("Geometry (from the import)", {
            "fields": ("geometry", "centroid_lon", "centroid_lat", "bbox_west", "bbox_south", "bbox_east", "bbox_north"),
            "classes": ("collapse",),
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("alerts")

    @admin.display(description="Open alert")
    def open_alert(self, obj):
        alert = next((a for a in obj.alerts.all() if a.active), None)
        return badge(alert.level, alert.get_level_display()) if alert else "—"


@admin.register(Frame)
class FrameAdmin(admin.ModelAdmin):
    list_display = ("key", "epsg", "images", "water_cutoff_db", "cutoff_source", "first", "last")
    search_fields = ("key",)


@admin.register(Scene)
class SceneAdmin(admin.ModelAdmin):
    list_display = ("name", "frame", "date")
    list_filter = ("frame",)
    date_hierarchy = "date"
    search_fields = ("name",)
    list_select_related = ("frame",)


@admin.register(DistrictObservation)
class DistrictObservationAdmin(admin.ModelAdmin):
    list_display = ("scene", "district", "observed_km2", "water_km2", "flood_km2")
    list_filter = ("scene__frame",)
    search_fields = ("district__name_en", "scene__name")
    list_select_related = ("scene", "district")
    raw_id_fields = ("scene", "district")


@admin.register(DistrictCycle)
class DistrictCycleAdmin(admin.ModelAdmin):
    list_display = ("cycle_start", "district", "flooded", "coverage", "flood_km2_est", "images", "last_image")
    list_display_links = ("cycle_start", "district")
    list_filter = ("cycle_start", "district__division")
    search_fields = ("district__name_en", "district__slug")
    list_select_related = ("district",)
    date_hierarchy = "cycle_start"
    autocomplete_fields = ("district",)
    ordering = ("-cycle_start", "-flood_pct")
    list_per_page = 70

    @admin.display(description="Flooded (of seen area)", ordering="flood_pct")
    def flooded(self, obj):
        return pct_bar(obj.flood_pct, "#c62828" if obj.flood_pct >= 25 else "#e07b00")

    @admin.display(description="Radar coverage", ordering="coverage_pct")
    def coverage(self, obj):
        return pct_bar(obj.coverage_pct, "#1565c0")


@admin.register(NationalCycle)
class NationalCycleAdmin(admin.ModelAdmin):
    list_display = ("cycle_start", "flood_km2_est", "districts_seen", "area_seen_km2")
    ordering = ("-cycle_start",)


@admin.register(Overlay)
class OverlayAdmin(admin.ModelAdmin):
    list_display = ("key", "kind", "date", "frame", "width", "height", "preview")
    list_filter = ("kind", "date")
    list_select_related = ("frame",)

    @admin.display(description="Image")
    def preview(self, obj):
        if not obj.image:
            return "—"
        return format_html('<a href="{0}" target="_blank" rel="noopener"><img src="{0}" alt="" '
                           'style="height:32px;background:#ddd;border-radius:3px"></a>', obj.image.url)


@admin.register(FloodAlert)
class FloodAlertAdmin(admin.ModelAdmin):
    list_display = ("district", "level_badge", "flooded", "cycle_start", "status", "created_at", "closed_at")
    list_filter = ("active", "level", "cycle_start")
    search_fields = ("district__name_en",)
    list_select_related = ("district",)
    readonly_fields = ("created_at", "updated_at", "closed_at")
    list_per_page = 70

    @admin.display(description="Level", ordering="level")
    def level_badge(self, obj):
        return badge(obj.level, obj.get_level_display())

    @admin.display(description="Flooded", ordering="flood_pct")
    def flooded(self, obj):
        return pct_bar(obj.flood_pct, COLORS.get(obj.level, "#e07b00"))

    @admin.display(description="Status", ordering="active", boolean=False)
    def status(self, obj):
        return "Open" if obj.active else "Closed"


@admin.register(UpdateRun)
class UpdateRunAdmin(ReadOnlyAuditAdmin):
    list_display = ("started_at", "status_badge", "new_images", "triggered_by", "duration", "summary")
    list_filter = ("status", "triggered_by")
    readonly_fields = ("started_at", "finished_at", "status", "new_images", "triggered_by",
                       "source_fingerprint", "message_block")
    fields = readonly_fields

    @admin.display(description="Result", ordering="status")
    def status_badge(self, obj):
        return badge(obj.status, obj.get_status_display())

    @admin.display(description="Took")
    def duration(self, obj):
        if not obj.finished_at:
            return "—"
        secs = (obj.finished_at - obj.started_at).total_seconds()
        return f"{secs:.1f} s" if secs < 120 else f"{secs / 60:.1f} min"

    @admin.display(description="Summary")
    def summary(self, obj):
        lines = [line for line in obj.message.splitlines() if line and not line.startswith("warning:")]
        text = lines[-1] if lines else ""
        return text if len(text) <= 110 else text[:107] + "…"

    @admin.display(description="Log")
    def message_block(self, obj):
        return format_html('<pre style="white-space:pre-wrap;margin:0">{}</pre>', obj.message or "—")


@admin.register(DataSource)
class DataSourceAdmin(ReadOnlyAuditAdmin):
    list_display = ("source", "imported_at", "demo", "fingerprint")
    readonly_fields = ("source", "imported_at", "fingerprint", "meta_block")
    fields = readonly_fields

    @admin.display(description="Demo data")
    def demo(self, obj):
        is_demo = (obj.meta or {}).get("demo_data", True) is not False
        return badge("orange" if is_demo else "success", "demo" if is_demo else "real NISAR")

    @admin.display(description="meta.json")
    def meta_block(self, obj):
        link = reverse("admin:floods_import")
        return format_html(
            '<pre style="white-space:pre-wrap;margin:0">{}</pre><p>Change it by <a href="{}">importing</a> a new meta.json.</p>',
            json.dumps(obj.meta, indent=2, ensure_ascii=False), link,
        )


@admin.register(Subscriber)
class SubscriberAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "district", "min_level", "active", "last_level", "last_notified_at", "created_at")
    list_filter = ("active", "min_level", "district__division")
    search_fields = ("email", "name", "district__name_en")
    readonly_fields = ("token", "created_at", "last_notified_cycle", "last_notified_level", "last_notified_at")
    actions = ["send_test_email"]

    @admin.display(description="Last level")
    def last_level(self, obj):
        return badge(obj.last_notified_level, obj.last_notified_level.upper()) if obj.last_notified_level else "—"

    @admin.action(description="Send a test e-mail with today's outlook")
    def send_test_email(self, request, queryset):
        from .notify import send
        from .risk import district_risk
        from .serializers import Season

        season = Season()
        ok = sum(send(sub, district_risk(season, sub.district), "test").ok for sub in queryset)
        self.message_user(request, f"Sent {ok} of {queryset.count()} test e-mail(s).")


@admin.register(Notification)
class NotificationAdmin(ReadOnlyAuditAdmin):
    list_display = ("sent_at", "kind", "subscriber", "level_badge", "probability", "cycle", "ok")
    list_filter = ("kind", "level", "ok")
    search_fields = ("subscriber__email", "subject")

    @admin.display(description="Level")
    def level_badge(self, obj):
        return badge(obj.level, obj.level.upper()) if obj.level else "—"


# ---- BMD field portal -------------------------------------------------------


@admin.register(Officer)
class OfficerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "designation", "station", "office_name", "employee_id", "status_badge",
                    "report_count", "created_at")
    list_filter = ("status", "station__division", "station")
    search_fields = ("full_name", "employee_id", "user__email", "office_name", "station__name_en")
    autocomplete_fields = ("station",)
    readonly_fields = ("user", "created_at", "verified_at")
    actions = ("verify", "suspend", "reset_pending")

    def get_queryset(self, request):
        from django.db.models import Count
        return super().get_queryset(request).select_related("station", "user").annotate(n_reports=Count("reports"))

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        return badge(obj.status, obj.get_status_display())

    @admin.display(description="Reports", ordering="n_reports")
    def report_count(self, obj):
        return obj.n_reports

    @admin.action(description="Verify selected officers")
    def verify(self, request, queryset):
        from django.utils import timezone
        n = queryset.update(status=Officer.Status.VERIFIED, verified_at=timezone.now())
        self.message_user(request, f"{n} officer(s) verified.")

    @admin.action(description="Suspend selected officers")
    def suspend(self, request, queryset):
        n = queryset.update(status=Officer.Status.SUSPENDED)
        self.message_user(request, f"{n} officer(s) suspended.")

    @admin.action(description="Mark selected as pending verification")
    def reset_pending(self, request, queryset):
        n = queryset.update(status=Officer.Status.PENDING, verified_at=None)
        self.message_user(request, f"{n} officer(s) set to pending.")


@admin.register(FieldReport)
class FieldReportAdmin(admin.ModelAdmin):
    list_display = ("observed_at", "district", "level_badge", "water_trend", "officer", "affected_people", "hidden")
    list_filter = ("level", "hidden", "water_trend", "district__division", "district")
    search_fields = ("conditions", "actions_taken", "needs", "officer__full_name", "district__name_en")
    date_hierarchy = "observed_at"
    list_editable = ("hidden",)
    raw_id_fields = ("officer",)
    autocomplete_fields = ("district",)
    readonly_fields = ("created_at", "updated_at")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("district", "officer")

    @admin.display(description="Level", ordering="level")
    def level_badge(self, obj):
        return badge(obj.level, obj.get_level_display())
