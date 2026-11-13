"""
Copy any overlay PNG that is missing from MEDIA_ROOT back from the web_data bundle.

Heroku's filesystem is wiped on every dyno restart, while the database (Heroku
Postgres) persists. The overlay rows therefore survive but their PNG files do
not. The Procfile runs this before gunicorn starts, so /media/overlays/... is
always backed by the files committed in web_data/. Fast and idempotent: files
that are already there are skipped.
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from floods.models import Overlay


class Command(BaseCommand):
    help = "Restore missing overlay PNGs in MEDIA_ROOT from the web_data bundle."

    def add_arguments(self, parser):
        parser.add_argument("web_data", nargs="?", default=settings.FLOODWATCH["WEB_DATA_PATH"])

    def handle(self, *args, web_data, **options):
        source = Path(web_data)
        media = Path(settings.MEDIA_ROOT)
        copied = present = missing = 0
        if not source.is_dir():
            self.stdout.write(self.style.WARNING(f"restore_overlays: {source} is not a directory; nothing to do."))
            return
        for key, name in Overlay.objects.values_list("key", "image"):
            target = media / name
            if target.exists():
                present += 1
                continue
            src = source / key
            if not src.is_file():
                missing += 1
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, target)
            copied += 1
        msg = f"restore_overlays: {copied} restored, {present} already present, {missing} not in {source}."
        self.stdout.write(self.style.WARNING(msg) if missing else msg)
