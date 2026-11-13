import type { NextRequest } from "next/server";

import { getDataset, json, notFound, rankDistricts, resolveCycle } from "@/lib/dataset";
import type { Alert } from "@/types/floodwatch";

/**
 * GET /api/alerts/            -> alerts for the latest cycle (F10)
 * GET /api/alerts/?cycle=...  -> alerts for any cycle, so the banner can
 *                                follow the slider instead of going stale
 */
export async function GET(request: NextRequest) {
  const data = await getDataset();
  const requested = request.nextUrl.searchParams.get("cycle");
  const cycle = resolveCycle(data, requested);
  if (!cycle) return notFound(`No radar cycle on ${requested}`);

  const { warning_pct, severe_pct } = data.meta.alert_levels;
  const previousDate = data.cycles[cycle.index - 1]?.date;

  const alerts: Alert[] = rankDistricts(data, cycle.date)
    .filter((row) => (row.stat.flooded_pct ?? 0) >= warning_pct)
    .map(({ district, stat }) => {
      const before = previousDate
        ? data.stats[previousDate]?.[district.id]
        : undefined;
      const previous =
        before?.observed && before.flooded_pct !== null ? before.flooded_pct : null;
      const current = stat.flooded_pct ?? 0;
      return {
        district_id: district.id,
        name_en: district.name_en,
        name_bn: district.name_bn,
        level: current >= severe_pct ? "severe" : "warning",
        flooded_pct: current,
        flooded_km2: stat.flooded_km2,
        previous_pct: previous,
        change_pct: previous === null ? null : Math.round((current - previous) * 10) / 10,
        cycle: cycle.date,
      };
    });

  return json({ cycle: cycle.date, levels: data.meta.alert_levels, alerts });
}
