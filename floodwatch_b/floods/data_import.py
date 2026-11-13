"""
Import data from the admin panel: upload -> check (dry run) -> confirm.

    stage_upload()   save the uploaded files to a private staging folder. A
                     single .zip is a full bundle. Loose files (for example just
                     a new district_cycles.csv) are laid over a copy of the
                     current bundle, so staff never have to re-upload the
                     district boundaries to add one cycle.
    preview()        run the real importer and the alert engine inside a
                     transaction that is always rolled back, and report what
                     *would* change. Overlay PNGs go to a temp folder.
    apply()          import for real, recompute alerts, log an UpdateRun and
                     save the bundle as the current web_data, so the daily
                     update job does not later re-import the older files.

The importer's guarantees still hold: atomic, idempotent, never deletes.
"""

from __future__ import annotations

import csv
import io
import json
import re
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .importer import COLUMNS, OPTIONAL_FILES, REQUIRED_FILES, WebDataError, _find_root, _safe_extract, import_root, open_web_data

STAGING_TTL_S = 24 * 3600
KEEP_BACKUPS = 5
_TOKEN = re.compile(r"^[0-9a-f]{32}$")
_PNG_NAME = re.compile(r"^[A-Za-z0-9._-]+\.png$", re.IGNORECASE)

# What each bundle file is, in words an admin can act on.
FILE_GUIDE = [
    ("districts.geojson", True, "District boundaries and areas (64 districts). Rarely changes."),
    ("district_cycles.csv", True, "Flood statistics per district for each 12-day cycle. Upload a new one after every cycle."),
    ("national_cycles.csv", False, "Country-wide totals per cycle."),
    ("district_observations.csv", False, "Per-image statistics (one row per radar image × district). Counts new images."),
    ("checkframes.csv", False, "NISAR track/frame settings (water threshold, dates)."),
    ("overlays.json", False, "Index of the map overlay PNGs (date, kind, bounds). Upload the PNGs with it."),
    ("meta.json", False, "Provenance. Set \"demo_data\": false only for real NISAR results."),
]
KNOWN_FILES = {name for name, _, _ in FILE_GUIDE} | {"frames.csv"}  # notebook name for checkframes.csv

EXAMPLE_ROWS = {
    "district_cycles.csv": ["2026-08-04", "sirajganj", "2497.9", "749.4", "100", "30.0", "749.4", "2", "2026-08-04"],
    "national_cycles.csv": ["2026-08-04", "18250.5", "64", "147570.0"],
    "checkframes.csv": ["T045A_F071", "32646", "14", "-18.5", "otsu", "6.2", "dry-season-median", "2026-06-01", "2026-08-04"],
    "district_observations.csv": ["NISAR_L2_GCOV_T045A_F071_20260804", "T045A_F071", "2026-08-04", "sirajganj", "2497.9", "820.1", "749.4"],
}
EXAMPLE_JSON = {
    "meta.json": {
        "mission": "NASA-ISRO NISAR", "product": "Provisional NISAR L-band amplitude",
        "demo_data": True, "generated_at": "2026-08-05T06:00:00Z", "pipeline": "colab-notebook v1",
    },
    "overlays.json": [
        {"file": "overlays/flood_2026-08-04.png", "date": "2026-08-04", "kind": "flood",
         "frame": "T045A_F071", "bounds": [[20.5, 88.0], [26.7, 92.7]]},
    ],
}


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------


def web_data_path() -> Path:
    """The configured bundle location, resolved against the project folder."""
    p = Path(settings.FLOODWATCH["WEB_DATA_PATH"]).expanduser()
    return p if p.is_absolute() else Path(settings.BASE_DIR) / p


def _staging_root() -> Path:
    root = Path(tempfile.gettempdir()) / "floodwatch-admin-import"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _backup_root() -> Path:
    return Path(settings.BASE_DIR) / "web_data_backups"


def staging_dir(token: str) -> Path:
    if not _TOKEN.match(token or ""):
        raise WebDataError("Unknown or expired upload. Please upload the files again.")
    path = _staging_root() / token
    if not (path / "info.json").is_file():
        raise WebDataError("This upload has expired or was already used. Please upload the files again.")
    return path


def cleanup_stale() -> None:
    cutoff = time.time() - STAGING_TTL_S
    for child in _staging_root().iterdir():
        try:
            if child.is_dir() and child.stat().st_mtime < cutoff:
                shutil.rmtree(child, ignore_errors=True)
        except OSError:
            pass


