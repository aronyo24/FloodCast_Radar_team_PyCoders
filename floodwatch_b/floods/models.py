"""
FloodCast Radar data model.

The backend never stores satellite imagery. It stores the *results* of the
external processing pipeline (the `web_data/` bundle): per-scene district
statistics, per-cycle aggregates, and small PNG overlays.

    Frame 1-* Scene 1-* DistrictObservation *-1 District
                                                   |
    NationalCycle        DistrictCycle *-----------+
                         FloodAlert    *-----------+
    Overlay *-1 Frame (optional: a national mosaic has no single frame)
"""

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

NON_NEGATIVE = [MinValueValidator(0.0)]
PERCENT = [MinValueValidator(0.0), MaxValueValidator(100.0)]


class District(models.Model):
    """One of Bangladesh's 64 districts (ADM2). Source: districts.geojson."""

    # `id` is the primary key from the GeoJSON when it supplies an integer,
    # otherwise auto-assigned. `slug` is the stable public key the frontend
    # uses in URLs (`/district/sirajganj/`).
    slug = models.SlugField(max_length=64, unique=True)
    name_en = models.CharField(max_length=100)
    name_bn = models.CharField(max_length=100, blank=True)
    area_km2 = models.FloatField(validators=NON_NEGATIVE)
    geometry = models.TextField(help_text="GeoJSON Polygon or MultiPolygon geometry object.")

    # Optional descriptive fields, carried through when the GeoJSON has them.
    source_name = models.CharField(max_length=100, blank=True, help_text="Name in the boundary source.")
    shape_id = models.CharField(max_length=64, blank=True)
    division = models.CharField(max_length=64, blank=True)
    regime = models.CharField(max_length=32, blank=True)
    permanent_water_km2 = models.FloatField(default=0.0, validators=NON_NEGATIVE)

    # Derived from `geometry` on import so the API never re-parses it.
    centroid_lon = models.FloatField(default=0.0)
    centroid_lat = models.FloatField(default=0.0)
    bbox_west = models.FloatField(default=0.0)
    bbox_south = models.FloatField(default=0.0)
    bbox_east = models.FloatField(default=0.0)
    bbox_north = models.FloatField(default=0.0)

    class Meta:
        ordering = ["name_en"]

    def __str__(self) -> str:
        return self.name_en

    @property
    def centroid(self) -> list[float]:
        return [self.centroid_lon, self.centroid_lat]

    @property
    def bbox(self) -> list[float]:
        return [self.bbox_west, self.bbox_south, self.bbox_east, self.bbox_north]


class Frame(models.Model):
    """A NISAR track/frame, e.g. T045A_F071. Source: checkframes.csv."""

    key = models.CharField(max_length=64, unique=True)
    epsg = models.PositiveIntegerField(null=True, blank=True)
    images = models.PositiveIntegerField(default=0)
    water_cutoff_db = models.FloatField(null=True, blank=True)
    cutoff_source = models.CharField(max_length=64, blank=True)
    contrast_db = models.FloatField(null=True, blank=True)
    normal_water_method = models.CharField(max_length=64, blank=True)
    first = models.DateField(null=True, blank=True)
    last = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["key"]

    def __str__(self) -> str:
        return self.key

    def clean(self):
        if self.first and self.last and self.first > self.last:
            raise ValidationError("Frame 'first' date is after its 'last' date.")


class Scene(models.Model):
    """One acquisition of one frame. Source: district_observations.csv."""

    name = models.CharField(max_length=200, unique=True)
    frame = models.ForeignKey(Frame, on_delete=models.CASCADE, related_name="scenes")
    date = models.DateField(db_index=True)

    class Meta:
        ordering = ["date", "name"]

    def __str__(self) -> str:
        return self.name


class DistrictObservation(models.Model):
    """What one scene saw of one district."""

    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, related_name="observations")
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="observations")
    observed_km2 = models.FloatField(validators=NON_NEGATIVE)
    water_km2 = models.FloatField(validators=NON_NEGATIVE)
    flood_km2 = models.FloatField(validators=NON_NEGATIVE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["scene", "district"], name="uniq_observation_scene_district"),
        ]

    def __str__(self) -> str:
        return f"{self.scene} / {self.district}"


