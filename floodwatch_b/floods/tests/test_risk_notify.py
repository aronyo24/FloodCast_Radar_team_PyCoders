from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from floods.models import Notification, Subscriber
from floods.notify import send_notifications
from floods.risk import WEIGHTS, district_risk, level_for
from floods.serializers import Season

from .base import BundleTestCase

EMAIL = "django.core.mail.backends.locmem.EmailBackend"


class RiskTests(BundleTestCase):
    def setUp(self):
        super().setUp()
        self.import_bundle()
        self.client = APIClient()

    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(WEIGHTS.values()), 1.0)

    def test_levels(self):
        self.assertEqual(level_for(10), "low")
        self.assertEqual(level_for(30), "moderate")
        self.assertEqual(level_for(50), "high")
        self.assertEqual(level_for(80), "severe")

    def test_endpoint_shape(self):
        data = self.client.get("/api/districts/sirajganj/risk/").json()
        self.assertEqual(data["district"]["id"], "sirajganj")
        self.assertTrue(2 <= data["probability"] <= 98)
        self.assertIn(data["level"], ["low", "moderate", "high", "severe"])
        self.assertEqual(len(data["factors"]), len(WEIGHTS))
        self.assertAlmostEqual(sum(f["contribution"] for f in data["factors"]), data["probability"], delta=1.5)

    def test_past_cycle_never_uses_future_data(self):
        season = Season()
        first = season.dates[0]
        risk = district_risk(season, season.find_district("sirajganj"), first)
        self.assertLessEqual(risk["observed_cycles"], 1)
        self.assertEqual(risk["cycle"], first.isoformat())

    def test_unknown_district_and_cycle(self):
        self.assertEqual(self.client.get("/api/districts/nowhere/risk/").status_code, 404)
        self.assertEqual(self.client.get("/api/districts/sirajganj/risk/?cycle=1999-01-01").status_code, 404)

    def test_all_districts(self):
        data = self.client.get("/api/risk/").json()
        probs = [d["probability"] for d in data["districts"]]
        self.assertEqual(probs, sorted(probs, reverse=True))


@override_settings(EMAIL_BACKEND=EMAIL, FLOODWATCH_SITE_URL="https://fw.example")
class SubscriptionTests(BundleTestCase):
    def setUp(self):
        super().setUp()
        self.import_bundle()
        self.client = APIClient()
        cache.clear()

    def subscribe(self, **over):
        body = {"name": "Rina", "email": "Rina@Example.com", "district": "sirajganj", "min_level": "moderate", **over}
        return self.client.post("/api/subscriptions/", body, format="json")

    def test_subscribe_sends_welcome(self):
        r = self.subscribe()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.json()["email_sent"])
        sub = Subscriber.objects.get()
        self.assertEqual(sub.email, "rina@example.com")
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertIn("Sirajganj", msg.subject)
        self.assertIn(f"https://fw.example/api/subscriptions/unsubscribe/{sub.token}/", msg.body)
        self.assertEqual(msg.alternatives[0][1], "text/html")

    def test_resubscribe_updates_instead_of_duplicating(self):
        self.subscribe()
        r = self.subscribe(min_level="severe", name="Rina B")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Subscriber.objects.count(), 1)
        self.assertEqual(Subscriber.objects.get().min_level, "severe")

    def test_validation(self):
        for field, value in [("email", "nope"), ("name", ""), ("district", "atlantis"), ("min_level", "x")]:
            with self.subTest(field=field):
                r = self.subscribe(**{field: value})
                self.assertEqual(r.status_code, 400)
                self.assertIn(field, r.json()["fields"])
        self.assertEqual(Subscriber.objects.count(), 0)

    def test_unsubscribe(self):
        self.subscribe()
        sub = Subscriber.objects.get()
        r = self.client.get(f"/api/subscriptions/unsubscribe/{sub.token}/")
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "unsubscribed")
        sub.refresh_from_db()
        self.assertFalse(sub.active)
        self.assertEqual(self.client.get("/api/subscriptions/unsubscribe/bogus/").status_code, 404)

    def test_notifications_are_sent_once_per_cycle(self):
        self.subscribe(min_level="moderate")
        sub = Subscriber.objects.get()
        risk = district_risk(Season(), sub.district)
        mail.outbox.clear()

        first = send_notifications()
        expected = 1 if risk["level"] != "low" else 0
        self.assertEqual(first.alerts, expected)
        self.assertEqual(len(mail.outbox), expected)

        second = send_notifications()
        self.assertEqual(second.alerts, 0)
        self.assertEqual(len(mail.outbox), expected)

    def test_threshold_respected(self):
        self.subscribe()
        sub = Subscriber.objects.get()
        sub.min_level = "severe"
        sub.save()
        risk = district_risk(Season(), sub.district)
        mail.outbox.clear()
        result = send_notifications()
        self.assertEqual(result.alerts, 1 if risk["level"] == "severe" else 0)
        self.assertEqual(Notification.objects.filter(kind="alert").count(), result.alerts)
