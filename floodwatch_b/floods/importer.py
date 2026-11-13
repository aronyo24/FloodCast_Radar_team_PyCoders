"""
Import a processed `web_data` bundle (directory or .zip) into the database.

Expected layout - see README "web_data format" for every column:

    web_data/
      districts.geojson           required  district boundaries + areas
      district_cycles.csv         required  one row per (cycle_start, district)
      national_cycles.csv         optional  one row per cycle_start
      checkframes.csv             optional  one row per NISAR frame
      district_observations.csv   optional  one row per (scene, district)
      overlays.json               optional  PNG overlay index
      overlays/*.png              optional  files referenced by overlays.json
      meta.json                   optional  provenance (demo_data, product, ...)

Guarantees:
  * Idempotent. Every record has a natural key; re-importing the same bundle
    changes nothing and reports every row as "unchanged".
  * Atomic. All database writes happen in one transaction: a bad row anywhere
    leaves the database exactly as it was.
  * Never deletes. Records missing from a newer bundle are kept.
  * Safe with untrusted archives: no path traversal, no symlinks, bounded size,
    PNG files only.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import math
import re
import shutil
import stat
import tempfile
import zipfile
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterator

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, UnidentifiedImageError

from .models import (
    DataSource,
    District,
    DistrictCycle,
    DistrictObservation,
    Frame,
    NationalCycle,
    Overlay,
    Scene,
)

log = logging.getLogger("floods.importer")

REQUIRED_FILES = ("districts.geojson", "district_cycles.csv")
OPTIONAL_FILES = (
    "national_cycles.csv",
    "checkframes.csv",
    "district_observations.csv",
    "overlays.json",
    "meta.json",
)

# Required columns per CSV. Extra columns are ignored; missing ones are fatal.
COLUMNS = {
    "district_cycles.csv": [
        "cycle_start", "district", "observed_km2", "flood_km2_seen", "coverage_pct",
        "flood_pct", "flood_km2_est", "images", "last_image",
    ],
    "national_cycles.csv": ["cycle_start", "flood_km2_est", "districts_seen", "area_seen_km2"],
    "checkframes.csv": [
        "key", "epsg", "images", "water_cutoff_db", "cutoff_source", "contrast_db",
        "normal_water_method", "first", "last",
    ],
    "district_observations.csv": [
        "scene", "frame", "date", "district", "observed_km2", "water_km2", "flood_km2",
    ],
}

# Other names the Colab notebook uses for the same file / column.
FILE_ALIASES = {"checkframes.csv": ("frames.csv",)}
COLUMN_ALIASES = {
    "checkframes.csv": {"key": ("frame",)},
    "district_observations.csv": {"scene": ("image", "granule")},
}

# Provenance keys a bundle may set in meta.json. Everything else in /api/meta/
# is computed from the database, so a stale meta.json cannot contradict it.
META_KEYS = (
    "mission", "instrument", "distributor", "product", "provisional", "demo_data",
    "demo_note", "generated_at", "seed", "boundaries", "pipeline", "notes",
)


class WebDataError(Exception):
    """The bundle is unusable. The message says which file, line and field."""


@dataclass
class ModelCount:
    created: int = 0
    updated: int = 0
    unchanged: int = 0

    @property
    def total(self) -> int:
        return self.created + self.updated + self.unchanged

    def __str__(self) -> str:
        return f"{self.total} ({self.created} new, {self.updated} updated, {self.unchanged} unchanged)"


@dataclass
class ImportResult:
    source: str
    fingerprint: str
    counts: dict[str, ModelCount] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    skipped_files: list[str] = field(default_factory=list)

    @property
    def new_images(self) -> int:
        """New radar acquisitions = new Scene rows."""
        return self.counts.get("Scene", ModelCount()).created

    @property
    def changed(self) -> bool:
        return any(c.created or c.updated for c in self.counts.values())


# ---------------------------------------------------------------------------
# Opening a bundle safely
# ---------------------------------------------------------------------------


@contextmanager
def open_web_data(path: str | Path) -> Iterator[Path]:
    """Yield a directory holding the bundle. Zips are extracted to a temp dir."""
    src = Path(path).expanduser()
    if not src.exists():
        raise WebDataError(f"Path does not exist: {src}")

    if src.is_dir():
        yield _find_root(src.resolve())
        return

    if not zipfile.is_zipfile(src):
        raise WebDataError(f"{src} is neither a directory nor a ZIP archive.")

    with tempfile.TemporaryDirectory(prefix="floodwatch-import-") as tmp:
        _safe_extract(src, Path(tmp))
        yield _find_root(Path(tmp).resolve())


def _safe_extract(archive: Path, dest: Path) -> None:
    limit = settings.FLOODWATCH["MAX_ZIP_BYTES"]
    with zipfile.ZipFile(archive) as zf:
        members = zf.infolist()
        if len(members) > 20_000:
            raise WebDataError(f"{archive.name}: too many entries ({len(members)}).")
        total = 0
        for info in members:
            name = info.filename
            parts = PurePosixPath(name.replace("\\", "/")).parts
            if (
                name.startswith(("/", "\\"))
                or ".." in parts
                or re.match(r"^[A-Za-z]:", name)
            ):
                raise WebDataError(f"{archive.name}: unsafe path in archive: {name!r}")
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise WebDataError(f"{archive.name}: symbolic links are not allowed ({name!r}).")
            total += info.file_size
            if total > limit:
                raise WebDataError(
                    f"{archive.name}: uncompressed size exceeds {limit // (1024 * 1024)} MB."
                )

        for info in members:
            target = (dest / info.filename).resolve()
            if not target.is_relative_to(dest):
                raise WebDataError(f"{archive.name}: unsafe path in archive: {info.filename!r}")
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as fsrc, open(target, "wb") as fdst:
                shutil.copyfileobj(fsrc, fdst)


def _find_root(base: Path) -> Path:
    """The bundle may sit at the top level or inside one wrapping folder."""
    if (base / "districts.geojson").is_file():
        return base
    candidates = sorted(p.parent for p in base.glob("*/districts.geojson"))
    candidates += sorted(p.parent for p in base.glob("*/*/districts.geojson"))
    candidates = [c for c in candidates if "__MACOSX" not in c.parts]
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        raise WebDataError(f"No districts.geojson found in {base} (looked two levels deep).")
    raise WebDataError(f"Several web_data folders found in {base}: {', '.join(map(str, candidates))}")


def fingerprint(root: Path) -> str:
    """Content hash of every file in the bundle (names + bytes)."""
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                digest.update(chunk)
    return digest.hexdigest()


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _read_csv(root: Path, name: str) -> list[tuple[int, dict[str, str]]] | None:
    path = root / name
    if not path.is_file():
        path = next((root / a for a in FILE_ALIASES.get(name, ()) if (root / a).is_file()), None)
        if path is None:
            return None
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        header = [h.strip() for h in (reader.fieldnames or [])]
        # Accept the notebook's alternative column names (e.g. `image` for `scene`).
        renames = {}
        for column, alternatives in COLUMN_ALIASES.get(name, {}).items():
            if column not in header:
                found = next((a for a in alternatives if a in header), None)
                if found:
                    renames[column] = found
        missing = [c for c in COLUMNS[name] if c not in header and c not in renames]
        if missing:
            raise WebDataError(f"{path.name}: missing required column(s): {', '.join(missing)}. Found: {', '.join(header) or '(none)'}")
        rows = []
        for line, row in enumerate(reader, start=2):
            data = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            for column, source in renames.items():
                data[column] = data.get(source, "")
            rows.append((line, data))
        return rows


class _Row:
    """Typed access to one CSV row with errors that name file, line and column."""

    def __init__(self, file: str, line: int, data: dict[str, str]):
        self.file, self.line, self.data = file, line, data

    def _fail(self, column: str, expected: str) -> WebDataError:
        return WebDataError(
            f"{self.file} line {self.line}: column '{column}' must be {expected}, got {self.data.get(column)!r}."
        )

    def text(self, column: str, required: bool = True) -> str:
        value = self.data.get(column, "")
        if required and not value:
            raise self._fail(column, "non-empty")
        return value

    def number(self, column: str, required: bool = True, minimum: float | None = 0.0,
               maximum: float | None = None) -> float | None:
        raw = self.data.get(column, "")
        if raw == "":
            if required:
                raise self._fail(column, "a number")
            return None
        try:
            value = float(raw)
        except ValueError:
            raise self._fail(column, "a number") from None
        if not math.isfinite(value):
            raise self._fail(column, "a finite number")
        if minimum is not None and value < minimum:
            raise self._fail(column, f">= {minimum:g}")
        if maximum is not None and value > maximum:
            raise self._fail(column, f"<= {maximum:g}")
        return value

    def integer(self, column: str, required: bool = True) -> int | None:
        value = self.number(column, required=required)
        if value is None:
            return None
        if value != int(value):
            raise self._fail(column, "a whole number")
        return int(value)

    def day(self, column: str, required: bool = True) -> date | None:
        raw = self.data.get(column, "")
        if raw == "":
            if required:
                raise self._fail(column, "a date (YYYY-MM-DD)")
            return None
        try:
            return date.fromisoformat(raw[:10])
        except ValueError:
            raise self._fail(column, "a date (YYYY-MM-DD)") from None


def _parse_date(value: Any, where: str) -> date:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        raise WebDataError(f"{where}: expected a date (YYYY-MM-DD), got {value!r}.") from None


def _round(value: float | None, digits: int = 6) -> float | None:
    return None if value is None else round(value, digits)


# ---------------------------------------------------------------------------
# Generic idempotent upsert
# ---------------------------------------------------------------------------


def _sync(model: type[models.Model], key_fields: tuple[str, ...], rows: list[dict[str, Any]],
          existing: dict[tuple, models.Model] | None = None) -> tuple[ModelCount, dict[tuple, models.Model]]:
    """
    Create missing rows, update changed ones, leave identical ones alone.

    `rows` are dicts of field -> value including the key fields. Returns the
    counts and the final key -> instance map (useful for foreign keys).
    """
    if existing is None:
        existing = {tuple(getattr(o, f) for f in key_fields): o for o in model.objects.all()}
    count = ModelCount()
    to_create, to_update, changed_fields = [], [], set()

    seen: set[tuple] = set()
    for values in rows:
        key = tuple(values[f] for f in key_fields)
        if key in seen:
            raise WebDataError(f"Duplicate {model.__name__} key {key} in the bundle.")
        seen.add(key)
        obj = existing.get(key)
        if obj is None:
            obj = model(**values)
            to_create.append(obj)
            existing[key] = obj
            count.created += 1
            continue
        diff = [f for f, v in values.items() if f not in key_fields and getattr(obj, f) != v]
        if diff:
            for f in diff:
                setattr(obj, f, values[f])
            changed_fields.update(diff)
            to_update.append(obj)
            count.updated += 1
        else:
            count.unchanged += 1

    if to_create:
        model.objects.bulk_create(to_create, batch_size=500)
        if any(o.pk is None for o in to_create):  # backends without RETURNING
            fresh = {tuple(getattr(o, f) for f in key_fields): o for o in model.objects.all()}
            existing.update({k: fresh[k] for k in existing if k in fresh})
    if to_update:
        model.objects.bulk_update(to_update, sorted(changed_fields), batch_size=500)
    return count, existing


# ---------------------------------------------------------------------------
# Districts
# ---------------------------------------------------------------------------


def _rings(geometry: dict) -> list[list[list[float]]]:
    """Exterior and interior rings of a Polygon / MultiPolygon."""
    kind, coords = geometry.get("type"), geometry.get("coordinates")
    if kind == "Polygon":
        return list(coords)
    if kind == "MultiPolygon":
        return [ring for poly in coords for ring in poly]
    raise ValueError(f"geometry type must be Polygon or MultiPolygon, got {kind!r}")


def _centroid_and_bbox(geometry: dict) -> tuple[list[float], list[float]]:
    """Area-weighted planar centroid (lon/lat) and [w, s, e, n] bbox."""
    polys = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    xs, ys = [], []
    a_sum = cx_sum = cy_sum = 0.0
    for poly in polys:
        for ring_index, ring in enumerate(poly):
            sign = 1.0 if ring_index == 0 else -1.0
            a = cx = cy = 0.0
            for (x0, y0, *_), (x1, y1, *_) in zip(ring, ring[1:] + ring[:1]):
                cross = x0 * y1 - x1 * y0
                a += cross
                cx += (x0 + x1) * cross
                cy += (y0 + y1) * cross
                xs.append(x0)
                ys.append(y0)
            if a:
                a_sum += sign * abs(a) / 2
                cx_sum += sign * abs(a) / 2 * (cx / (3 * a))
                cy_sum += sign * abs(a) / 2 * (cy / (3 * a))
    if not xs:
        raise ValueError("geometry has no coordinates")
    bbox = [min(xs), min(ys), max(xs), max(ys)]
    if a_sum:
        centroid = [cx_sum / a_sum, cy_sum / a_sum]
    else:
        centroid = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
    return [round(c, 5) for c in centroid], [round(b, 5) for b in bbox]


_REFERENCE: dict[str, dict] | None = None


def _district_reference() -> dict[str, dict]:
    """Static names / divisions / slugs for the 64 districts, keyed by lowercase name."""
    global _REFERENCE
    if _REFERENCE is None:
        data = json.loads((Path(__file__).parent / "district_reference.json").read_text(encoding="utf-8"))
        index: dict[str, dict] = {}
        for source_name, info in data["districts"].items():
            info = {**info, "source_name": source_name}
            for key in (source_name, info["name_en"], info["slug"]):
                index.setdefault(key.lower(), info)
        _REFERENCE = index
    return _REFERENCE


def _import_districts(root: Path) -> tuple[ModelCount, dict[str, District]]:
    path = root / "districts.geojson"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise WebDataError(f"districts.geojson is not valid JSON: {exc}") from None
    features = data.get("features") if isinstance(data, dict) else None
    if data.get("type") != "FeatureCollection" or not isinstance(features, list) or not features:
        raise WebDataError("districts.geojson must be a non-empty GeoJSON FeatureCollection.")

    rows: list[dict[str, Any]] = []
    explicit_pk: dict[str, int] = {}
    for n, feature in enumerate(features, start=1):
        where = f"districts.geojson feature {n}"
        props = feature.get("properties") or {}
        geometry = feature.get("geometry")
        raw_name = props.get("name_en") or props.get("name") or props.get("district") or props.get("shapeName")
        if not raw_name:
            raise WebDataError(
                f"{where}: the district needs a name. Add properties.name_en "
                f"(or name / district / shapeName). Found properties: {', '.join(props) or '(none)'}."
            )
        # Fill facts the bundle leaves out (Bengali name, division, official
        # spelling, URL slug) from the static reference. Bundle values win.
        ref = _district_reference().get(str(raw_name).strip().lower(), {})
        name_en = props.get("name_en") or ref.get("name_en") or raw_name
        where = f"{where} ({name_en})"
        try:
            area = float(props["area_km2"])
        except (KeyError, TypeError, ValueError):
            raise WebDataError(f"{where}: properties.area_km2 must be a number.") from None
        if not geometry:
            raise WebDataError(f"{where}: geometry is missing.")
        try:
            centroid, bbox = _centroid_and_bbox(geometry)
            _rings(geometry)
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            raise WebDataError(f"{where}: invalid geometry ({exc}).") from None

        raw_id = props.get("id", props.get("district_id", feature.get("id")))
        slug = props.get("slug") or ref.get("slug")
        if raw_id is not None and str(raw_id).isdigit():
            pk = int(raw_id)
        else:
            pk = None
            slug = slug or (str(raw_id) if raw_id else None)
        slug = slugify(slug or name_en)
        if not slug:
            raise WebDataError(f"{where}: could not derive a slug from the name.")
        if pk is not None:
            explicit_pk[slug] = pk

        if isinstance(props.get("centroid"), list) and len(props["centroid"]) == 2:
            centroid = [float(v) for v in props["centroid"]]
        if isinstance(props.get("bbox"), list) and len(props["bbox"]) == 4:
            bbox = [float(v) for v in props["bbox"]]

        row = {
            "slug": slug,
            "name_en": str(name_en),
            "name_bn": str(props.get("name_bn") or ref.get("name_bn") or ""),
            "area_km2": round(area, 6),
            "geometry": json.dumps(geometry, separators=(",", ":")),
            "source_name": str(props.get("source_name") or props.get("shapeName") or ref.get("source_name") or raw_name),
            "shape_id": str(props.get("shape_id") or props.get("shapeID") or ref.get("shape_id") or ""),
            "division": str(props.get("division") or ref.get("division") or ""),
            "regime": str(props.get("regime") or ref.get("regime") or ""),
            "centroid_lon": centroid[0],
            "centroid_lat": centroid[1],
            "bbox_west": bbox[0],
            "bbox_south": bbox[1],
            "bbox_east": bbox[2],
            "bbox_north": bbox[3],
        }
        # Analysis value: only touch it when the bundle supplies it.
        if props.get("permanent_water_km2") not in (None, ""):
            try:
                row["permanent_water_km2"] = round(float(props["permanent_water_km2"]), 6)
            except (TypeError, ValueError):
                raise WebDataError(f"{where}: properties.permanent_water_km2 must be a number.") from None
        rows.append(row)

    existing = {(d.slug,): d for d in District.objects.all()}
    # Integer ids from the source become primary keys on first import, so CSVs
    # that reference districts by number keep working.
    for row in rows:
        if (row["slug"],) not in existing and row["slug"] in explicit_pk:
            row["id"] = explicit_pk[row["slug"]]
    count, final = _sync(District, ("slug",), rows, existing)
    # `id` is set only on rows being created, so it never counts as a change.
    by_slug = {k[0]: v for k, v in final.items()}
    return count, by_slug


class _DistrictResolver:
    """Accepts a district's id, slug, English name or source name."""

    def __init__(self):
        self.index: dict[str, District] = {}
        for d in District.objects.all():
            for key in (str(d.pk), d.slug, d.name_en.lower(), d.source_name.lower(), d.name_bn):
                if key:
                    self.index.setdefault(key, d)

    def __call__(self, value: str, where: str) -> District:
        district = self.index.get(value) or self.index.get(value.lower()) or self.index.get(slugify(value))
        if district is None:
            raise WebDataError(f"{where}: unknown district {value!r} (not in districts.geojson).")
        return district


