from django.core.management.base import BaseCommand

from floods.models import Subscriber
from floods.notify import send, send_notifications
from floods.risk import district_risk
from floods.serializers import Season


class Command(BaseCommand):
    help = "E-mail subscribers whose district reached their chosen flood-risk level (safe to repeat)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true",
                            help="Resend this cycle's alerts even to people already told.")
        parser.add_argument("--test", metavar="EMAIL",
                            help="Send a test e-mail to every subscription of this address and stop.")

    def handle(self, *args, force=False, test=None, **options):
        if test:
            season = Season()
            subs = Subscriber.objects.filter(email=test.lower()).select_related("district")
            if not subs:
                self.stdout.write(self.style.WARNING(f"No subscription for {test}."))
                return
            for sub in subs:
                note = send(sub, district_risk(season, sub.district), "test")
                self.stdout.write(f"{'sent' if note.ok else 'FAILED'}: {note.subject} {note.error}")
            return
        result = send_notifications(force=force)
        if result.cycle is None:
            self.stdout.write(self.style.WARNING("No cycles imported yet; nothing to send."))
            return
        self.stdout.write(self.style.SUCCESS(f"Notifications {result}"))
