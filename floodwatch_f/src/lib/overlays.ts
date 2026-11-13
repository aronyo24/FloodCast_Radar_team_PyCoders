/**
 * Turn a cycle's overlay fields into drawable layers.
 *
 * The Django backend sends `overlays`: one PNG per NISAR frame, each with
 * its own bounds. The bundled demo data sends one national `overlay` pair
 * that is stretched to `meta.grid.leaflet_bounds`. Both end up here as the
 * same list, normal water first so new flood water draws on top.
 */

import { assetUrl } from "@/lib/api";
import type { CycleOverlay, Meta, OverlayItem } from "@/types/floodwatch";

export interface OverlayLayer {
  kind: "flood" | "water";
  url: string;
  /** [[south, west], [north, east]] */
  bounds: [[number, number], [number, number]];
}

export function overlayLayers(
  overlay: CycleOverlay | null | undefined,
  overlays: OverlayItem[] | null | undefined,
  meta: Pick<Meta, "grid">,
): OverlayLayer[] {
  const layers: OverlayLayer[] = [];
  if (overlays && overlays.length > 0) {
    for (const o of overlays) {
      const url = assetUrl(o.url);
      if (url) layers.push({ kind: o.kind, url, bounds: o.bounds });
    }
  } else if (overlay && meta.grid?.leaflet_bounds) {
    const water = assetUrl(overlay.water);
    const flood = assetUrl(overlay.flood);
    if (water) layers.push({ kind: "water", url: water, bounds: meta.grid.leaflet_bounds });
    if (flood) layers.push({ kind: "flood", url: flood, bounds: meta.grid.leaflet_bounds });
  }
  return layers.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "water" ? -1 : 1));
}
