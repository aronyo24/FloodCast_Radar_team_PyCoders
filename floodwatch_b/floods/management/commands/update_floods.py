from django.core.management.base import BaseCommand, CommandError

from floods.models import UpdateRun
from floods.updater import UpdateInProgress, run_update


class Command(BaseCommand):
    help = (
        "Check for new processed data, import it and compute alerts. "
        "Records an UpdateRun. Intended for cron: `0 6 * * * python manage.py update_floods`."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true",
            help="Re-import even if the bundle is unchanged since the last import.",
        )

    def handle(self, *args, force, **options):
        try:
            outcome = run_update(triggered_by="cli", force=force)
        except UpdateInProgress as exc:
            raise CommandError(str(exc)) from None

        run = outcome.run
        self.stdout.write(run.message)
        line = f"UpdateRun #{run.pk}: {run.status}, {run.new_images} new image(s), {outcome.duration_ms} ms"
        if run.status == UpdateRun.Status.FAILED:
            # Non-zero exit so cron / CI notice, but the site keeps the old data.
            raise CommandError(line)
        self.stdout.write(self.style.SUCCESS(line))
