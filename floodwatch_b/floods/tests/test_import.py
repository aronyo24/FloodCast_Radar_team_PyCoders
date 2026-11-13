import csv
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError

from floods.importer import WebDataError
from floods.models import (
    DataSource,
    District,
    DistrictCycle,
    DistrictObservation,
    Frame,
    NationalCycle,
    Overlay,
    Scene,
)

from .base import BundleTestCase
from .factory import zip_dir, zip_with_member


def model_counts():
    return {m.__name__: m.objects.count() for m in
            (District, Frame, Scene, DistrictObservation, DistrictCycle, NationalCycle, Overlay)}


class ImportTests(BundleTestCase):
    def test_import_creates_expected_records(self):
        result = self.import_bundle()
        self.assertEqual(model_counts(), {
            "District": 3, "Frame": 1, "Scene": 2, "DistrictObservation": 6,
            "DistrictCycle": 6, "NationalCycle": 2, "Overlay": 3,
        })
        self.assertEqual(result.new_images, 2)

        sirajganj = District.objects.get(slug="sirajganj")
        self.assertEqual(sirajganj.pk, 60)  # integer id from the GeoJSON kept
        self.assertEqual(sirajganj.name_bn, "সিরাজগঞ্জ")
        self.assertAlmostEqual(sirajganj.centroid_lon, 89.6, places=4)
        self.assertEqual(sirajganj.bbox, [89.3, 24.1, 89.9, 24.7])

        row = DistrictCycle.objects.get(district=sirajganj, cycle_start="2026-07-23")
        self.assertEqual((row.flood_pct, row.coverage_pct, row.flood_km2_est), (30.0, 100.0, 749.4))
        self.assertEqual(str(row.last_image), "2026-07-23")

        frame = Frame.objects.get(key="T045A_F071")
        self.assertEqual((frame.epsg, frame.water_cutoff_db, frame.cutoff_source), (32646, -18.5, "otsu"))

        overlay = Overlay.objects.get(key="overlays/flood_2026-07-23.png")
        self.assertEqual(overlay.image.name, "overlays/flood_2026-07-23.png")
        self.assertTrue((self.media / overlay.image.name).is_file())
        self.assertEqual((overlay.width, overlay.height), (8, 12))
        self.assertEqual(overlay.leaflet_bounds, [[21.8, 89.0], [25.1, 89.9]])

        self.assertTrue(DataSource.current().meta["demo_data"])

    def test_import_twice_creates_no_duplicates(self):
        self.import_bundle()
        before = model_counts()
        second = self.import_bundle()
        self.assertEqual(model_counts(), before)
        self.assertFalse(second.changed)
        self.assertEqual(second.new_images, 0)
        for name, count in second.counts.items():
            self.assertEqual(count.unchanged, count.total, name)

    def test_changed_values_update_in_place(self):
        self.import_bundle()
        path = self.bundle / "district_cycles.csv"
        text = path.read_text().replace("2026-07-23,Sirajganj,2497.9,749.4,100.0,30.0", "2026-07-23,Sirajganj,2497.9,749.4,100.0,31.5")
        path.write_text(text)
        result = self.import_bundle()
        self.assertEqual(result.counts["DistrictCycle"].updated, 1)
        self.assertEqual(DistrictCycle.objects.count(), 6)
        self.assertEqual(DistrictCycle.objects.get(district__slug="sirajganj", cycle_start="2026-07-23").flood_pct, 31.5)

    def test_zip_import_matches_directory_import(self):
        archive = zip_dir(self.bundle, self.tmp / "web_data.zip")
        self.import_bundle(archive)
        self.assertEqual(model_counts()["DistrictCycle"], 6)
        # ...and re-importing the directory afterwards changes nothing.
        self.assertFalse(self.import_bundle().changed)

    def test_optional_files_may_be_missing(self):
        for name in ("national_cycles.csv", "checkframes.csv", "district_observations.csv", "overlays.json", "meta.json"):
            (self.bundle / name).unlink()
        result = self.import_bundle()
        self.assertEqual(model_counts()["DistrictCycle"], 6)
        self.assertEqual(len(result.skipped_files), 5)

    def test_missing_required_file(self):
        (self.bundle / "district_cycles.csv").unlink()
        with self.assertRaisesMessage(WebDataError, "district_cycles.csv"):
            self.import_bundle()

    def test_missing_column_is_reported_and_nothing_is_written(self):
        path = self.bundle / "district_cycles.csv"
        rows = list(csv.reader(StringIO(path.read_text())))
        rows = [r[:-1] for r in rows]  # drop last_image
        out = StringIO()
        csv.writer(out).writerows(rows)
        path.write_text(out.getvalue())
        with self.assertRaisesMessage(WebDataError, "missing required column(s): last_image"):
            self.import_bundle()
        self.assertEqual(District.objects.count(), 0)  # whole import rolled back

    def test_bad_value_names_file_line_and_column(self):
        path = self.bundle / "district_cycles.csv"
        path.write_text(path.read_text().replace("2026-07-11,Bogura,2898.3,86.9,100.0,3.0", "2026-07-11,Bogura,2898.3,86.9,100.0,lots"))
        with self.assertRaises(WebDataError) as ctx:
            self.import_bundle()
        self.assertIn("district_cycles.csv line 3", str(ctx.exception))
        self.assertIn("flood_pct", str(ctx.exception))

    def test_percent_out_of_range_rejected(self):
        path = self.bundle / "district_cycles.csv"
        path.write_text(path.read_text().replace(",100.0,30.0,", ",100.0,130.0,"))
        with self.assertRaisesMessage(WebDataError, "<= 100"):
            self.import_bundle()

    def test_unknown_district_rejected(self):
        path = self.bundle / "district_cycles.csv"
        path.write_text(path.read_text() + "2026-07-23,Atlantis,1,1,100,1,1,1,2026-07-23\n")
        with self.assertRaisesMessage(WebDataError, "unknown district 'Atlantis'"):
            self.import_bundle()

    def test_zip_path_traversal_rejected(self):
        for bad in ("../evil.txt", "/etc/evil", "web_data/../../evil"):
            archive = zip_with_member(self.tmp / "bad.zip", bad)
            with self.assertRaisesMessage(WebDataError, "unsafe path"):
                self.import_bundle(archive)
        self.assertFalse((self.tmp.parent / "evil.txt").exists())

    def test_overlay_must_be_a_png(self):
        (self.bundle / "overlays" / "flood_2026-07-23.png").write_bytes(b"GIF89a not a png")
        with self.assertRaisesMessage(WebDataError, "not a readable PNG"):
            self.import_bundle()

    def test_overlay_cannot_escape_bundle(self):
        path = self.bundle / "overlays.json"
        path.write_text(path.read_text().replace("overlays/water.png", "../outside.png"))
        with self.assertRaisesMessage(WebDataError, "outside the web_data folder"):
            self.import_bundle()

    def test_management_command(self):
        out = StringIO()
        call_command("import_web_data", str(self.bundle), "--compute-alerts", stdout=out)
        text = out.getvalue()
        self.assertIn("DistrictCycle", text)
        self.assertIn("6 new", text)
        self.assertIn("Alerts:", text)

    def test_management_command_error(self):
        with self.assertRaisesMessage(CommandError, "nothing was changed"):
            call_command("import_web_data", str(self.tmp / "nope"), stdout=StringIO())


