import socket
from unittest import mock

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from floods.alerts import compute_alerts
from floods.models import FloodAlert, UpdateRun

from .base import BundleTestCase
from .factory import write_bundle

ENDPOINTS = [
    "/api/districts/",
    "/api/districts/?format=list",
    "/api/districts/sirajganj/timeline/",
    "/api/districts/60/timeline/",
    "/api/cycles/",
    "/api/cycles/2026-07-23/",
    "/api/cycles/latest/",
    "/api/national/",
    "/api/overlays/?cycle=2026-07-23",
    "/api/overlays/",
    "/api/alerts/",
    "/api/alerts/?cycle=2026-07-11",
    "/api/meta/",
]


class ApiTests(BundleTestCase):
    def setUp(self):
        super().setUp()
        self.import_bundle()
        compute_alerts()
        self.client = APIClient()

    def test_every_public_endpoint_returns_200_json(self):
        for url in ENDPOINTS:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200, response.content[:300])
                self.assertIn("json", response["Content-Type"])
                response.json()

    def test_districts_geojson(self):
        data = self.client.get("/api/districts/").json()
        self.assertEqual(data["type"], "FeatureCollection")
        self.assertEqual(len(data["features"]), 3)
        f = next(f for f in data["features"] if f["id"] == "sirajganj")
        self.assertEqual(f["geometry"]["type"], "Polygon")
        props = f["properties"]
        for key in ("id", "pk", "name_en", "name_bn", "area_km2", "centroid", "bbox",
                    "peak_cycle", "peak_flooded_pct", "baseline_cycle", "cycles_observed"):
            self.assertIn(key, props)
        self.assertEqual((props["pk"], props["peak_cycle"], props["peak_flooded_pct"]), (60, "2026-07-23", 30.0))

    def test_district_list_has_no_geometry(self):
        data = self.client.get("/api/districts/?format=list").json()
        self.assertEqual(len(data["districts"]), 3)
        self.assertNotIn("geometry", data["districts"][0])
        self.assertEqual(set(data["districts"][0]), {"id", "pk", "name_en", "name_bn", "source_name", "division", "area_km2"})

    def test_cycles_index(self):
        data = self.client.get("/api/cycles/").json()
        self.assertEqual([c["date"] for c in data["cycles"]], ["2026-07-11", "2026-07-23"])
        self.assertEqual(data["meta"]["latest_cycle"], "2026-07-23")
        national = data["cycles"][1]["national"]
        self.assertEqual(national["flooded_km2"], round(749.4 + 405.8 + 175.6, 1))
        self.assertEqual(national["districts_observed"], 3)
        self.assertEqual(national["worst"]["id"], "sirajganj")
        self.assertEqual(data["cycles"][1]["label"], "23 Jul")

    def test_cycle_detail(self):
        data = self.client.get("/api/cycles/2026-07-23/").json()
        for key in ("date", "cycle_start", "provisional", "national", "overlay", "overlays", "districts"):
            self.assertIn(key, data)
        self.assertTrue(data["provisional"])
        s = data["districts"]["sirajganj"]
        self.assertEqual((s["observed"], s["flooded_pct"], s["flood_km2_est"], s["coverage_pct"], s["last_image"]),
                         (True, 30.0, 749.4, 100.0, "2026-07-23"))
        self.assertTrue(data["overlay"]["flood"].endswith("/media/overlays/flood_2026-07-23.png"))
        self.assertTrue(data["overlay"]["water"].endswith("/media/overlays/water.png"))

    def test_partial_coverage_is_reported_not_hidden(self):
        s = self.client.get("/api/cycles/2026-07-11/").json()["districts"]["khulna"]
        self.assertEqual((s["observed"], s["coverage_pct"]), (True, 36.0))

    def test_unknown_cycle_404(self):
        for url in ("/api/cycles/2026-07-24/", "/api/cycles/not-a-date/", "/api/overlays/?cycle=1999-01-01",
                    "/api/alerts/?cycle=1999-01-01"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)
                self.assertIn("error", response.json())

    def test_unknown_district_404(self):
        for url in ("/api/districts/atlantis/timeline/", "/api/districts/9999/timeline/"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)
                self.assertIn("error", response.json())

    def test_timeline(self):
        data = self.client.get("/api/districts/Sirajganj/timeline/").json()
        self.assertEqual(data["district"]["id"], "sirajganj")
        self.assertEqual([p["flooded_pct"] for p in data["series"]], [12.0, 30.0])
        self.assertEqual(data["rank_latest"], 1)
        self.assertIn("alert_levels", data["meta"])

    def test_national(self):
        data = self.client.get("/api/national/").json()
        self.assertEqual(len(data["series"]), 2)
        self.assertEqual(data["peak"]["date"], "2026-07-23")
        for key in ("flooded_km2", "flooded_pct", "coverage_pct", "districts_observed", "worst_id", "flood_km2_est"):
            self.assertIn(key, data["series"][0])

    def test_overlays(self):
        data = self.client.get("/api/overlays/?cycle=2026-07-23").json()
        self.assertEqual(data["bounds"], [[21.8, 89.0], [25.1, 89.9]])
        kinds = sorted(o["kind"] for o in data["overlays"])
        self.assertEqual(kinds, ["flood", "water"])
        image = self.client.get(data["flood"])
        self.assertEqual(image.status_code, 200)
        self.assertEqual(b"".join(image.streaming_content)[:8], b"\x89PNG\r\n\x1a\n")

    def test_alerts(self):
        data = self.client.get("/api/alerts/").json()
        self.assertEqual(data["cycle"], "2026-07-23")
        self.assertEqual(data["levels"]["warning_pct"], 10.0)
        by_id = {a["district_id"]: a for a in data["alerts"]}
        # Sirajganj 30% -> red; Bogura 3% -> 14% is a +11 pp rise -> red;
        # Khulna 4% -> no alert.
        self.assertEqual(set(by_id), {"sirajganj", "bogura"})
        self.assertEqual(by_id["bogura"]["level"], "severe")
        self.assertEqual(by_id["bogura"]["level_code"], "red")
        self.assertEqual(by_id["bogura"]["change_pct"], 11.0)

    def test_alerts_follow_requested_cycle(self):
        data = self.client.get("/api/alerts/?cycle=2026-07-11").json()
        # Khulna is only 36% observed on 11 Jul, so it can't raise an alert.
        self.assertEqual([(a["district_id"], a["level"]) for a in data["alerts"]], [("sirajganj", "warning")])

    def test_meta(self):
        data = self.client.get("/api/meta/").json()
        for key in ("mission", "product", "provisional", "demo_data", "latest_cycle", "latest_image",
                    "last_checked", "alert_levels", "low_coverage_pct", "grid", "boundaries", "revisit",
                    "season", "country_area_km2"):
            self.assertIn(key, data)
        self.assertTrue(data["demo_data"])
        self.assertEqual(data["latest_cycle"], "2026-07-23")
        self.assertEqual(data["grid"]["leaflet_bounds"], [[21.8, 89.0], [25.1, 89.9]])
        self.assertIn("12 days", data["revisit"]["note"])

    def test_real_data_flag_comes_only_from_meta_json(self):
        write_bundle(self.bundle, meta={"demo_data": False, "product": "NISAR GCOV test"})
        self.import_bundle()
        data = self.client.get("/api/meta/").json()
        self.assertFalse(data["demo_data"])
        self.assertEqual(data["product"], "NISAR GCOV test")

    def test_csv_download(self):
        response = self.client.get("/api/cycles/2026-07-23/?format=csv")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("text/csv"))
        self.assertIn("floodcast-radar-2026-07-23.csv", response["Content-Disposition"])
        lines = response.content.decode("utf-8-sig").strip().splitlines()
        self.assertEqual(len(lines), 4)  # header + 3 districts
        self.assertTrue(lines[0].startswith("rank,district_id"))
        self.assertTrue(lines[1].startswith("1,sirajganj,60,Sirajganj"))
        self.assertIn("demo data", lines[1])

    def test_public_endpoints_are_read_only(self):
        for url in ("/api/districts/", "/api/cycles/", "/api/meta/", "/api/alerts/"):
            self.assertEqual(self.client.post(url).status_code, 405)

    def test_empty_database_still_answers(self):
        from floods.models import District, DistrictCycle, NationalCycle, Overlay

        for m in (DistrictCycle, NationalCycle, Overlay, FloodAlert, District):
            m.objects.all().delete()
        for url in ("/api/districts/", "/api/cycles/", "/api/national/", "/api/meta/", "/api/alerts/"):
            self.assertEqual(self.client.get(url).status_code, 200, url)
        self.assertEqual(self.client.get("/api/cycles/latest/").status_code, 404)