# ---------------------------------------------------------------------------
# Frames, scenes, observations, cycles
# ---------------------------------------------------------------------------


def _import_frames(root: Path, result: ImportResult) -> dict[str, Frame]:
    rows = _read_csv(root, "checkframes.csv")
    existing = {(f.key,): f for f in Frame.objects.all()}
    if rows is None:
        result.skipped_files.append("checkframes.csv")
        return {k[0]: v for k, v in existing.items()}
    values = []
    for line, data in rows:
        r = _Row("checkframes.csv", line, data)
        first, last = r.day("first", required=False), r.day("last", required=False)
        if first and last and first > last:
            raise WebDataError(f"checkframes.csv line {line}: 'first' ({first}) is after 'last' ({last}).")
        values.append({
            "key": r.text("key"),
            "epsg": r.integer("epsg", required=False),
            "images": r.integer("images", required=False) or 0,
            "water_cutoff_db": _round(r.number("water_cutoff_db", required=False, minimum=None)),
            "cutoff_source": r.text("cutoff_source", required=False),
            "contrast_db": _round(r.number("contrast_db", required=False, minimum=None)),
            "normal_water_method": r.text("normal_water_method", required=False),
            "first": first,
            "last": last,
        })
    result.counts["Frame"], final = _sync(Frame, ("key",), values, existing)
    return {k[0]: v for k, v in final.items()}


