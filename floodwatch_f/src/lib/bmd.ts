/**
 * Client for the BMD field portal (/api/bmd/*).
 *
 * Officers authenticate with Django's session cookie, which reaches Django
 * through the Next.js proxy (same origin). Every write carries Django's CSRF
 * token, read fresh from the cookie because Django rotates it on sign-in.
 */

import type {
  BmdRegisterInput,
  BmdReport,
  BmdReportInput,
  BmdReportQuery,
  BmdSession,
  BmdSummary,
} from "@/types/bmd";

import { ApiError } from "./api";

const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

function csrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfReady: Promise<void> | null = null;

/** Make sure Django has set the CSRF cookie before the first write. */
function ensureCsrf(): Promise<void> {
  if (csrfToken()) return Promise.resolve();
  csrfReady ??= fetch(`${BASE}/api/bmd/csrf/`, { credentials: "include" })
    .then(() => undefined)
    .finally(() => {
      csrfReady = null;
    });
  return csrfReady;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    await ensureCsrf();
    const token = csrfToken();
    if (token) headers["X-CSRFToken"] = token;
  }
  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, method, headers, credentials: "include", cache: "no-store" });
  } catch (cause) {
    throw new ApiError("Could not reach the FloodCast Radar server. Check your connection.", 0, url, { cause });
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; detail?: string; fields?: Record<string, string> };
    const err = new ApiError(b.error ?? b.detail ?? res.statusText, res.status, url);
    err.fields = b.fields;
    throw err;
  }
  return body as T;
}

export const bmdMe = () => call<BmdSession>("/api/bmd/me/");

export const bmdLogin = (email: string, password: string) =>
  call<BmdSession>("/api/bmd/login/", { method: "POST", body: JSON.stringify({ email, password }) });

export const bmdRegister = (body: BmdRegisterInput) =>
  call<BmdSession>("/api/bmd/register/", { method: "POST", body: JSON.stringify(body) });

export const bmdLogout = () => call<BmdSession>("/api/bmd/logout/", { method: "POST" });

export function bmdReports(q: BmdReportQuery = {}) {
  const params = new URLSearchParams();
  if (q.district) params.set("district", q.district);
  if (q.division) params.set("division", q.division);
  if (q.level) params.set("level", q.level);
  if (q.hours) params.set("hours", String(q.hours));
  if (q.verified) params.set("verified", "1");
  if (q.mine) params.set("mine", "1");
  if (q.limit) params.set("limit", String(q.limit));
  const qs = params.toString();
  return call<{ count: number; reports: BmdReport[] }>(`/api/bmd/reports/${qs ? `?${qs}` : ""}`);
}

export const bmdReport = (id: number) => call<BmdReport>(`/api/bmd/reports/${id}/`);

export const bmdSummary = () => call<BmdSummary>("/api/bmd/summary/");

/** Form strings → API body: blank numbers become null, the local time becomes ISO. */
function toBody(input: BmdReportInput) {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    ...input,
    rainfall_24h_mm: num(input.rainfall_24h_mm),
    water_level_m: num(input.water_level_m),
    danger_level_m: num(input.danger_level_m),
    affected_people: num(input.affected_people),
    shelters_open: num(input.shelters_open),
    observed_at: input.observed_at ? new Date(input.observed_at).toISOString() : null,
  };
}

export const bmdCreateReport = (input: BmdReportInput) =>
  call<BmdReport>("/api/bmd/reports/", { method: "POST", body: JSON.stringify(toBody(input)) });

export const bmdUpdateReport = (id: number, input: BmdReportInput) =>
  call<BmdReport>(`/api/bmd/reports/${id}/`, { method: "PATCH", body: JSON.stringify(toBody(input)) });

export const bmdDeleteReport = (id: number) =>
  call<void>(`/api/bmd/reports/${id}/`, { method: "DELETE" });
