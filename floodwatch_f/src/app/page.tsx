import { getDataset } from "@/lib/dataset";

import { HomeClient } from "@/components/HomeClient";

/**
 * Home: one sentence, the national headline number, and a big button through
 * to the Explorer. Rendered on the server so the headline figure is in the
 * first HTML response rather than arriving after a fetch.
 */
export default async function HomePage() {
  const data = await getDataset();

  if (data.cycles.length === 0) {
    throw new Error("No flood cycles have been imported yet. Run `manage.py import_web_data` on the backend.");
  }
  const peak = data.cycles.reduce((best, c) =>
    c.national.flooded_km2 > best.national.flooded_km2 ? c : best,
  );

  return (
    <HomeClient
      peak={{
        date: peak.date,
        flooded_km2: peak.national.flooded_km2,
        flooded_pct: peak.national.flooded_pct,
        worst: peak.national.worst,
      }}
      cycleCount={data.cycles.length}
      districtCount={data.districts.length}
      season={data.meta.season}
      demo={data.meta.demo_data}
      provisional={data.meta.provisional}
    />
  );
}
