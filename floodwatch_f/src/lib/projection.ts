/**
 * Spherical Web Mercator, matching `scripts/seed_data.py`.
 *
 * The overlay PNGs are rendered linear in (longitude, mercator-y). Leaflet
 * stretches an image overlay the same way, so the main map needs no maths at
 * all. The district page draws its own SVG comparison instead of a Leaflet
 * map, and that is what these helpers are for: project once, here, so the
 * raster and the district outline cannot drift apart.
 */

/** Mercator y for a latitude, in the same units the seed script uses. */
export function mercY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}

/**
 * SVG y for a latitude.
 *
 * Two things happen here. The sign flips, because SVG y grows downward. And
 * the radians `mercY` returns are converted to degrees, so that one unit on the
 * y axis is the same size as one unit on the x axis - where x is plain degrees
 * of longitude. Skip that conversion and the drawing is squashed by a factor of
 * 57, which looks like a thin horizontal smear rather than a district.
 */
export function svgY(lat: number): number {
  return (-mercY(lat) * 180) / Math.PI;
}

/**
 * Coordinates are rounded before they reach the DOM. Serialising a raw double
 * can differ in the last digit between the server render and the client, and
 * React reports that as a hydration mismatch.
 */
const PRECISION = 6;

function round(value: number): number {
  return Number(value.toFixed(PRECISION));
}

export interface ProjectedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Project a [west, south, east, north] box into SVG user units. */
export function projectBbox(
  bbox: [number, number, number, number],
  padFraction = 0,
): ProjectedBox {
  const [west, south, east, north] = bbox;
  const padX = (east - west) * padFraction;
  const padY = (svgY(south) - svgY(north)) * padFraction;
  return {
    x: round(west - padX),
    y: round(svgY(north) - padY),
    width: round(east - west + padX * 2),
    height: round(svgY(south) - svgY(north) + padY * 2),
  };
}

/** `x y width height`, already rounded, for a viewBox attribute. */
export function viewBoxOf(box: ProjectedBox): string {
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

type Ring = number[][];

/** An SVG path for a GeoJSON Polygon or MultiPolygon, in projected units. */
export function geometryToPath(geometry: {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}): string {
  const polygons: Ring[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates as Ring[]]
      : (geometry.coordinates as Ring[][]);

  const parts: string[] = [];
  for (const rings of polygons) {
    for (const ring of rings) {
      if (ring.length < 3) continue;
      const points = ring.map(
        ([lon, lat], i) => `${i === 0 ? "M" : "L"}${lon.toFixed(4)} ${svgY(lat).toFixed(5)}`,
      );
      parts.push(`${points.join("")}Z`);
    }
  }
  return parts.join("");
}
