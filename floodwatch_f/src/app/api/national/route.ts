import { getDataset, json } from "@/lib/dataset";
import type { NationalSeries } from "@/types/floodwatch";

/** GET /api/national/ - the national timeline and the season peak (F3, F4). */
export async function GET() {
  const data = await getDataset();

  const series = data.cycles.map((c) => ({
    date: c.date,
    label: c.label,
    index: c.index,
    flooded_km2: c.national.flooded_km2,
    flooded_pct: c.national.flooded_pct,
    coverage_pct: c.national.coverage_pct,
    districts_observed: c.national.districts_observed,
    worst_id: c.national.worst?.id ?? null,
    worst_name_en: c.national.worst?.name_en ?? null,
  }));

  const peakCycle = data.cycles.reduce<(typeof data.cycles)[number] | null>(
    (best, c) =>
      best === null || c.national.flooded_km2 > best.national.flooded_km2 ? c : best,
    null,
  );

  const payload: NationalSeries = {
    meta: {
      latest_cycle: data.meta.latest_cycle,
      country_area_km2: data.meta.country_area_km2,
      cycle_length_days: data.meta.cycle_length_days,
    },
    series,
    peak: peakCycle
      ? { date: peakCycle.date, flooded_km2: peakCycle.national.flooded_km2 }
      : null,
  };
  return json(payload);
}