class UpdateEndpointTests(BundleTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.staff = User.objects.create_user("staff", password="pw-12345-long", is_staff=True)
        self.user = User.objects.create_user("user", password="pw-12345-long")

    def test_anonymous_is_rejected(self):
        response = self.client.post("/api/update/")
        self.assertIn(response.status_code, (401, 403))
        self.assertIn("error", response.json())
        self.assertFalse(UpdateRun.objects.exists())

    def test_non_staff_is_rejected(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post("/api/update/").status_code, 403)

    def test_get_not_allowed(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/update/").status_code, 405)

    def test_staff_update_imports_and_logs(self):
        token = Token.objects.create(user=self.staff)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        with self.settings(FLOODWATCH={**self._cfg(), "WEB_DATA_PATH": str(self.bundle)}):
            data = self.client.post("/api/update/").json()
            self.assertTrue(data["ok"])
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["new_images"], 2)
            self.assertEqual(data["new_cycles"], ["2026-07-11", "2026-07-23"])
            self.assertEqual(data["latest_cycle"], "2026-07-23")
            self.assertTrue(FloodAlert.objects.filter(active=True).exists())

            again = self.client.post("/api/update/").json()
            self.assertEqual((again["ok"], again["status"], again["new_images"]), (True, "no_change", 0))
            self.assertIn("12 days", again["message"])

        runs = list(UpdateRun.objects.order_by("started_at"))
        self.assertEqual([r.status for r in runs], ["success", "no_change"])
        self.assertTrue(all(r.finished_at for r in runs))
        self.assertEqual(runs[0].triggered_by, "api:staff")

    def test_failed_update_is_recorded_and_reported(self):
        self.client.force_authenticate(self.staff)
        with self.settings(FLOODWATCH={**self._cfg(), "WEB_DATA_PATH": str(self.tmp / "missing")}):
            response = self.client.post("/api/update/")
        self.assertEqual(response.status_code, 502)
        data = response.json()
        self.assertFalse(data["ok"])
        self.assertIn("still shows the previous data", data["error"])
        run = UpdateRun.objects.get()
        self.assertEqual(run.status, "failed")
        self.assertIn("No processed data found", run.message)

    def test_failed_pipeline_imports_nothing(self):
        self.client.force_authenticate(self.staff)
        cfg = {**self._cfg(), "WEB_DATA_PATH": str(self.bundle), "PIPELINE_COMMAND": "false"}
        with self.settings(FLOODWATCH=cfg):
            data = self.client.post("/api/update/").json()
        self.assertFalse(data["ok"])
        self.assertIn("Pipeline exited", data["message"])
        from floods.models import DistrictCycle

        self.assertFalse(DistrictCycle.objects.exists())

    def test_concurrent_run_rejected(self):
        self.client.force_authenticate(self.staff)
        UpdateRun.objects.create(status="running")
        self.assertEqual(self.client.post("/api/update/").status_code, 409)

    @staticmethod
    def _cfg():
        from django.conf import settings

        return dict(settings.FLOODWATCH)


class OfflineTests(BundleTestCase):
    """After an import, the API must not need the network at all."""

    def test_api_works_with_network_blocked(self):
        self.import_bundle()
        compute_alerts()

        real_connect = socket.socket.connect

        def guarded(sock, address):
            host = address[0] if isinstance(address, tuple) else address
            if host not in ("127.0.0.1", "::1", "localhost"):
                raise OSError(f"network access attempted: {address}")
            return real_connect(sock, address)

        client = APIClient()
        with mock.patch.object(socket.socket, "connect", guarded), \
                mock.patch("socket.create_connection", side_effect=OSError("network access attempted")):
            for url in ENDPOINTS + ["/api/cycles/2026-07-23/?format=csv"]:
                with self.subTest(url=url):
                    self.assertEqual(client.get(url).status_code, 200)

    @override_settings(DEBUG=False)
    def test_media_served_without_debug(self):
        self.import_bundle()
        response = APIClient().get("/media/overlays/water.png")
        self.assertEqual(response.status_code, 200)