def _import_observations(root: Path, result: ImportResult, frames: dict[str, Frame],
                         resolve: _DistrictResolver) -> None:
    rows = _read_csv(root, "district_observations.csv")
    if rows is None:
        result.skipped_files.append("district_observations.csv")
        return

    scenes: dict[str, dict[str, Any]] = {}
    observations: list[tuple[str, District, dict[str, Any]]] = []
    for line, data in rows:
        r = _Row("district_observations.csv", line, data)
        name, frame_key, day = r.text("scene"), r.text("frame"), r.day("date")
        previous = scenes.get(name)
        if previous and (previous["frame_key"] != frame_key or previous["date"] != day):
            raise WebDataError(
                f"district_observations.csv line {line}: scene {name!r} appears with a different frame or date."
            )
        scenes[name] = {"frame_key": frame_key, "date": day}
        district = resolve(r.text("district"), f"district_observations.csv line {line}")
        observed = r.number("observed_km2")
        water, flood = r.number("water_km2"), r.number("flood_km2")
        observations.append((name, district, {
            "observed_km2": _round(observed),
            "water_km2": _round(water),
            "flood_km2": _round(flood),
        }))

    # Frames referenced by scenes but absent from checkframes.csv get a bare row.
    missing = sorted({s["frame_key"] for s in scenes.values()} - frames.keys())
    if missing:
        result.warnings.append(f"{len(missing)} frame(s) not in checkframes.csv, created without metadata: {', '.join(missing)}")
        Frame.objects.bulk_create([Frame(key=k) for k in missing])
        frames.update({f.key: f for f in Frame.objects.filter(key__in=missing)})

    scene_rows = [{"name": n, "frame_id": frames[s["frame_key"]].pk, "date": s["date"]} for n, s in scenes.items()]
    result.counts["Scene"], scene_map = _sync(Scene, ("name",), scene_rows)
    obs_rows = [
        {"scene_id": scene_map[(name,)].pk, "district_id": district.pk, **values}
        for name, district, values in observations
    ]
    result.counts["DistrictObservation"], _ = _sync(DistrictObservation, ("scene_id", "district_id"), obs_rows)