class DistrictCycle(models.Model):
    """One district over one 12-day cycle. Source: district_cycles.csv."""

    cycle_start = models.DateField(db_index=True)
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="cycles")
    observed_km2 = models.FloatField(validators=NON_NEGATIVE)
    flood_km2_seen = models.FloatField(validators=NON_NEGATIVE)
    coverage_pct = models.FloatField(validators=PERCENT)
    # Share of the *observed* area that is newly flooded.
    flood_pct = models.FloatField(validators=PERCENT)
    # flood_pct applied to the whole district area.
    flood_km2_est = models.FloatField(validators=NON_NEGATIVE)
    images = models.PositiveIntegerField(default=0)
    last_image = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["cycle_start", "district__name_en"]
        constraints = [
            models.UniqueConstraint(fields=["cycle_start", "district"], name="uniq_cycle_district"),
        ]

    def __str__(self) -> str:
        return f"{self.district} @ {self.cycle_start}"


class NationalCycle(models.Model):
    """Country-wide totals for one cycle. Source: national_cycles.csv."""

    cycle_start = models.DateField(unique=True)
    flood_km2_est = models.FloatField(validators=NON_NEGATIVE)
    districts_seen = models.PositiveIntegerField()
    area_seen_km2 = models.FloatField(validators=NON_NEGATIVE)

    class Meta:
        ordering = ["cycle_start"]

    def __str__(self) -> str:
        return str(self.cycle_start)


class Overlay(models.Model):
    """A georeferenced PNG for Leaflet. Source: overlays.json + PNG files."""

    class Kind(models.TextChoices):
        FLOOD = "flood", "New flood water"
        WATER = "water", "Normal (permanent) water"

    # The file's path inside web_data - the idempotency key for re-imports.
    key = models.CharField(max_length=255, unique=True)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.FLOOD)
    date = models.DateField(db_index=True)
    frame = models.ForeignKey(Frame, on_delete=models.SET_NULL, null=True, blank=True, related_name="overlays")
    image = models.FileField(upload_to="overlays/")
    south = models.FloatField(validators=[MinValueValidator(-90), MaxValueValidator(90)])
    west = models.FloatField(validators=[MinValueValidator(-180), MaxValueValidator(180)])
    north = models.FloatField(validators=[MinValueValidator(-90), MaxValueValidator(90)])
    east = models.FloatField(validators=[MinValueValidator(-180), MaxValueValidator(180)])
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["date", "kind", "key"]

    def __str__(self) -> str:
        return self.key

    def clean(self):
        if self.south >= self.north or self.west >= self.east:
            raise ValidationError("Overlay bounds must satisfy south < north and west < east.")
        if self.image and not self.image.name.lower().endswith(".png"):
            raise ValidationError("Overlays must be PNG files.")

    @property
    def leaflet_bounds(self) -> list[list[float]]:
        return [[self.south, self.west], [self.north, self.east]]


class FloodAlert(models.Model):
    """An alert raised by floods.alerts for a district."""

    class Level(models.TextChoices):
        ORANGE = "orange", "Orange"
        RED = "red", "Red"

    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="alerts")
    cycle_start = models.DateField(help_text="Cycle the alert was last evaluated on.")
    level = models.CharField(max_length=8, choices=Level.choices)
    flood_pct = models.FloatField(validators=PERCENT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True, db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-active", "-flood_pct"]
        constraints = [
            # At most one open alert per district: re-running the engine
            # updates it rather than stacking duplicates.
            models.UniqueConstraint(fields=["district"], condition=Q(active=True), name="uniq_active_alert_per_district"),
        ]

    def __str__(self) -> str:
        return f"{self.level} {self.district} {self.flood_pct:.1f}%"


class UpdateRun(models.Model):
    """One execution of `update_floods`, for the audit trail and /api/meta/."""

    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        NO_CHANGE = "no_change", "No new data"
        FAILED = "failed", "Failed"

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    new_images = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RUNNING, db_index=True)
    message = models.TextField(blank=True)
    triggered_by = models.CharField(max_length=64, blank=True, help_text="cli, scheduler, or api:<username>")
    source_fingerprint = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"{self.started_at:%Y-%m-%d %H:%M} {self.status}"


class DataSource(models.Model):
    """
    Provenance of the imported bundle (singleton, pk=1).

    `meta` holds web_data/meta.json verbatim. In particular `demo_data` must be
    explicitly false there before the frontend stops labelling figures as demo.
    """

    meta = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=500, blank=True)
    fingerprint = models.CharField(max_length=64, blank=True)
    imported_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "data source"

    def __str__(self) -> str:
        return self.source or "(nothing imported)"

    @classmethod
    def current(cls) -> "DataSource":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Subscriber(models.Model):
    """Someone who asked for flood e-mails about one district."""

    class MinLevel(models.TextChoices):
        MODERATE = "moderate", "Moderate and above"
        HIGH = "high", "High and above"
        SEVERE = "severe", "Severe only"

    name = models.CharField(max_length=100)
    email = models.EmailField()
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="subscribers")
    min_level = models.CharField(max_length=10, choices=MinLevel.choices, default=MinLevel.MODERATE)
    language = models.CharField(max_length=2, choices=[("en", "English"), ("bn", "Bangla")], default="en")
    token = models.CharField(max_length=64, unique=True, help_text="Secret used in the unsubscribe link.")
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # The last outlook this person was told about, so the same news is not resent.
    last_notified_cycle = models.DateField(null=True, blank=True)
    last_notified_level = models.CharField(max_length=10, blank=True)
    last_notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["email", "district"], name="uniq_subscriber_email_district"),
        ]

    def __str__(self) -> str:
        return f"{self.email} → {self.district}"


