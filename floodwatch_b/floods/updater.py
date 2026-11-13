"""
The update job behind `manage.py update_floods`, the scheduler and
POST /api/update/.

    1. record an UpdateRun (status=running)
    2. optionally run the external pipeline (FLOODWATCH_PIPELINE_COMMAND)
    3. optionally download a processed bundle (FLOODWATCH_WEB_DATA_URL)
    4. if the bundle's fingerprint changed: import it, then compute alerts
    5. record new_images, finish time, status and message

A failure at any step is caught and written to the UpdateRun - the website
keeps serving the last good data. If the pipeline fails, nothing is imported:
the job never reports fresh data it did not get.
"""

from __future__ import annotations

import logging
import shlex
import subprocess
import tempfile
import threading
import time
import urllib.request
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from .alerts import compute_alerts
from .importer import WebDataError, fingerprint, import_root, open_web_data
from .models import DataSource, UpdateRun

log = logging.getLogger("floods.updater")

_lock = threading.Lock()


class UpdateInProgress(Exception):
    pass


@dataclass
class UpdateOutcome:
    run: UpdateRun
    new_cycles: list[str] = field(default_factory=list)
    latest_cycle: str | None = None
    duration_ms: int = 0
    error: str = ""


def _download(url: str, dest: Path) -> None:
    limit = settings.FLOODWATCH["MAX_ZIP_BYTES"]
    if not url.startswith("https://") and not url.startswith("http://"):
        raise WebDataError("FLOODWATCH_WEB_DATA_URL must be an http(s) URL.")
    request = urllib.request.Request(url, headers={"User-Agent": "FloodCastRadar-backend/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, open(dest, "wb") as fh:  # noqa: S310
        total = 0
        while chunk := response.read(1 << 20):
            total += len(chunk)
            if total > limit:
                raise WebDataError(f"Download exceeds {limit // (1024 * 1024)} MB.")
            fh.write(chunk)


def _cycle_dates() -> set[str]:
    from .models import DistrictCycle

    return {d.isoformat() for d in DistrictCycle.objects.values_list("cycle_start", flat=True).distinct()}


def run_update(triggered_by: str = "cli", force: bool = False) -> UpdateOutcome:
    """Run one update. Raises UpdateInProgress if another run is active."""
    cfg = settings.FLOODWATCH
    stale_after = timedelta(seconds=cfg["PIPELINE_TIMEOUT_S"] + 900)

    if not _lock.acquire(blocking=False):
        raise UpdateInProgress("An update is already running in this process.")
    try:
        # A run left 'running' by a crashed process must not block forever.
        UpdateRun.objects.filter(
            status=UpdateRun.Status.RUNNING, started_at__lt=timezone.now() - stale_after
        ).update(status=UpdateRun.Status.FAILED, finished_at=timezone.now(),
                 message="Marked failed: the process running it stopped before finishing.")
        if UpdateRun.objects.filter(status=UpdateRun.Status.RUNNING).exists():
            raise UpdateInProgress("An update is already running.")

        started = time.monotonic()
        run = UpdateRun.objects.create(status=UpdateRun.Status.RUNNING, triggered_by=triggered_by[:64])
        outcome = UpdateOutcome(run=run)
        before = _cycle_dates()
        notes: list[str] = []
        try:
            if cfg["PIPELINE_COMMAND"]:
                log.info("Running pipeline: %s", cfg["PIPELINE_COMMAND"])
                proc = subprocess.run(  # noqa: S603 - operator-configured command
                    shlex.split(cfg["PIPELINE_COMMAND"]),
                    capture_output=True, text=True, timeout=cfg["PIPELINE_TIMEOUT_S"],
                    cwd=settings.BASE_DIR,
                )
                if proc.returncode != 0:
                    tail = (proc.stderr or proc.stdout or "").strip()[-1500:]
                    raise RuntimeError(f"Pipeline exited with code {proc.returncode}. Nothing was imported.\n{tail}")
                notes.append("Pipeline finished.")

            with tempfile.TemporaryDirectory(prefix="floodwatch-dl-") as tmp:
                source = cfg["WEB_DATA_PATH"]
                if cfg["WEB_DATA_URL"]:
                    source = str(Path(tmp) / "web_data.zip")
                    log.info("Downloading %s", cfg["WEB_DATA_URL"])
                    _download(cfg["WEB_DATA_URL"], Path(source))
                    notes.append("Downloaded processed bundle.")
                if not Path(source).exists():
                    raise WebDataError(
                        f"No processed data found at {source}. Set FLOODWATCH_WEB_DATA "
                        "(a web_data folder or .zip) or FLOODWATCH_WEB_DATA_URL."
                    )

                with open_web_data(source) as root:
                    fp = fingerprint(root)
                    run.source_fingerprint = fp
                    if not force and fp == DataSource.current().fingerprint:
                        run.status = UpdateRun.Status.NO_CHANGE
                        notes.append(
                            "No new processed data since the last import. NISAR revisits "
                            "every ~12 days, so most daily checks find nothing new."
                        )
                    else:
                        result = import_root(root, source=cfg["WEB_DATA_URL"] or source)
                        alerts = compute_alerts()
                        run.new_images = result.new_images
                        run.status = UpdateRun.Status.SUCCESS
                        notes.append(
                            f"Imported: {result.new_images} new image(s); "
                            + ", ".join(f"{k} {v}" for k, v in result.counts.items())
                            + f". Alerts: {alerts}."
                        )
                        notes.extend(f"warning: {w}" for w in result.warnings)
                        if settings.FLOODWATCH_AUTO_NOTIFY:
                            try:
                                from .notify import send_notifications

                                notes.append(f"E-mail notifications: {send_notifications()}.")
                            except Exception as exc:  # noqa: BLE001 - never fail an import over e-mail
                                log.exception("Sending notifications failed")
                                notes.append(f"warning: e-mail notifications failed: {exc}")
        except Exception as exc:  # noqa: BLE001 - every failure must be recorded
            log.exception("Update run %s failed", run.pk)
            run.status = UpdateRun.Status.FAILED
            notes.append(f"{type(exc).__name__}: {exc}")
            first_line = (str(exc).splitlines() or [""])[0]
            outcome.error = f"{type(exc).__name__}: {first_line}"
        finally:
            run.finished_at = timezone.now()
            run.message = "\n".join(notes)[:10_000]
            run.save()

        after = _cycle_dates()
        outcome.new_cycles = sorted(after - before)
        outcome.latest_cycle = max(after) if after else None
        outcome.duration_ms = int((time.monotonic() - started) * 1000)
        return outcome
    finally:
        _lock.release()
        close_old_connections()


def outcome_payload(outcome: UpdateOutcome) -> dict:
    """The frontend's UpdateResult, plus the run record."""
    run = outcome.run
    ok = run.status in (UpdateRun.Status.SUCCESS, UpdateRun.Status.NO_CHANGE)
    lines = [line for line in run.message.splitlines() if line and not line.startswith("warning:")]
    if ok:
        message = " ".join(lines)
        if outcome.new_cycles:
            message = f"{len(outcome.new_cycles)} new cycle(s): {', '.join(outcome.new_cycles)}. {message}"
    else:
        message = f"Update failed - the site still shows the previous data. {outcome.error}"
    return {
        "ok": ok,
        "status": run.status,
        "run_id": run.pk,
        "checked_at": (run.finished_at or timezone.now()).isoformat(),
        "granules_found": run.new_images,
        "new_images": run.new_images,
        "new_cycles": outcome.new_cycles,
        "latest_cycle": outcome.latest_cycle or "",
        "message": message,
        "detail": run.message,
        "duration_ms": outcome.duration_ms,
    }