def _import_district_cycles(root: Path, result: ImportResult, resolve: _DistrictResolver) -> None:
    rows = _read_csv(root, "district_cycles.csv")
    values = []
    for line, data in rows or []:
        r = _Row("district_cycles.csv", line, data)
        district = resolve(r.text("district"), f"district_cycles.csv line {line}")
        values.append({
            "cycle_start": r.day("cycle_start"),
            "district_id": district.pk,
            "observed_km2": _round(r.number("observed_km2")),
            "flood_km2_seen": _round(r.number("flood_km2_seen")),
            "coverage_pct": _round(r.number("coverage_pct", maximum=100.0)),
            "flood_pct": _round(r.number("flood_pct", maximum=100.0)),
            "flood_km2_est": _round(r.number("flood_km2_est")),
            "images": r.integer("images", required=False) or 0,
            "last_image": r.day("last_image", required=False),
        })
    if not values:
        raise WebDataError("district_cycles.csv has no data rows.")
    result.counts["DistrictCycle"], _ = _sync(DistrictCycle, ("cycle_start", "district_id"), values)


def _import_national(root: Path, result: ImportResult) -> None:
    rows = _read_csv(root, "national_cycles.csv")
    if rows is None:
        result.skipped_files.append("national_cycles.csv")
        return
    values = []
    for line, data in rows:
        r = _Row("national_cycles.csv", line, data)
        values.append({
            "cycle_start": r.day("cycle_start"),
            "flood_km2_est": _round(r.number("flood_km2_est")),
            "districts_seen": r.integer("districts_seen"),
            "area_seen_km2": _round(r.number("area_seen_km2")),
        })
    result.counts["NationalCycle"], _ = _sync(NationalCycle, ("cycle_start",), values)


