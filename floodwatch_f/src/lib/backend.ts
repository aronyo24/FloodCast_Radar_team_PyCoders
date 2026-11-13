/**
 * Where the Django backend lives. Shared by next.config.ts (the /api/, /media/
 * and /admin/ proxy) and lib/dataset.ts (server-side page data), so the two
 * can never point at different servers.
 *
 * With no env var set, the app uses the production backend on Heroku, so a
 * fresh deploy (Vercel, Netlify, ...) shows live data with zero configuration.
 * Override with FLOODWATCH_API_URL (e.g. http://127.0.0.1:8000 for local
 * Django), or set FLOODWATCH_DEMO=true for the bundled offline demo data.
 *
 * No "@/..." imports here: next.config.ts loads this file directly.
 */
export const DEFAULT_BACKEND_URL = "https://floodcastradar-edd2e71135a9.herokuapp.com";

export function backendUrl(): string {
  if (process.env.FLOODWATCH_DEMO === "true") return "";
  return (process.env.FLOODWATCH_API_URL?.trim() || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}
