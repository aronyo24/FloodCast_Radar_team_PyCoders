import { findDistrict, getDataset, json, notFound, rankDistricts } from "@/lib/dataset";
import type { DistrictTimeline } from "@/types/floodwatch";

/**
 * GET /api/districts/<id>/timeline/ - one district across every cycle (F5).
 *
 * `<id>` accepts the slug, the English name or the geoBoundaries name, so
 * hand-typed and shared links both work.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/districts/[id]/timeline">,
) {
  const { id } = await ctx.params;
  const data = await getDataset();
  const district = findDistrict(data, id);
  if (!district) return notFound(`No district called "${id}"`);

  const series = data.cycles.map((cycle) => ({
    date: cycle.date,
    label: cycle.label,
    index: cycle.index,
    ...(data.stats[cycle.date]?.[district.id] ?? {
      observed: false,
      coverage_pct: 0,
      flooded_km2: 0,
      flooded_pct: null,
    }),
  }));

  const latest = data.meta.latest_cycle;
  const rank =
    rankDistricts(data, latest).find((r) => r.district.id === district.id)?.rank ??
    null;

  const payload: DistrictTimeline = {
    district,
    series,
    rank_latest: rank,
    meta: {
      latest_cycle: latest,
      low_coverage_pct: data.meta.low_coverage_pct,
      alert_levels: data.meta.alert_levels,
    },
  };
  return json(payload);
}