def discard(token: str) -> None:
    try:
        shutil.rmtree(staging_dir(token), ignore_errors=True)
    except WebDataError:
        pass


# ---------------------------------------------------------------------------
# Current bundle status (for the import page)
# ---------------------------------------------------------------------------


def current_files() -> dict[str, dict]:
    """name -> {rows, modified} for the bundle on disk, if it is a folder."""
    root = web_data_path()
    out: dict[str, dict] = {}
    if not root.is_dir():
        return out
    try:
        root = _find_root(root)
    except WebDataError:
        return out
    for name in KNOWN_FILES:
        f = root / name
        if not f.is_file():
            continue
        info = {"modified": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.get_current_timezone()), "rows": None}
        if name.endswith(".csv"):
            with open(f, encoding="utf-8-sig", newline="") as fh:
                info["rows"] = max(sum(1 for _ in fh) - 1, 0)
        out[name] = info
    return out


def template_file(name: str) -> tuple[bytes, str] | None:
    """An example file with the right columns, or None for an unknown name."""
    if name in COLUMNS:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(COLUMNS[name])
        w.writerow(EXAMPLE_ROWS[name])
        return buf.getvalue().encode("utf-8"), "text/csv"
    if name in EXAMPLE_JSON:
        return json.dumps(EXAMPLE_JSON[name], indent=2).encode("utf-8"), "application/json"
    return None


# ---------------------------------------------------------------------------
# Staging
# ---------------------------------------------------------------------------


@dataclass
class StagedFile:
    name: str
    origin: str  # "uploaded" | "kept"


def _write_upload(upload, target: Path, budget: list[int]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "wb") as fh:
        for chunk in upload.chunks():
            budget[0] -= len(chunk)
            if budget[0] < 0:
                limit = settings.FLOODWATCH["MAX_ZIP_BYTES"] // (1024 * 1024)
                raise WebDataError(f"The upload is larger than the {limit} MB limit.")
            fh.write(chunk)


def stage_upload(uploads: list, user_id: int) -> str:
    """Save uploads into a fresh staging folder; return its token."""
    cleanup_stale()
    if not uploads:
        raise WebDataError("Choose at least one file to upload.")

    token = uuid.uuid4().hex
    base = _staging_root() / token
    bundle = base / "bundle"
    budget = [settings.FLOODWATCH["MAX_ZIP_BYTES"]]
    files: list[StagedFile] = []
    mode = "files"
    try:
        zips = [u for u in uploads if u.name.lower().endswith(".zip")]
        if zips:
            if len(uploads) > 1:
                raise WebDataError("Upload a .zip on its own, or upload loose files without a .zip.")
            mode = "zip"
            archive = base / "upload.zip"
            _write_upload(zips[0], archive, budget)
            if not zipfile.is_zipfile(archive):
                raise WebDataError(f"{zips[0].name} is not a valid ZIP archive.")
            extracted = base / "extracted"
            extracted.mkdir(parents=True)
            _safe_extract(archive, extracted)
            shutil.copytree(_find_root(extracted.resolve()), bundle)
            shutil.rmtree(extracted, ignore_errors=True)
            archive.unlink()
            files = [StagedFile(p.relative_to(bundle).as_posix(), "uploaded")
                     for p in sorted(bundle.rglob("*")) if p.is_file()]
        else:
            # Loose files: start from the current bundle, then lay the uploads over it.
            current = web_data_path()
            if current.exists():
                try:
                    with open_web_data(current) as root:
                        shutil.copytree(root, bundle)
                except WebDataError:
                    pass  # an unusable current bundle is simply not used as a base
            bundle.mkdir(parents=True, exist_ok=True)
            kept = {p.relative_to(bundle).as_posix() for p in bundle.rglob("*") if p.is_file()}
            uploaded: set[str] = set()
            for u in uploads:
                name = Path(u.name).name
                if name in KNOWN_FILES:
                    rel = name
                elif _PNG_NAME.match(name):
                    rel = f"overlays/{name}"
                else:
                    raise WebDataError(
                        f"{name!r} is not a web_data file. Expected one of: "
                        f"{', '.join(sorted(KNOWN_FILES))}, overlay .png images, or a .zip of the whole folder."
                    )
                if rel in uploaded:
                    raise WebDataError(f"{name} was chosen twice.")
                uploaded.add(rel)
                _write_upload(u, bundle / rel, budget)
            files = [StagedFile(n, "uploaded") for n in sorted(uploaded)]
            files += [StagedFile(n, "kept") for n in sorted(kept - uploaded)]

        missing = [n for n in REQUIRED_FILES if not (bundle / n).is_file()]
        if missing:
            raise WebDataError(
                f"Missing required file(s): {', '.join(missing)}. There is no current data to take them "
                "from, so include them in this upload (or upload the whole web_data folder as a .zip)."
            )
        (base / "info.json").write_text(json.dumps({
            "user_id": user_id, "mode": mode, "created": time.time(),
            "files": [asdict(f) for f in files],
        }), encoding="utf-8")
    except BaseException:
        shutil.rmtree(base, ignore_errors=True)
        raise
    return token


