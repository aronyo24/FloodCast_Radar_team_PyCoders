import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DistrictClient } from "@/components/DistrictClient";
import {
  findDistrict,
  getDataset,
  getGeometry,
  rankDistricts,
  usesBackend,
} from "@/lib/dataset";

/**
 * Pre-render all 64 district pages from the local demo data. With the Django
 * backend the data is not known at build time, so each page is rendered on
 * its first request (the build does not need the backend running) and then
 * regenerated at most once a minute.
 */
export const revalidate = 60;

export async function generateStaticParams() {
  if (usesBackend()) return [];
  const data = await getDataset({ isr: true });
  return data.districts.map((d) => ({ name: d.id }));
}

export async function generateMetadata(
  props: PageProps<"/district/[name]">,
): Promise<Metadata> {
  const { name } = await props.params;
  const data = await getDataset({ isr: true });
  const district = findDistrict(data, name);
  if (!district) return { title: "District not found" };
  return {
    title: district.name_en,
    description: `Flooding in ${district.name_en} district through the 2026 monsoon, measured by NISAR radar.`,
  };
}

export default async function DistrictPage(props: PageProps<"/district/[name]">) {
  const { name } = await props.params;
  const data = await getDataset({ isr: true });
  const district = findDistrict(data, name);
  if (!district) notFound();

  const geometry = await getGeometry({ isr: true });
  const feature = geometry.get(district.id);
  if (!feature) notFound();

  const series = data.cycles.map((cycle) => ({
    date: cycle.date,
    label: cycle.label,
    index: cycle.index,
    ...(data.stats[cycle.date]?.[district.id] ?? {
      observed: false,
      coverage_pct: 0,
      flooded_km2: 0,
      flooded_pct: null,
    }),
  }));

  const latest = data.meta.latest_cycle;
  const ranked = rankDistricts(data, latest);
  const rank = ranked.find((r) => r.district.id === district.id)?.rank ?? null;

  // Same division, closest by centroid - a cheap neighbour heuristic that is
  // good enough to offer "look at the district next door".
  const neighbours = data.districts
    .filter((d) => d.id !== district.id)
    .map((d) => ({
      district: d,
      distance: Math.hypot(
        d.centroid[0] - district.centroid[0],
        d.centroid[1] - district.centroid[1],
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4)
    .map((n) => {
      const stat = data.stats[latest]?.[n.district.id];
      return {
        id: n.district.id,
        name_en: n.district.name_en,
        name_bn: n.district.name_bn,
        flooded_pct: stat?.observed ? stat.flooded_pct : null,
      };
    });

  // Overlay rasters per cycle, for the before/after comparison.
  const overlays = Object.fromEntries(
    data.cycles.map((c) => [c.date, { overlay: c.overlay, overlays: c.overlays ?? null }]),
  );

  return (
    <DistrictClient
      district={district}
      feature={feature}
      series={series}
      overlays={overlays}
      meta={data.meta}
      rank={rank}
      rankedTotal={ranked.length}
      neighbours={neighbours}
    />
  );
}
