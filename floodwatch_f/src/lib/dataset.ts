/**
 * Server-side dataset access for the pages (Home, Explorer, District, ...).
 *
 * Two sources:
 *
 *  - Local (only with FLOODWATCH_DEMO=true): `public/data/dataset.json`, read once per process and
 *    memoised. It is a build artefact of `scripts/seed_data.py`, so it only
 *    changes when POST /api/update/ calls `invalidateDataset()`.
 *  - Django (default; FLOODWATCH_API_URL, else the Heroku backend): the same `Dataset` shape is
 *    assembled from the backend's public endpoints and cached for
 *    REMOTE_TTL_MS, so the server-rendered pages show exactly what the
 *    browser-side fetches show. Pages are then rendered per request instead
 *    of at build time, because the data lives in Django, not in the build.
 *
 * Everything here is server-only. Client code talks to the API, never to
 * this module.
 */

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { connection } from "next/server";

import { backendUrl } from "./backend";

import type {
  Alert,
  CycleDetail,
  CycleSummary,
  District,
  DistrictCycleStat,
  DistrictCollection,
  DistrictFeature,
  DistrictId,
  Meta,
} from "@/types/floodwatch";

/** Django base URL for server-side reads (see lib/backend.ts). The bundled demo
 * file is used only when FLOODWATCH_DEMO=true, so a missing env file can never
 * silently show demo data. */
const REMOTE = backendUrl();
const REMOTE_TTL_MS = 30_000;

/** True when pages read from the Django backend instead of the local file. */
export function usesBackend(): boolean {
  return REMOTE !== "";
}

async function remoteJson<T>(pathname: string): Promise<T> {
  const url = `${REMOTE}${pathname}`;
  let res: Response;
  try {
    // No fetch-level cache option on purpose: `getRemote()` keeps its own TTL,
    // and `cache: "no-store"` would force dynamic rendering on ISR pages.
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new Error(`Could not reach the FloodCast Radar backend at ${url}. Is Django running? (${(err as Error).message})`);
  }
  if (!res.ok) throw new Error(`Backend ${url} answered ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

interface Remote {
  dataset: Dataset;
  geometry: Map<string, DistrictFeature>;
  at: number;
}

let remote: Promise<Remote> | null = null;

async function loadRemote(): Promise<Remote> {
  const [meta, index, geo] = await Promise.all([
    remoteJson<Meta>("/api/meta/"),
    remoteJson<{ cycles: CycleSummary[] }>("/api/cycles/"),
    remoteJson<DistrictCollection>("/api/districts/"),
  ]);
  const details = await Promise.all(
    index.cycles.map((c) => remoteJson<CycleDetail>(`/api/cycles/${c.date}/`)),
  );
  const stats: Dataset["stats"] = {};
  for (const d of details) stats[d.date] = d.districts;
  return {
    dataset: {
      meta,
      cycles: index.cycles,
      districts: geo.features.map((f) => f.properties),
      stats,
      alerts: [],
    },
    geometry: new Map(geo.features.map((f) => [f.properties.id, f])),
    at: Date.now(),
  };
}

function getRemote(): Promise<Remote> {
  const current = remote;
  if (current) {
    return current.then((r) => {
      if (Date.now() - r.at < REMOTE_TTL_MS) return r;
      if (remote === current) remote = null;
      return getRemote();
    });
  }
  const next = loadRemote().catch((err) => {
    remote = null; // retry on the next request rather than cache the failure
    throw err;
  });
  remote = next;
  return next;
}

export interface Dataset {
  meta: Meta;
  cycles: CycleSummary[];
  districts: District[];
  stats: Record<string, Record<DistrictId, DistrictCycleStat>>;
  alerts: Alert[];
}

const DATASET_PATH = path.join(process.cwd(), "public", "data", "dataset.json");

let cached: Promise<Dataset> | null = null;

/**
 * @param opts.isr  The calling page is incrementally regenerated (it exports
 *   `revalidate`) rather than rendered per request, so it must not opt into
 *   request-time rendering.
 */
export async function getDataset(opts: { isr?: boolean } = {}): Promise<Dataset> {
  if (usesBackend()) {
    // Render per request: the data is in Django, not in the build.
    if (!opts.isr) await connection();
    return (await getRemote()).dataset;
  }
  if (!cached) {
    cached = readFile(DATASET_PATH, "utf8")
      .then((raw) => JSON.parse(raw) as Dataset)
      .catch((err) => {
        cached = null; // let the next request retry rather than cache a failure
        throw new Error(
          `Could not read public/data/dataset.json. Run "npm run seed" first. (${
            (err as Error).message
          })`,
        );
      });
  }
  return cached;
}

export function invalidateDataset(): void {
  cached = null;
  geometry = null;
  remote = null;
}

const GEOJSON_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "districts.geojson",
);

let geometry: Promise<Map<string, DistrictFeature>> | null = null;

/**
 * District geometry, indexed by id. Parsed once: the district page needs a
 * single feature and should not pay for re-parsing a 580 KB file per request.
 */
export async function getGeometry(opts: { isr?: boolean } = {}): Promise<Map<string, DistrictFeature>> {
  if (usesBackend()) {
    if (!opts.isr) await connection();
    return (await getRemote()).geometry;
  }
  if (!geometry) {
    geometry = readFile(GEOJSON_PATH, "utf8")
      .then((raw) => {
        const parsed = JSON.parse(raw) as { features: DistrictFeature[] };
        return new Map(parsed.features.map((f) => [f.properties.id, f]));
      })
      .catch((err) => {
        geometry = null;
        throw err;
      });
  }
  return geometry;
}

/** Resolve a district by id, slug, English name or geoBoundaries name. */
export function findDistrict(
  data: Dataset,
  key: string,
): District | undefined {
  const needle = key.trim().toLowerCase();
  const slug = needle.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return data.districts.find(
    (d) =>
      d.id === slug ||
      d.name_en.toLowerCase() === needle ||
      d.source_name.toLowerCase() === needle ||
      d.name_bn === key.trim(),
  );
}

/** Resolve a cycle date, falling back to the latest one. */
export function resolveCycle(
  data: Dataset,
  date: string | null | undefined,
): CycleSummary | undefined {
  if (!date || date === "latest") {
    return data.cycles[data.cycles.length - 1];
  }
  return data.cycles.find((c) => c.date === date);
}

/**
 * Districts ranked by flooded share for one cycle, worst first.
 * Unobserved districts are excluded - ranking them as 0% would be a lie.
 */
export function rankDistricts(
  data: Dataset,
  cycleDate: string,
): Array<{ district: District; stat: DistrictCycleStat; rank: number }> {
  const stats = data.stats[cycleDate] ?? {};
  const byId = new Map(data.districts.map((d) => [d.id, d]));
  return Object.entries(stats)
    .filter(([, s]) => s.observed && s.flooded_pct !== null)
    .map(([id, stat]) => ({ district: byId.get(id)!, stat }))
    .filter((row) => Boolean(row.district))
    .sort((a, b) => (b.stat.flooded_pct ?? 0) - (a.stat.flooded_pct ?? 0))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Uniform JSON response. Demo data is static, so it is safe to cache hard. */
export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      ...(init?.headers ?? {}),
    },
  });
}

export function notFound(message: string): Response {
  return Response.json({ error: message }, { status: 404 });
}
