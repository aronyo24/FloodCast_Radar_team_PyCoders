import type { NextRequest } from "next/server";

import { getDataset, json, notFound, resolveCycle } from "@/lib/dataset";

/**
 * GET /api/overlays/?cycle=<date> - the flood and permanent-water rasters (F8).
 *
 * The PNGs are rendered linear in (longitude, mercator-y), which is exactly how
 * Leaflet stretches an image overlay, so `bounds` can be handed to
 * `L.imageOverlay` with no reprojection. Opacities come from section 5 of the
 * Frontend Plan: flood 80%, normal water 65%.
 */
export async function GET(request: NextRequest) {
  const data = await getDataset();
  const requested = request.nextUrl.searchParams.get("cycle");
  const cycle = resolveCycle(data, requested);
  if (!cycle) return notFound(`No radar cycle on ${requested}`);

  return json({
    cycle: cycle.date,
    flood: cycle.overlay.flood,
    water: cycle.overlay.water,
    bounds: data.meta.grid.leaflet_bounds,
    opacity: { flood: 0.8, water: 0.65 },
    projection: data.meta.grid.projection,
    approx_m_per_px: data.meta.grid.approx_m_per_px,
  });
}
