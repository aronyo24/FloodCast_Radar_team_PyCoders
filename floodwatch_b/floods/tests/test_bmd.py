from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from floods.models import FieldReport, Officer

from .base import BundleTestCase

PASSWORD = "Monsoon-Gauge-2026"


def officer_body(**over):
    body = {
        "full_name": "Rahima Khatun",
        "email": "Rahima@bmd.gov.bd",
        "password": PASSWORD,
        "designation": "Meteorologist",
        "employee_id": "BMD-1042",
        "phone": "01712345678",
        "office_name": "Sirajganj Met Station",
        "district": "sirajganj",
    }
    body.update(over)
    return body


REPORT = {
    "level": "danger",
    "water_trend": "rising",
    "rainfall_24h_mm": "112.5",
    "river_station": "Jamuna @ Sirajganj",
    "water_level_m": 13.6,
    "danger_level_m": 13.35,
    "affected_people": "42000",
    "shelters_open": 18,
    "conditions": "Jamuna is 25 cm above danger level; char villages in Kazipur are inundated.",
    "actions_taken": "Issued danger bulletin to DC office, coordinated with BWDB and Upazila DMCs.",
    "needs": "Two more speedboats for Kazipur chars.",
}


class BmdPortalTests(BundleTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()  # throttle counters
        self.import_bundle()
        self.client = APIClient(enforce_csrf_checks=True)

    def csrf(self):
        self.client.get("/api/bmd/csrf/")
        return {"HTTP_X_CSRFTOKEN": self.client.cookies["csrftoken"].value}

    def register(self, **over):
        return self.client.post("/api/bmd/register/", officer_body(**over), format="json", **self.csrf())

    def test_register_signs_in_and_hides_private_fields_publicly(self):
        res = self.register()
        self.assertEqual(res.status_code, 201, res.content)
        me = self.client.get("/api/bmd/me/").json()
        self.assertTrue(me["authenticated"])
        self.assertEqual(me["officer"]["email"], "rahima@bmd.gov.bd")
        self.assertEqual(me["officer"]["status"], "pending")
        self.assertEqual(me["officer"]["station"]["id"], "sirajganj")

        res = self.client.post("/api/bmd/reports/", REPORT, format="json", **self.csrf())
        self.assertEqual(res.status_code, 201, res.content)
        anon = APIClient().get("/api/bmd/reports/").json()
        self.assertEqual(anon["count"], 1)
        officer = anon["reports"][0]["officer"]
        self.assertFalse(officer["verified"])
        for private in ("email", "phone", "employee_id"):
            self.assertNotIn(private, officer)

    def test_register_validation(self):
        User = Officer._meta.get_field("user").related_model
        res = self.register(email="bad", phone="12", district="atlantis", password="123")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.json()["fields"]), {"email", "phone", "district"})
        self.assertFalse(User.objects.exists())
        self.assertEqual(self.register(password="password").status_code, 400)

    def test_duplicate_email_and_employee_id(self):
        self.assertEqual(self.register().status_code, 201)
        self.client.post("/api/bmd/logout/", **self.csrf())
        res = self.register(employee_id="BMD-9")
        self.assertIn("email", res.json()["fields"])
        res = self.register(email="other@bmd.gov.bd", employee_id="bmd-1042")
        self.assertIn("employee_id", res.json()["fields"])

    def test_login_logout(self):
        self.register()
        self.client.post("/api/bmd/logout/", **self.csrf())
        self.assertFalse(self.client.get("/api/bmd/me/").json()["authenticated"])
        bad = self.client.post("/api/bmd/login/", {"email": "rahima@bmd.gov.bd", "password": "nope"},
                               format="json", **self.csrf())
        self.assertEqual(bad.status_code, 401)
        ok = self.client.post("/api/bmd/login/", {"email": "RAHIMA@bmd.gov.bd", "password": PASSWORD},
                              format="json", **self.csrf())
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(self.client.get("/api/bmd/me/").json()["authenticated"])

    def test_report_requires_login_and_csrf(self):
        self.assertEqual(self.client.post("/api/bmd/reports/", REPORT, format="json", **self.csrf()).status_code, 403)
        self.register()
        # Signed in but no CSRF header: rejected.
        self.assertEqual(self.client.post("/api/bmd/reports/", REPORT, format="json").status_code, 403)

    def test_report_validation_and_district_is_station(self):
        self.register()
        res = self.client.post("/api/bmd/reports/", {"level": "panic", "conditions": "x"}, format="json", **self.csrf())
        self.assertEqual(res.status_code, 400)
        self.assertTrue({"level", "conditions", "actions_taken"} <= set(res.json()["fields"]))
        res = self.client.post("/api/bmd/reports/", {**REPORT, "district": "dhaka"}, format="json", **self.csrf())
        self.assertEqual(res.json()["district"]["id"], "sirajganj")
        future = self.client.post("/api/bmd/reports/", {**REPORT, "observed_at": "2099-01-01T00:00:00Z"},
                                  format="json", **self.csrf())
        self.assertIn("observed_at", future.json()["fields"])

    def test_only_owner_can_edit_or_delete(self):
        self.register()
        rid = self.client.post("/api/bmd/reports/", REPORT, format="json", **self.csrf()).json()["id"]
        self.client.post("/api/bmd/logout/", **self.csrf())
        self.register(email="b@bmd.gov.bd", employee_id="BMD-2", district="bogura", office_name="Bogura Met Station")
        self.assertEqual(self.client.delete(f"/api/bmd/reports/{rid}/", **self.csrf()).status_code, 403)
        self.client.post("/api/bmd/logout/", **self.csrf())
        self.client.post("/api/bmd/login/", {"email": "rahima@bmd.gov.bd", "password": PASSWORD},
                         format="json", **self.csrf())
        res = self.client.patch(f"/api/bmd/reports/{rid}/", {"level": "warning"}, format="json", **self.csrf())
        self.assertEqual(res.json()["level"], "warning")
        self.assertEqual(self.client.delete(f"/api/bmd/reports/{rid}/", **self.csrf()).status_code, 204)
        self.assertFalse(FieldReport.objects.exists())

    def test_suspended_officer_is_locked_out(self):
        self.register()
        Officer.objects.update(status=Officer.Status.SUSPENDED)
        self.assertEqual(self.client.post("/api/bmd/reports/", REPORT, format="json", **self.csrf()).status_code, 403)
        self.client.post("/api/bmd/logout/", **self.csrf())
        res = self.client.post("/api/bmd/login/", {"email": "rahima@bmd.gov.bd", "password": PASSWORD},
                               format="json", **self.csrf())
        self.assertEqual(res.status_code, 403)

    @override_settings(BMD_REQUIRE_VERIFICATION=True)
    def test_verification_gate(self):
        self.register()
        self.assertEqual(self.client.post("/api/bmd/reports/", REPORT, format="json", **self.csrf()).status_code, 403)
        Officer.objects.update(status=Officer.Status.VERIFIED)
        self.assertEqual(self.client.post("/api/bmd/reports/", REPORT, format="json", **self.csrf()).status_code, 201)

    def test_summary_and_filters_and_hidden(self):
        self.register()
        self.client.post("/api/bmd/reports/", {**REPORT, "level": "warning"}, format="json", **self.csrf())
        self.client.post("/api/bmd/reports/", REPORT, format="json", **self.csrf())
        summary = APIClient().get("/api/bmd/summary/").json()
        self.assertEqual(summary["reports_24h"], 2)
        self.assertEqual(summary["districts_reporting_7d"], 1)
        self.assertEqual(summary["board"][0]["level"], "danger")  # the newest report wins
        self.assertEqual(summary["danger_or_worse"], 1)

        anon = APIClient()
        self.assertEqual(anon.get("/api/bmd/reports/?level=warning").json()["count"], 1)
        self.assertEqual(anon.get("/api/bmd/reports/?district=khulna").json()["count"], 0)
        self.assertEqual(anon.get("/api/bmd/reports/?district=atlantis").status_code, 404)
        FieldReport.objects.update(hidden=True)
        self.assertEqual(anon.get("/api/bmd/reports/").json()["count"], 0)
        self.assertEqual(self.client.get("/api/bmd/reports/?mine=1").json()["count"], 2)