class NotebookFormatTests(BundleTestCase):
    """The Colab notebook's own file, column and property names."""

    def test_notebook_names_are_accepted(self):
        import json

        root = self.bundle
        geo = json.loads((root / "districts.geojson").read_text(encoding="utf-8"))
        for f in geo["features"]:
            p = f["properties"]
            f["properties"] = {"district": "Bogra" if p["name_en"] == "Bogura" else p["name_en"],
                               "district_id": p["id"], "area_km2": p["area_km2"]}
        (root / "districts.geojson").write_text(json.dumps(geo), encoding="utf-8")
        (root / "checkframes.csv").rename(root / "frames.csv")
        frames = (root / "frames.csv").read_text(encoding="utf-8")
        (root / "frames.csv").write_text(frames.replace("key,", "frame,", 1), encoding="utf-8")
        obs = (root / "district_observations.csv").read_text(encoding="utf-8")
        (root / "district_observations.csv").write_text(obs.replace("scene,", "image,", 1), encoding="utf-8")
        overlays = json.loads((root / "overlays.json").read_text(encoding="utf-8"))
        overlays = overlays.get("overlays", overlays) if isinstance(overlays, dict) else overlays
        (root / "overlays.json").write_text(json.dumps(overlays + overlays[:1]), encoding="utf-8")
        (root / "meta.json").write_text(json.dumps({"generated_utc": "2026-11-10T16:05:05+00:00",
                                                    "data": "NISAR L2 GCOV", "boundaries": "geoBoundaries"}))

        result = self.import_bundle()

        bogura = District.objects.get(slug="bogura")  # official spelling + slug from the reference
        self.assertEqual((bogura.pk, bogura.name_en, bogura.source_name, bogura.division), (61, "Bogura", "Bogra", "Rajshahi"))
        self.assertEqual(District.objects.get(pk=60).name_bn, "সিরাজগঞ্জ")
        self.assertEqual(Frame.objects.count(), 1)
        self.assertEqual(Scene.objects.count(), 2)
        self.assertEqual(Overlay.objects.count(), 3)
        self.assertTrue(any("listed twice" in w for w in result.warnings))
        meta = DataSource.current().meta
        self.assertEqual((meta["product"], meta["boundaries"]), ("NISAR L2 GCOV", {"name": "geoBoundaries"}))

    def test_missing_name_error_lists_found_properties(self):
        import json

        geo = json.loads((self.bundle / "districts.geojson").read_text(encoding="utf-8"))
        geo["features"][0]["properties"] = {"area_km2": 1.0, "code": "X"}
        (self.bundle / "districts.geojson").write_text(json.dumps(geo), encoding="utf-8")
        with self.assertRaisesMessage(WebDataError, "Found properties: area_km2, code"):
            self.import_bundle()
