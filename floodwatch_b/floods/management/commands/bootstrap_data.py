"""
First-deploy data load, run by the Heroku release phase (see Procfile).

If the database has no flood cycles yet, import the committed web_data bundle
and compute alerts. Once data exists it does nothing, so later deploys never
overwrite data imported through the admin panel. Use --force to re-import.
"""

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

from floods.models import NationalCycle


class Command(BaseCommand):
    help = "Import web_data into an empty database (safe to run on every deploy)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Import even if data already exists.")

    def handle(self, *args, force=False, **options):
        if NationalCycle.objects.exists() and not force:
            self.stdout.write("bootstrap_data: database already has flood data; skipping import.")
            return
        path = settings.FLOODWATCH["WEB_DATA_PATH"]
        self.stdout.write(f"bootstrap_data: importing {path} ...")
        call_command("import_web_data", path, "--compute-alerts")