# ---------------------------------------------------------------------------
# Overlays
# ---------------------------------------------------------------------------

_SAFE_SEGMENT = re.compile(r"[^A-Za-z0-9._-]+")


def _bounds_of(entry: dict, where: str) -> tuple[float, float, float, float]:
    try:
        if "bounds" in entry:
            b = entry["bounds"]
            if isinstance(b, dict):
                s, w, n, e = b["south"], b["west"], b["north"], b["east"]
            else:  # Leaflet order [[south, west], [north, east]]
                (s, w), (n, e) = b
        else:
            s, w, n, e = entry["south"], entry["west"], entry["north"], entry["east"]
        s, w, n, e = (float(v) for v in (s, w, n, e))
    except (KeyError, TypeError, ValueError):
        raise WebDataError(f"{where}: bounds must be [[south, west], [north, east]] or south/west/north/east numbers.") from None
    if not (-90 <= s < n <= 90 and -180 <= w < e <= 180):
        raise WebDataError(f"{where}: bounds out of range or inverted ({s}, {w}, {n}, {e}).")
    return s, w, n, e


def _import_overlays(root: Path, result: ImportResult, frames: dict[str, Frame],
                     media_root: Path | None = None) -> None:
    path = root / "overlays.json"
    if not path.is_file():
        result.skipped_files.append("overlays.json")
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise WebDataError(f"overlays.json is not valid JSON: {exc}") from None
    entries = data.get("overlays") if isinstance(data, dict) else data
    if not isinstance(entries, list):
        raise WebDataError("overlays.json must be a list, or an object with an 'overlays' list.")

    max_bytes = settings.FLOODWATCH["MAX_OVERLAY_BYTES"]
    media_root = Path(media_root or settings.MEDIA_ROOT)
    values = []
    seen_entries: dict[str, str] = {}
    repeats = 0
    for n, entry in enumerate(entries, start=1):
        where = f"overlays.json entry {n}"
        if not isinstance(entry, dict):
            raise WebDataError(f"{where}: must be an object.")
        # A notebook re-run can append the same entry twice: skip exact copies,
        # but refuse two different descriptions of one file.
        signature = json.dumps(entry, sort_keys=True, default=str)
        file_ref = str(entry.get("file") or entry.get("image") or entry.get("path") or "")
        if file_ref in seen_entries:
            if seen_entries[file_ref] == signature:
                repeats += 1
                continue
            raise WebDataError(f"{where}: {file_ref} is listed twice with different date, frame or bounds.")
        seen_entries[file_ref] = signature
        rel = entry.get("file") or entry.get("image") or entry.get("path")
        if not rel or not isinstance(rel, str):
            raise WebDataError(f"{where}: 'file' (path of the PNG inside web_data) is required.")
        src = (root / rel).resolve()
        if not src.is_relative_to(root):
            raise WebDataError(f"{where}: file {rel!r} points outside the web_data folder.")
        if src.suffix.lower() != ".png":
            raise WebDataError(f"{where}: only .png overlays are supported, got {rel!r}.")
        if not src.is_file():
            result.warnings.append(f"{where}: {rel} not found, overlay skipped.")
            continue
        if src.stat().st_size > max_bytes:
            raise WebDataError(f"{where}: {rel} is larger than {max_bytes // (1024 * 1024)} MB.")
        blob = src.read_bytes()
        try:
            with Image.open(io.BytesIO(blob)) as img:
                if img.format != "PNG":
                    raise WebDataError(f"{where}: {rel} is not a PNG file (detected {img.format}).")
                width, height = img.size
                img.verify()
        except (UnidentifiedImageError, OSError, SyntaxError):
            raise WebDataError(f"{where}: {rel} is not a readable PNG file.") from None

        kind = str(entry.get("kind") or "flood").lower()
        if kind not in Overlay.Kind.values:
            raise WebDataError(f"{where}: kind must be one of {', '.join(Overlay.Kind.values)}, got {kind!r}.")
        day = _parse_date(entry.get("date"), where)
        s, w, nn, e = _bounds_of(entry, where)
        frame_key = entry.get("frame")
        frame = None
        if frame_key:
            frame = frames.get(str(frame_key))
            if frame is None:
                frame, _ = Frame.objects.get_or_create(key=str(frame_key))
                frames[frame.key] = frame
                result.warnings.append(f"{where}: frame {frame_key} not in checkframes.csv, created without metadata.")

        key = PurePosixPath(src.relative_to(root).as_posix()).as_posix()
        parts = PurePosixPath(key).parts
        if len(parts) > 1 and parts[0] == "overlays":  # avoid overlays/overlays/
            parts = parts[1:]
        stored = "overlays/" + "/".join(_SAFE_SEGMENT.sub("_", p) for p in parts)
        sha = hashlib.sha256(blob).hexdigest()
        target = media_root / stored
        if not (target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == sha):
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(blob)

        values.append({
            "key": key,
            "kind": kind,
            "date": day,
            "frame_id": frame.pk if frame else None,
            "image": stored,
            "south": s, "west": w, "north": nn, "east": e,
            "width": width, "height": height,
            "sha256": sha,
        })

    if repeats:
        result.warnings.append(f"overlays.json: skipped {repeats} entr{'y' if repeats == 1 else 'ies'} listed twice.")

    # FileField compares as FieldFile; normalise to the stored name.
    existing = {(o.key,): o for o in Overlay.objects.all()}
    for o in existing.values():
        o.image = o.image.name
    result.counts["Overlay"], _ = _sync(Overlay, ("key",), values, existing)


