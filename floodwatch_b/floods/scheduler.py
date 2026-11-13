"""
Optional in-process daily scheduler (the hackathon deployment option).

Enabled with FLOODWATCH_SCHEDULER=True. It runs `run_update()` every day at
FLOODWATCH_SCHEDULE_HOUR:MINUTE (Asia/Dhaka by default).

Exactly one scheduler runs per machine, however many Django workers start:
the first process to take an exclusive lock on `.scheduler.lock` owns it,
and the rest skip. For production prefer cron or GitHub Actions (README).
"""

from __future__ import annotations

import logging
import os
import sys

from django.conf import settings

log = logging.getLogger("floods.scheduler")

_scheduler = None
_lock_handle = None

# Management commands that must never start a background scheduler.
_SKIP_COMMANDS = {
    "migrate", "makemigrations", "test", "shell", "dbshell", "collectstatic", "check",
    "createsuperuser", "import_web_data", "compute_alerts", "update_floods", "showmigrations",
    "bootstrap_data", "restore_overlays",
    "sqlmigrate", "flush", "loaddata", "dumpdata", "changepassword", "drf_create_token",
}


def _should_start() -> bool:
    if not settings.FLOODWATCH["SCHEDULER_ENABLED"]:
        return False
    argv = sys.argv
    if len(argv) > 1 and argv[0].endswith("manage.py"):
        command = argv[1]
        if command in _SKIP_COMMANDS:
            return False
        if command == "runserver" and "--noreload" not in argv and os.environ.get("RUN_MAIN") != "true":
            return False  # the autoreloader's parent process; the child will start it
    return True


def _take_lock() -> bool:
    global _lock_handle
    try:
        import fcntl
    except ImportError:  # Windows: single-process dev server assumed
        return True
    handle = open(settings.BASE_DIR / ".scheduler.lock", "w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return False
    _lock_handle = handle  # held for the life of the process
    return True


def _job() -> None:
    from .updater import UpdateInProgress, run_update

    try:
        outcome = run_update(triggered_by="scheduler")
        log.info("Scheduled update finished: %s", outcome.run.status)
    except UpdateInProgress:
        log.info("Scheduled update skipped: another update is running.")
    except Exception:  # noqa: BLE001 - a scheduler thread must never die
        log.exception("Scheduled update crashed")


def start() -> None:
    global _scheduler
    if _scheduler is not None or not _should_start():
        return
    if not _take_lock():
        log.info("Scheduler already running in another worker; not starting a second one.")
        return

    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    cfg = settings.FLOODWATCH
    _scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE, daemon=True)
    _scheduler.add_job(
        _job,
        CronTrigger(hour=cfg["SCHEDULE_HOUR"], minute=cfg["SCHEDULE_MINUTE"], timezone=settings.TIME_ZONE),
        id="floodwatch-daily-update",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
        replace_existing=True,
    )
    _scheduler.start()
    log.info("Daily update scheduled at %02d:%02d %s", cfg["SCHEDULE_HOUR"], cfg["SCHEDULE_MINUTE"], settings.TIME_ZONE)
