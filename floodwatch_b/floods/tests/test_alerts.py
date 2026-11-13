from datetime import date

from django.test import SimpleTestCase, TestCase

from floods.alerts import ORANGE, RED, classify, compute_alerts, replay
from floods.models import District, DistrictCycle, FloodAlert

T = {"ORANGE_PCT": 10.0, "RED_PCT": 25.0, "RISE_PP": 10.0, "MIN_COVERAGE_PCT": 50.0, "CLOSE_PCT": 5.0}


class ClassifyTests(SimpleTestCase):
    def test_orange(self):
        self.assertEqual(classify(10.0, 100, None, None, T), ORANGE)
        self.assertEqual(classify(24.9, 50, 20.0, None, T), ORANGE)

    def test_red_by_level(self):
        self.assertEqual(classify(25.0, 100, None, None, T), RED)

    def test_red_by_rise(self):
        self.assertEqual(classify(14.0, 100, 4.0, None, T), RED)  # +10 pp
        self.assertEqual(classify(13.9, 100, 4.0, None, T), ORANGE)  # +9.9 pp

    def test_below_threshold_no_alert(self):
        self.assertIsNone(classify(9.9, 100, None, None, T))

    def test_low_coverage_neither_opens_nor_closes(self):
        self.assertIsNone(classify(40.0, 49.9, None, None, T))
        self.assertEqual(classify(1.0, 30, 30.0, RED, T), RED)

    def test_open_alert_holds_until_close_threshold(self):
        self.assertEqual(classify(7.0, 100, 30.0, RED, T), ORANGE)  # de-escalates, stays open
        self.assertEqual(classify(5.0, 100, 7.0, ORANGE, T), ORANGE)
        self.assertIsNone(classify(4.9, 100, 5.0, ORANGE, T))  # closes


class ComputeAlertsTests(TestCase):
    def setUp(self):
        self.d = District.objects.create(slug="sirajganj", name_en="Sirajganj", area_km2=2500, geometry="{}")
        self.other = District.objects.create(slug="bogura", name_en="Bogura", area_km2=2900, geometry="{}")

    def cycle(self, day, district, pct, coverage=100.0):
        DistrictCycle.objects.update_or_create(
            cycle_start=date.fromisoformat(day), district=district,
            defaults=dict(observed_km2=district.area_km2 * coverage / 100, flood_km2_seen=pct * 10,
                          coverage_pct=coverage, flood_pct=pct, flood_km2_est=pct * 10, images=1),
        )

    def test_orange_alert_opened(self):
        self.cycle("2026-07-11", self.d, 12.0)
        result = compute_alerts()
        self.assertEqual(result.opened, 1)
        alert = FloodAlert.objects.get()
        self.assertEqual((alert.level, alert.flood_pct, alert.active), (ORANGE, 12.0, True))

    def test_red_alert_opened(self):
        self.cycle("2026-07-11", self.d, 26.0)
        compute_alerts()
        self.assertEqual(FloodAlert.objects.get().level, RED)

    def test_rise_escalates_to_red(self):
        self.cycle("2026-07-11", self.d, 11.0)
        compute_alerts()
        self.cycle("2026-07-23", self.d, 21.5)  # +10.5 pp, below 25%
        result = compute_alerts()
        self.assertEqual(result.updated, 1)
        alert = FloodAlert.objects.get(active=True)
        self.assertEqual((alert.level, alert.flood_pct, str(alert.cycle_start)), (RED, 21.5, "2026-07-23"))

    def test_rise_from_quiet_cycle_is_red(self):
        self.cycle("2026-07-11", self.d, 1.0)
        self.cycle("2026-07-23", self.d, 12.0)
        compute_alerts()
        self.assertEqual(FloodAlert.objects.get().level, RED)

    def test_rise_ignores_poorly_observed_previous_cycle(self):
        self.cycle("2026-07-11", self.d, 1.0, coverage=30.0)
        self.cycle("2026-07-23", self.d, 12.0)
        compute_alerts()
        self.assertEqual(FloodAlert.objects.get().level, ORANGE)

    def test_alert_closes_below_five_percent(self):
        self.cycle("2026-07-11", self.d, 30.0)
        compute_alerts()
        self.cycle("2026-07-23", self.d, 4.0)
        result = compute_alerts()
        self.assertEqual(result.closed, 1)
        alert = FloodAlert.objects.get()
        self.assertFalse(alert.active)
        self.assertIsNotNone(alert.closed_at)

    def test_alert_stays_open_between_five_and_ten(self):
        self.cycle("2026-07-11", self.d, 30.0)
        self.cycle("2026-07-23", self.d, 7.0)
        compute_alerts()
        alert = FloodAlert.objects.get(active=True)
        self.assertEqual((alert.level, alert.flood_pct), (ORANGE, 7.0))

    def test_low_coverage_cycle_keeps_alert(self):
        self.cycle("2026-07-11", self.d, 30.0)
        self.cycle("2026-07-23", self.d, 0.0, coverage=20.0)
        compute_alerts()
        alert = FloodAlert.objects.get(active=True)
        self.assertEqual((alert.level, alert.flood_pct, str(alert.cycle_start)), (RED, 30.0, "2026-07-11"))

    def test_no_duplicates_on_repeated_runs(self):
        self.cycle("2026-07-11", self.d, 30.0)
        self.cycle("2026-07-11", self.other, 12.0)
        compute_alerts()
        for _ in range(3):
            result = compute_alerts()
            self.assertEqual((result.opened, result.updated, result.closed, result.unchanged), (0, 0, 0, 2))
        self.assertEqual(FloodAlert.objects.count(), 2)
        self.assertEqual(FloodAlert.objects.filter(active=True).count(), 2)

    def test_reopened_after_close_is_a_new_alert(self):
        self.cycle("2026-07-11", self.d, 30.0)
        compute_alerts()
        self.cycle("2026-07-23", self.d, 2.0)
        compute_alerts()
        self.cycle("2026-08-04", self.d, 15.0)
        compute_alerts()
        self.assertEqual(FloodAlert.objects.count(), 2)
        self.assertEqual(FloodAlert.objects.filter(active=True).count(), 1)

    def test_replay_as_of_an_earlier_cycle(self):
        self.cycle("2026-07-11", self.d, 30.0)
        self.cycle("2026-07-23", self.d, 2.0)
        cycle, states = replay(until=date(2026, 7, 11))
        self.assertEqual(str(cycle), "2026-07-11")
        self.assertEqual(states[self.d.pk].level, RED)
        _, states = replay()
        self.assertNotIn(self.d.pk, states)

    def test_thresholds_are_configurable(self):
        self.cycle("2026-07-11", self.d, 12.0)
        with self.settings(FLOOD_ALERTS={**T, "ORANGE_PCT": 15.0}):
            compute_alerts()
        self.assertFalse(FloodAlert.objects.exists())
