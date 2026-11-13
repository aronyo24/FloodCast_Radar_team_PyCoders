/**
 * Shapes returned by the FloodCast Radar API.
 *
 * These mirror the endpoint list in the Backend Plan, so swapping the bundled
 * demo routes for the real Django service is a base-URL change and nothing else.
 */

export type DistrictId = string;

export type Regime =
  | "brahmaputra"
  | "jamuna-char"
  | "padma"
  | "meghna-haor"
  | "coastal"
  | "delta"
  | "hill"
  | "barind"
  | "urban";

export interface District {
  id: DistrictId;
  name_en: string;
  name_bn: string;
  /** `shapeName` in geoBoundaries - kept so rows can be traced to the source. */
  source_name: string;
  shape_id?: string | null;
  division: string;
  regime: Regime;
  area_km2: number;
  permanent_water_km2: number;
  centroid: [number, number];
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  peak_cycle: string | null;
  peak_flooded_pct: number | null;
  peak_flooded_km2: number | null;
  baseline_cycle: string | null;
  cycles_observed: number;
}

/** One district in one 12-day cycle. */
export interface DistrictCycleStat {
  observed: boolean;
  coverage_pct: number;
  flooded_km2: number;
  /** Share of the *observed* part of the district under new water. */
  flooded_pct: number | null;
  observed_km2?: number;
}

export interface NationalStat {
  flooded_km2: number;
  observed_km2: number;
  flooded_pct: number;
  coverage_pct: number;
  districts_observed: number;
  districts_total: number;
  worst: {
    id: DistrictId;
    name_en: string;
    name_bn: string;
    flooded_pct: number;
    flooded_km2: number;
  } | null;
}

export interface CycleOverlay {
  /** Primary (national) flood raster. `null` when the cycle has none. */
  flood: string | null;
  water: string | null;
}

/** One georeferenced PNG. The Django backend returns one per NISAR frame. */
export interface OverlayItem {
  kind: "flood" | "water";
  url: string;
  /** [[south, west], [north, east]] - ready for L.imageOverlay. */
  bounds: [[number, number], [number, number]];
  date: string;
  frame: string | null;
}

export interface CycleSummary {
  date: string;
  index: number;
  label: string;
  national: NationalStat;
  overlay: CycleOverlay;
  /**
   * Every overlay for the cycle, each with its own bounds. Present from the
   * Django backend; absent from the bundled demo routes, which use `overlay`
   * stretched to `meta.grid.leaflet_bounds`.
   */
  overlays?: OverlayItem[];
  provisional?: boolean;
}

/** `/api/cycles/<date>/` */
export interface CycleDetail extends CycleSummary {
  districts: Record<DistrictId, DistrictCycleStat>;
}

export interface Alert {
  district_id: DistrictId;
  name_en: string;
  name_bn: string;
  level: "warning" | "severe";
  flooded_pct: number;
  flooded_km2: number;
  previous_pct: number | null;
  change_pct: number | null;
  cycle: string;
}

export interface Meta {
  mission: string;
  instrument: string;
  distributor: string;
  product: string;
  provisional: boolean;
  demo_data: boolean;
  demo_note: string;
  generated_at: string;
  seed: number | null;
  cycle_length_days: number;
  season: { start: string; end: string };
  latest_cycle: string;
  /** Acquisition date of the newest radar image (backend); falls back to latest_cycle. */
  latest_image?: string | null;
  last_checked: string;
  country_area_km2: number;
  alert_levels: { warning_pct: number; severe_pct: number };
  low_coverage_pct: number;
  grid: {
    width: number;
    height: number;
    projection: string;
    bounds: { west: number; south: number; east: number; north: number };
    /** [[south, west], [north, east]] - ready for L.imageOverlay. */
    leaflet_bounds: [[number, number], [number, number]];
    approx_m_per_px: number;
  };
  boundaries: {
    name: string;
    release: string;
    year_represented: number;
    licence: string;
    source: string;
    url: string;
  };
}

/** `/api/districts/<id>/timeline/` */
export interface DistrictTimeline {
  district: District;
  series: Array<{
    date: string;
    label: string;
    index: number;
  } & DistrictCycleStat>;
  rank_latest: number | null;
  meta: Pick<Meta, "latest_cycle" | "low_coverage_pct" | "alert_levels">;
}

export interface DistrictFeature {
  type: "Feature";
  id: DistrictId;
  /** A complete district record, so the map needs no second lookup. */
  properties: District;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface DistrictCollection {
  type: "FeatureCollection";
  name: string;
  attribution: string;
  features: DistrictFeature[];
}

/** `/api/national/` */
export interface NationalSeries {
  meta: Pick<Meta, "latest_cycle" | "country_area_km2" | "cycle_length_days">;
  series: Array<{
    date: string;
    label: string;
    index: number;
    flooded_km2: number;
    flooded_pct: number;
    coverage_pct: number;
    districts_observed: number;
    worst_id: DistrictId | null;
    worst_name_en: string | null;
  }>;
  peak: { date: string; flooded_km2: number } | null;
}

/** `POST /api/update/` */
export interface UpdateResult {
  ok: boolean;
  checked_at: string;
  granules_found: number;
  new_cycles: string[];
  latest_cycle: string;
  message: string;
  duration_ms: number;
}

export type RiskLevel = "low" | "moderate" | "high" | "severe";

export type RiskFactorKey =
  | "current"
  | "recent"
  | "trend"
  | "frequency"
  | "peak"
  | "terrain"
  | "water"
  | "season";

/** `/api/districts/<id>/risk/` - flood outlook for the next ~12 days. */
export interface RiskOutlook {
  district: {
    id: DistrictId;
    name_en: string;
    name_bn: string;
    division: string;
    regime: string;
    area_km2: number;
  };
  cycle: string | null;
  outlook_until: string | null;
  /** 2-98, the chance (in %) that the district floods in the outlook window. */
  probability: number;
  level: RiskLevel;
  confidence: "low" | "medium" | "high";
  observed: boolean;
  last_observed: string | null;
  current_pct: number;
  coverage_pct: number;
  /** Percentage points versus the two readings before the latest. */
  trend_pp: number;
  recent_pct: number;
  forecast_pct: number;
  forecast_range: [number, number];
  exposed_km2: number;
  peak_pct: number;
  flood_cycles: number;
  observed_cycles: number;
  factors: Array<{
    key: RiskFactorKey;
    weight: number;
    score: number;
    /** Points this factor adds to the probability. */
    contribution: number;
    value: number | string;
  }>;
  method: string;
}

/** `POST /api/subscriptions/` */
export interface SubscribeRequest {
  name: string;
  email: string;
  district: DistrictId;
  min_level: Exclude<RiskLevel, "low">;
  language: "en" | "bn";
}

export interface SubscribeResult {
  ok: boolean;
  created: boolean;
  email_sent: boolean;
  message: string;
  district: DistrictId;
  min_level: string;
  risk: { level: RiskLevel; probability: number };
}

/** `/api/risk/` - every district's outlook, highest first (no factor breakdown). */
export interface RiskSummaryResponse {
  cycle: string | null;
  districts: Array<Omit<RiskOutlook, "factors" | "method">>;
}

export type RiskMap = Record<DistrictId, { probability: number; level: RiskLevel }>;
