from django.core.management.base import BaseCommand

from floods.alerts import compute_alerts, thresholds


class Command(BaseCommand):
    help = "Apply the flood alert rules to the newest cycle (safe to run repeatedly)."

    def handle(self, *args, **options):
        t = thresholds()
        self.stdout.write(
            "Rules: orange >= {ORANGE_PCT:g}%, red >= {RED_PCT:g}% or +{RISE_PP:g} pp, "
            "coverage >= {MIN_COVERAGE_PCT:g}%, close < {CLOSE_PCT:g}%".format(**t)
        )
        result = compute_alerts()
        if result.cycle is None:
            self.stdout.write(self.style.WARNING("No cycles imported yet; nothing to do."))
            return
        self.stdout.write(self.style.SUCCESS(f"Alerts {result}"))