def set_real_data(token: str, user_id: int, real: bool) -> None:
    """Write demo_data into the staged meta.json (the importer only trusts the file)."""
    load_info(token, user_id)
    meta_path = staging_dir(token) / "bundle" / "meta.json"
    meta = {}
    if meta_path.is_file():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return  # the check step reports the broken file
    if not isinstance(meta, dict) or meta.get("demo_data") is (not real):
        return
    meta["demo_data"] = not real
    meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")


def current_is_real() -> bool:
    from .models import DataSource

    ds = DataSource.objects.filter(pk=1).first()
    return bool(ds and (ds.meta or {}).get("demo_data") is False)


def load_info(token: str, user_id: int) -> dict:
    info = json.loads((staging_dir(token) / "info.json").read_text(encoding="utf-8"))
    if info.get("user_id") != user_id:
        raise WebDataError("This upload belongs to another account.")
    return info


def _save_info(token: str, info: dict) -> None:
    (staging_dir(token) / "info.json").write_text(json.dumps(info, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Preview and apply
# ---------------------------------------------------------------------------


class _Rollback(Exception):
    pass


@dataclass
class Summary:
    ok: bool
    error: str = ""
    counts: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    new_cycles: list[str] = field(default_factory=list)
    latest_cycle: str = ""
    new_images: int = 0
    changed: bool = False
    alerts: dict | None = None

    @property
    def headline(self) -> str:
        if not self.ok:
            return "This data cannot be imported."
        if not self.changed:
            return "Nothing new: this data is already in the database."
        parts = []
        if self.new_cycles:
            parts.append(f"{len(self.new_cycles)} new cycle(s): {', '.join(self.new_cycles)}")
        if self.new_images:
            parts.append(f"{self.new_images} new radar image(s)")
        updated = sum(c["updated"] for c in self.counts)
        created = sum(c["created"] for c in self.counts)
        parts.append(f"{created} new and {updated} changed record(s)")
        return "; ".join(parts) + "."


def _cycle_dates() -> set[str]:
    from .models import DistrictCycle

    return {d.isoformat() for d in DistrictCycle.objects.values_list("cycle_start", flat=True).distinct()}


def _summarise(result, before: set[str], after: set[str], alerts) -> Summary:
    labels = {
        "District": "Districts", "Frame": "Radar frames", "Scene": "Radar images",
        "DistrictObservation": "Per-image district stats", "DistrictCycle": "District cycle stats",
        "NationalCycle": "National cycle totals", "Overlay": "Map overlays",
    }
    counts = [
        {"label": labels.get(k, k), "created": c.created, "updated": c.updated, "unchanged": c.unchanged, "total": c.total}
        for k, c in result.counts.items()
    ]
    return Summary(
        ok=True, counts=counts,
        warnings=list(result.warnings),
        new_cycles=sorted(after - before),
        latest_cycle=max(after) if after else "",
        new_images=result.new_images,
        changed=result.changed,
        alerts=None if alerts is None else {
            "cycle": str(alerts.cycle or ""), "opened": alerts.opened, "updated": alerts.updated,
            "unchanged": alerts.unchanged, "closed": alerts.closed,
        },
    )


def preview(token: str, user_id: int, with_alerts: bool = True) -> Summary:
    """Run the import and alert engine, then roll everything back."""
    from .alerts import compute_alerts

    info = load_info(token, user_id)
    bundle = staging_dir(token) / "bundle"
    summary: Summary | None = None
    try:
        with tempfile.TemporaryDirectory(prefix="floodwatch-preview-media-") as media, transaction.atomic():
            before = _cycle_dates()
            result = import_root(bundle, source="admin upload (check)", log_fn=lambda _m: None, media_root=Path(media))
            alerts = compute_alerts() if with_alerts else None
            summary = _summarise(result, before, _cycle_dates(), alerts)
            raise _Rollback
    except _Rollback:
        pass
    except WebDataError as exc:
        summary = Summary(ok=False, error=str(exc))
    except Exception as exc:  # noqa: BLE001 - show it to the admin, change nothing
        summary = Summary(ok=False, error=f"Unexpected problem while checking the data ({type(exc).__name__}: {exc}).")
    info["preview"] = asdict(summary)
    info["with_alerts"] = with_alerts
    _save_info(token, info)
    return summary


def summary_from_info(info: dict) -> Summary | None:
    data = info.get("preview")
    return Summary(**data) if data else None


def publish_bundle(bundle: Path) -> str:
    """Make `bundle` the configured web_data (backing up the old one). Returns a note."""
    if settings.FLOODWATCH["WEB_DATA_URL"]:
        return ("Note: automatic updates download from FLOODWATCH_WEB_DATA_URL. Publish this data there "
                "too, or the next automatic update may bring back the older figures.")
    target = web_data_path()
    backups = _backup_root()
    stamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
    if target.exists():
        backups.mkdir(parents=True, exist_ok=True)
        dest = backups / f"{stamp}-{target.name}"
        (shutil.copytree if target.is_dir() else shutil.copy2)(target, dest)
        old = sorted(backups.iterdir())
        for stale in old[:-KEEP_BACKUPS]:
            (shutil.rmtree if stale.is_dir() else Path.unlink)(stale)

    if target.suffix.lower() == ".zip":
        tmp = target.with_suffix(".zip.tmp")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in sorted(bundle.rglob("*")):
                if p.is_file():
                    zf.write(p, p.relative_to(bundle).as_posix())
        tmp.replace(target)
    else:
        tmp = target.with_name(target.name + ".new")
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.copytree(bundle, tmp)
        if target.exists():
            old = target.with_name(target.name + ".old")
            shutil.rmtree(old, ignore_errors=True)
            target.rename(old)
            tmp.rename(target)
            shutil.rmtree(old, ignore_errors=True)
        else:
            tmp.rename(target)
    return f"Saved as the current data in {target.name}/ (previous version backed up in {backups.name}/)."


def apply(token: str, user, lock: threading.Lock) -> tuple[Summary, "UpdateRun"]:  # noqa: F821
    """Import for real. Uses the update job's lock so the two never overlap."""
    from .alerts import compute_alerts
    from .models import UpdateRun
    from .updater import UpdateInProgress

    info = load_info(token, user.pk)
    bundle = staging_dir(token) / "bundle"
    if not lock.acquire(blocking=False):
        raise UpdateInProgress("An update is already running. Try again in a minute.")
    try:
        if UpdateRun.objects.filter(status=UpdateRun.Status.RUNNING).exists():
            raise UpdateInProgress("An update is already running. Try again in a minute.")
        run = UpdateRun.objects.create(status=UpdateRun.Status.RUNNING, triggered_by=f"admin:{user.get_username()}"[:64])
        notes = ["Imported from the admin panel."]
        try:
            before = _cycle_dates()
            result = import_root(bundle, source=f"admin upload by {user.get_username()}", log_fn=lambda _m: None)
            alerts = compute_alerts() if info.get("with_alerts", True) else None
            summary = _summarise(result, before, _cycle_dates(), alerts)
            run.source_fingerprint = result.fingerprint
            run.new_images = result.new_images
            run.status = UpdateRun.Status.SUCCESS if result.changed else UpdateRun.Status.NO_CHANGE
            notes.append(summary.headline)
            if alerts is not None:
                notes.append(f"Alerts: {alerts}.")
            try:
                notes.append(publish_bundle(bundle))
            except OSError as exc:
                summary.warnings.append(f"Imported, but the files could not be saved as the current web_data: {exc}")
            notes.extend(f"warning: {w}" for w in summary.warnings)
        except Exception as exc:
            run.status = UpdateRun.Status.FAILED
            notes.append(f"{type(exc).__name__}: {exc}")
            raise
        finally:
            run.finished_at = timezone.now()
            run.message = "\n".join(notes)[:10_000]
            run.save()
    finally:
        lock.release()
    discard(token)
    return summary, run
