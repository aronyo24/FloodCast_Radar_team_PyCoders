from django.core.management.base import BaseCommand, CommandError

from floods.importer import WebDataError, import_web_data


class Command(BaseCommand):
    help = "Import a processed web_data directory or .zip (idempotent, atomic)."

    def add_arguments(self, parser):
        parser.add_argument("path", help="Path to a web_data/ directory or a .zip of one.")
        parser.add_argument(
            "--compute-alerts", action="store_true",
            help="Recompute flood alerts after a successful import.",
        )

    def handle(self, *args, path, compute_alerts, **options):
        self.stdout.write(f"Importing {path} ...")
        try:
            result = import_web_data(path, log_fn=self.stdout.write)
        except WebDataError as exc:
            raise CommandError(f"Import failed, nothing was changed: {exc}") from None

        verdict = "Data changed." if result.changed else "Already up to date: nothing changed."
        self.stdout.write(self.style.SUCCESS(f"Import complete. {verdict} New images: {result.new_images}."))

        if compute_alerts:
            from floods.alerts import compute_alerts as run

            self.stdout.write(f"Alerts: {run()}")
        else:
            self.stdout.write("Run `manage.py compute_alerts` to refresh alerts.")
