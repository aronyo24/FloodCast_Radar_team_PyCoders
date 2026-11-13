"""The admin dashboard and the upload -> check -> import flow."""

import re

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from floods.importer import fingerprint
from floods.models import DataSource, DistrictCycle, FloodAlert, UpdateRun

from .base import BundleTestCase
from .factory import CYCLE_ROWS, zip_dir


class AdminImportTests(BundleTestCase):
    def setUp(self):
        super().setUp()
        self.web_data = self.tmp / "live_web_data"
        cfg_override = override_settings(FLOODWATCH={**self._cfg(), "WEB_DATA_PATH": str(self.web_data), "WEB_DATA_URL": ""},
                                         BASE_DIR=self.tmp)
        cfg_override.enable()
        self.addCleanup(cfg_override.disable)
        self.admin = get_user_model().objects.create_superuser("boss", "boss@example.org", "pw")
        self.client.force_login(self.admin)

    @staticmethod
    def _cfg():
        from django.conf import settings

        return dict(settings.FLOODWATCH)

    def upload(self, *files, alerts=True):
        data = {"files": list(files)}
        if alerts:
            data["compute_alerts"] = "1"
        return self.client.post(reverse("admin:floods_import"), data)

    def zip_upload(self):
        archive = zip_dir(self.bundle, self.tmp / "bundle.zip")
        return SimpleUploadedFile("web_data.zip", archive.read_bytes(), content_type="application/zip")

    def token_of(self, response):
        self.assertEqual(response.status_code, 302, getattr(response, "content", b"")[:500])
        match = re.search(r"/data/import/([0-9a-f]{32})/", response["Location"])
        self.assertIsNotNone(match, response["Location"])
        return match.group(1)

    def test_dashboard_renders_empty_and_with_data(self):
        r = self.client.get(reverse("admin:index"))
        self.assertContains(r, "No flood data yet")
        self.import_bundle()
        r = self.client.get(reverse("admin:index"))
        self.assertContains(r, "Latest cycle")
        self.assertContains(r, "23 Jul 2026")
        self.assertContains(r, "Import data")

    def test_import_page_and_templates(self):
        r = self.client.get(reverse("admin:floods_import"))
        self.assertContains(r, "district_cycles.csv")
        r = self.client.get(reverse("admin:floods_template", args=["district_cycles.csv"]))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b"cycle_start,district,"))
        self.assertEqual(self.client.get(reverse("admin:floods_template", args=["nope.csv"])).status_code, 404)

    def test_zip_check_changes_nothing_then_import_applies_and_saves(self):
        token = self.token_of(self.upload(self.zip_upload()))
        # The check ran but rolled back.
        self.assertEqual(DistrictCycle.objects.count(), 0)
        self.assertEqual(FloodAlert.objects.count(), 0)
        self.assertFalse((self.media / "overlays").exists())
        review = self.client.get(reverse("admin:floods_import_review", args=[token]))
        self.assertContains(review, "Ready to import")
        self.assertContains(review, "2026-07-23")

        r = self.client.post(reverse("admin:floods_import_review", args=[token]), {"action": "import"})
        self.assertRedirects(r, reverse("admin:index"))
        self.assertEqual(DistrictCycle.objects.count(), 6)
        self.assertTrue(FloodAlert.objects.filter(active=True).exists())
        run = UpdateRun.objects.get()
        self.assertEqual((run.status, run.triggered_by, run.new_images), ("success", "admin:boss", 2))
        # Saved as the live bundle, so the daily update sees "no change".
        self.assertEqual(fingerprint(self.web_data), DataSource.current().fingerprint)
        # The token is single-use.
        r = self.client.get(reverse("admin:floods_import_review", args=[token]))
        self.assertRedirects(r, reverse("admin:floods_import"))

    def test_loose_csv_is_merged_with_current_bundle(self):
        self.client.post(reverse("admin:floods_import_review", args=[self.token_of(self.upload(self.zip_upload()))]),
                         {"action": "import"})
        rows = dict(CYCLE_ROWS)
        rows["2026-08-04"] = {"Sirajganj": (2497.9, 999.2, 100.0, 40.0, 999.2)}
        csv_lines = ["cycle_start,district,observed_km2,flood_km2_seen,coverage_pct,flood_pct,flood_km2_est,images,last_image"]
        for cycle, by_name in rows.items():
            for name, (obs, seen, cov, pct, est) in by_name.items():
                csv_lines.append(f"{cycle},{name},{obs},{seen},{cov},{pct},{est},2,{cycle}")
        upload = SimpleUploadedFile("district_cycles.csv", "\n".join(csv_lines).encode())

        token = self.token_of(self.upload(upload))
        review = self.client.get(reverse("admin:floods_import_review", args=[token]))
        self.assertContains(review, "1 new cycle(s): 2026-08-04")
        self.assertContains(review, "kept from current data")
        self.client.post(reverse("admin:floods_import_review", args=[token]), {"action": "import"})
        self.assertTrue(DistrictCycle.objects.filter(cycle_start="2026-08-04").exists())
        self.assertTrue(any((self.tmp / "web_data_backups").iterdir()))

    def test_bad_row_is_reported_and_nothing_changes(self):
        self.client.post(reverse("admin:floods_import_review", args=[self.token_of(self.upload(self.zip_upload()))]),
                         {"action": "import"})
        bad = SimpleUploadedFile(
            "district_cycles.csv",
            b"cycle_start,district,observed_km2,flood_km2_seen,coverage_pct,flood_pct,flood_km2_est,images,last_image\n"
            b"2026-08-04,sirajganj,10,1,100,150,1,1,2026-08-04\n",
        )
        token = self.token_of(self.upload(bad))
        review = self.client.get(reverse("admin:floods_import_review", args=[token]))
        self.assertContains(review, "cannot be imported")
        self.assertContains(review, "line 2: column &#x27;flood_pct&#x27;")
        self.assertNotContains(review, 'value="import"')

    def test_unknown_file_and_missing_required_are_rejected(self):
        r = self.upload(SimpleUploadedFile("notes.txt", b"hi"))
        self.assertRedirects(r, reverse("admin:floods_import"), fetch_redirect_response=False)
        self.assertContains(self.client.get(r["Location"]), "is not a web_data file")
        # No current bundle to merge with, so the geojson must be supplied.
        r = self.upload(SimpleUploadedFile("national_cycles.csv", b"cycle_start,flood_km2_est,districts_seen,area_seen_km2\n"))
        self.assertContains(self.client.get(r["Location"]), "Missing required file(s): districts.geojson")

    def test_cancel_discards(self):
        token = self.token_of(self.upload(self.zip_upload()))
        self.client.post(reverse("admin:floods_import_review", args=[token]), {"action": "cancel"})
        self.assertEqual(DistrictCycle.objects.count(), 0)
        self.assertRedirects(self.client.get(reverse("admin:floods_import_review", args=[token])),
                             reverse("admin:floods_import"))

    def test_recompute_alerts_and_download(self):
        self.import_bundle()
        r = self.client.post(reverse("admin:floods_recompute_alerts"))
        self.assertRedirects(r, reverse("admin:index"))
        self.assertTrue(FloodAlert.objects.exists())
        self.assertEqual(self.client.get(reverse("admin:floods_download")).status_code, 404)  # no live bundle yet

    def test_staff_without_permission_cannot_import(self):
        staff = get_user_model().objects.create_user("viewer", password="pw", is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get(reverse("admin:floods_import")).status_code, 403)
        self.assertEqual(self.client.post(reverse("admin:floods_check_now")).status_code, 403)
        self.client.logout()
        r = self.client.get(reverse("admin:floods_import"))
        self.assertEqual(r.status_code, 302)  # to the login page

    def test_real_data_checkbox_marks_bundle_as_real(self):
        upload = self.zip_upload()
        r = self.client.post(reverse("admin:floods_import"), {"files": [upload], "compute_alerts": "1", "real_data": "1"})
        token = self.token_of(r)
        self.client.post(reverse("admin:floods_import_review", args=[token]), {"action": "import"})
        self.assertIs(DataSource.current().meta["demo_data"], False)
        self.assertIs(self.client.get("/api/meta/").json()["demo_data"], False)
        # Remembered: the box is pre-ticked next time.
        self.assertContains(self.client.get(reverse("admin:floods_import")), 'name="real_data" value="1" checked')