class Notification(models.Model):
    """One e-mail sent (or attempted) to a subscriber."""

    class Kind(models.TextChoices):
        WELCOME = "welcome", "Welcome"
        ALERT = "alert", "Flood alert"
        ALL_CLEAR = "all_clear", "All clear"
        TEST = "test", "Test"

    subscriber = models.ForeignKey(Subscriber, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    cycle = models.DateField(null=True, blank=True)
    level = models.CharField(max_length=10, blank=True)
    probability = models.PositiveSmallIntegerField(default=0)
    subject = models.CharField(max_length=200)
    sent_at = models.DateTimeField(auto_now_add=True)
    ok = models.BooleanField(default=True)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self) -> str:
        return f"{self.kind} → {self.subscriber.email} ({self.sent_at:%Y-%m-%d %H:%M})"


# ---- Bangladesh Meteorological Department field portal ---------------------


class Officer(models.Model):
    """A BMD officer who files field reports for the district they are posted to.

    Anyone can register, but reports from an officer stay marked *unverified*
    until a FloodCast Radar admin checks their credentials and sets `status` to
    verified. A suspended officer can no longer sign in or file reports.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending verification"
        VERIFIED = "verified", "Verified"
        SUSPENDED = "suspended", "Suspended"

    user = models.OneToOneField("auth.User", on_delete=models.CASCADE, related_name="bmd_officer")
    full_name = models.CharField(max_length=120)
    designation = models.CharField(max_length=120, help_text="e.g. Meteorologist, Assistant Meteorologist, Observer.")
    employee_id = models.CharField(max_length=40, unique=True, help_text="BMD employee / service ID.")
    phone = models.CharField(max_length=20)
    station = models.ForeignKey(District, on_delete=models.PROTECT, related_name="officers",
                                help_text="District the officer is posted to and reports for.")
    office_name = models.CharField(max_length=160, help_text="e.g. Sylhet Meteorological Observatory.")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["station__name_en", "full_name"]
        verbose_name = "BMD officer"

    def __str__(self) -> str:
        return f"{self.full_name} ({self.station})"

    @property
    def verified(self) -> bool:
        return self.status == self.Status.VERIFIED


class FieldReport(models.Model):
    """What an officer is seeing on the ground right now, and what they did about it."""

    class Level(models.TextChoices):
        NORMAL = "normal", "Normal"
        ALERT = "alert", "Alert"
        WARNING = "warning", "Warning"
        DANGER = "danger", "Danger"
        EXTREME = "extreme", "Extreme danger"

    class Trend(models.TextChoices):
        RISING = "rising", "Rising"
        STEADY = "steady", "Steady"
        FALLING = "falling", "Falling"
        UNKNOWN = "unknown", "Not measured"

    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="reports")
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="field_reports")
    level = models.CharField(max_length=10, choices=Level.choices, db_index=True)
    water_trend = models.CharField(max_length=10, choices=Trend.choices, default=Trend.UNKNOWN)
    rainfall_24h_mm = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0), MaxValueValidator(2000.0)])
    river_station = models.CharField(max_length=120, blank=True, help_text="River and gauge station, e.g. Surma @ Sylhet.")
    water_level_m = models.FloatField(null=True, blank=True)
    danger_level_m = models.FloatField(null=True, blank=True)
    affected_people = models.PositiveIntegerField(null=True, blank=True)
    shelters_open = models.PositiveIntegerField(null=True, blank=True)
    conditions = models.TextField(help_text="What the officer is observing in the district right now.")
    actions_taken = models.TextField(help_text="Steps taken: warnings issued, coordination, evacuation support, ...")
    needs = models.TextField(blank=True, help_text="Support or resources requested.")
    observed_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hidden = models.BooleanField(default=False, help_text="Hide from the public dashboard (moderation).")

    class Meta:
        ordering = ["-observed_at", "-id"]
        indexes = [models.Index(fields=["district", "-observed_at"])]

    def __str__(self) -> str:
        return f"{self.district} · {self.get_level_display()} · {self.observed_at:%Y-%m-%d %H:%M}"
