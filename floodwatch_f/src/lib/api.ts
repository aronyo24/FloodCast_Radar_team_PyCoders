/**
 * One place for every fetch() the browser makes - the `js/api.js` of the
 * Frontend Plan.
 *
 * Two ways to use the Django backend (see .env.example):
 *
 *  - FLOODWATCH_API_URL (recommended): the Next server proxies /api/ and
 *    /media/ to Django, so BASE stays "" and every call is same-origin -
 *    no CORS, and the staff session cookie just works.
 *  - NEXT_PUBLIC_API_BASE: the browser calls Django directly (needs CORS).
 *
 * With neither set, the Next server proxies to the live Heroku backend
 * (lib/backend.ts). The bundled demo routes in src/app/api/ answer only
 * when FLOODWATCH_DEMO=true.
 */

import type {
  Alert,
  CycleDetail,
  CycleSummary,
  DistrictCollection,
  DistrictId,
  DistrictTimeline,
  Meta,
  NationalSeries,
  RiskOutlook,
  RiskSummaryResponse,
  SubscribeRequest,
  SubscribeResult,
  UpdateResult,
} from "@/types/floodwatch";

const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ApiError";
  }

  /** Per-field validation messages, when the server sends them. */
  fields?: Record<string, string>;
}

/**
 * Overlay URLs from Django are site-relative (`/media/...`). Resolve them
 * against the API host when the browser talks to Django directly; leave
 * absolute URLs and same-origin paths alone.
 */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url) || !BASE) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  } catch (cause) {
    throw new ApiError(
      `Could not reach ${url}. Is the server running?`,
      0,
      url,
      { cause },
    );
  }
  if (!res.ok) {
    let detail = res.statusText;
    let fields: Record<string, string> | undefined;
    try {
      const body = (await res.json()) as {
        error?: string;
        detail?: string;
        fields?: Record<string, string>;
      };
      if (body?.error) detail = body.error;
      else if (body?.detail) detail = body.detail;
      fields = body?.fields;
    } catch {
      // Non-JSON error body; the status text will do.
    }
    const err = new ApiError(detail, res.status, url);
    err.fields = fields;
    throw err;
  }
  return (await res.json()) as T;
}

export interface CyclesIndex {
  meta: Pick<Meta, "latest_cycle" | "cycle_length_days" | "season" | "alert_levels" | "low_coverage_pct">;
  cycles: CycleSummary[];
}

/** F6 - freshness and the provisional badge. */
export const getMeta = () => request<Meta>("/api/meta/");

/** F1 - district geometry, drawn once. */
export const getDistricts = () =>
  request<DistrictCollection>("/api/districts/");

/** F14 - a light list for the search box, without the geometry. */
export const getDistrictList = () =>
  request<{
    districts: Array<{
      id: DistrictId;
      name_en: string;
      name_bn: string;
      source_name: string;
      division: string;
    }>;
  }>(
    "/api/districts/?format=list",
  );

/** F2 - the slider's cycle index plus each cycle's national summary. */
export const getCycles = () => request<CyclesIndex>("/api/cycles/");

/** F1, F2 - per-district numbers for one cycle. */
export const getCycle = (date: string) =>
  request<CycleDetail>(`/api/cycles/${encodeURIComponent(date)}/`);

/** F4 - the national timeline. */
export const getNational = () => request<NationalSeries>("/api/national/");

/** F5 - one district across the whole season. */
export const getDistrictTimeline = (id: DistrictId) =>
  request<DistrictTimeline>(
    `/api/districts/${encodeURIComponent(id)}/timeline/`,
  );

/** F10 - alert banner. Defaults to the latest cycle. */
export const getAlerts = (cycle?: string) =>
  request<{ cycle: string; levels: Meta["alert_levels"]; alerts: Alert[] }>(
    `/api/alerts/${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ""}`,
  );

/** F8 - overlay image URLs and the bounds to stretch them to. */
export const getOverlay = (cycle: string) =>
  request<{
    cycle: string;
    flood: string;
    water: string;
    bounds: [[number, number], [number, number]];
    opacity: { flood: number; water: number };
  }>(`/api/overlays/?cycle=${encodeURIComponent(cycle)}`);

/** F16 - CSV of the current view. Returns a URL, not a fetch. */
export const csvUrl = (cycle: string) =>
  `${BASE}/api/cycles/${encodeURIComponent(cycle)}/?format=csv`;

/**
 * F17 - the "check for new images" button.
 *
 * Django only lets staff trigger an update: sign in at /admin/ first. The
 * session cookie is sent along, plus Django's CSRF token when one is set.
 * 401/403 come back as an ApiError the button turns into a sign-in hint.
 */
export const runUpdate = () => {
  const csrf = readCookie("csrftoken");
  return request<UpdateResult>("/api/update/", {
    method: "POST",
    credentials: "include",
    headers: csrf ? { "X-CSRFToken": csrf } : undefined,
  });
};

/** Flood-risk outlook for one district, as of a cycle (default: latest). */
export const getRisk = (id: DistrictId, cycle?: string) =>
  request<RiskOutlook>(
    `/api/districts/${encodeURIComponent(id)}/risk/${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ""}`,
  );

/** Sign up for automatic flood e-mails. The server sends a welcome e-mail. */
export const subscribe = (body: SubscribeRequest) =>
  request<SubscribeResult>("/api/subscriptions/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Every district's outlook for a cycle, highest risk first. */
export const getRiskAll = (cycle?: string) =>
  request<RiskSummaryResponse>(`/api/risk/${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ""}`);
