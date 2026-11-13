import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

import { getDataset, json } from "@/lib/dataset";

const GEOJSON_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "districts.geojson",
);

let geojsonCache: Promise<string> | null = null;

/**
 * GET /api/districts/            -> GeoJSON FeatureCollection for the map (F1)
 * GET /api/districts/?format=list -> id/name only, for the search box (F14)
 *
 * The geometry is ~580 KB, so the search box must not pull it. It is streamed
 * straight from disk as a pre-serialised string rather than parsed and
 * re-serialised on every request.
 */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");

  if (format === "list") {
    const data = await getDataset();
    return json({
      districts: data.districts.map((d) => ({
        id: d.id,
        name_en: d.name_en,
        name_bn: d.name_bn,
        // The pre-2018 romanisation, so "Bogra" still finds Bogura.
        source_name: d.source_name,
        division: d.division,
        area_km2: d.area_km2,
      })),
    });
  }

  if (!geojsonCache) {
    geojsonCache = readFile(GEOJSON_PATH, "utf8").catch((err) => {
      geojsonCache = null;
      throw err;
    });
  }

  try {
    const body = await geojsonCache;
    return new Response(body, {
      headers: {
        "Content-Type": "application/geo+json; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return Response.json(
      { error: 'Boundary file missing. Run "npm run seed".' },
      { status: 500 },
    );
  }
}