def _import_meta(root: Path, result: ImportResult) -> dict:
    path = root / "meta.json"
    if not path.is_file():
        result.skipped_files.append("meta.json")
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise WebDataError(f"meta.json is not valid JSON: {exc}") from None
    if not isinstance(data, dict):
        raise WebDataError("meta.json must be a JSON object.")
    if "demo_data" in data and not isinstance(data["demo_data"], bool):
        raise WebDataError("meta.json: demo_data must be true or false.")
    # The notebook's own key names.
    for alias, key in (("generated_utc", "generated_at"), ("data", "product")):
        if alias in data and key not in data:
            data[key] = data[alias]
    if isinstance(data.get("boundaries"), str):
        data["boundaries"] = {"name": data["boundaries"]}
    elif "boundaries" in data and not isinstance(data["boundaries"], dict):
        raise WebDataError("meta.json: boundaries must be text or an object.")
    return {k: data[k] for k in META_KEYS if k in data}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def import_root(root: Path, source: str | None = None, log_fn: Callable[[str], None] | None = None,
                media_root: Path | None = None) -> ImportResult:
    """
    Import an already-opened bundle directory.

    `media_root` redirects overlay PNG writes (used by the admin's dry-run
    preview so a check never touches the live media folder).
    """
    for name in REQUIRED_FILES:
        if not (root / name).is_file():
            raise WebDataError(f"Required file missing: {name} (in {root}).")

    result = ImportResult(source=source or str(root), fingerprint=fingerprint(root))
    emit = log_fn or log.info

    with transaction.atomic():
        result.counts["District"], _ = _import_districts(root)
        resolve = _DistrictResolver()
        frames = _import_frames(root, result)
        _import_observations(root, result, frames, resolve)
        _import_district_cycles(root, result, resolve)
        _import_national(root, result)
        _import_overlays(root, result, frames, media_root=media_root)
        meta = _import_meta(root, result)

        ds = DataSource.current()
        if meta or not ds.meta:
            ds.meta = meta
        ds.source = result.source[:500]
        ds.fingerprint = result.fingerprint
        ds.imported_at = timezone.now()
        ds.save()

    for name, count in result.counts.items():
        emit(f"{name:<20} {count}")
    for name in result.skipped_files:
        emit(f"(optional file not present: {name})")
    for warning in result.warnings:
        emit(f"warning: {warning}")
    return result


def import_web_data(path: str | Path, log_fn: Callable[[str], None] | None = None) -> ImportResult:
    """Open a directory or .zip and import it."""
    with open_web_data(path) as root:
        return import_root(root, source=str(path), log_fn=log_fn)
