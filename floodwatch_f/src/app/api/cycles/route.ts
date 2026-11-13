import { getDataset, json } from "@/lib/dataset";

/**
 * GET /api/cycles/ - the slider's index (F2).
 *
 * Returns every 12-day cycle with its national summary but without the
 * per-district breakdown, which is what `/api/cycles/<date>/` is for.
 */
export async function GET() {
  const data = await getDataset();
  return json({
    meta: {
      latest_cycle: data.meta.latest_cycle,
      cycle_length_days: data.meta.cycle_length_days,
      season: data.meta.season,
      alert_levels: data.meta.alert_levels,
      low_coverage_pct: data.meta.low_coverage_pct,
    },
    cycles: data.cycles,
  });
}
