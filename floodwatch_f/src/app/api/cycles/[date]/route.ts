import type { NextRequest } from "next/server";

import { getDataset, json, notFound, rankDistricts, resolveCycle } from "@/lib/dataset";
import type { CycleDetail } from "@/types/floodwatch";

/**
 * GET /api/cycles/<date>/              -> per-district numbers for one cycle
 * GET /api/cycles/<date>/?format=csv   -> the same numbers as a download (F16)
 *
 * `<date>` is an ISO date, or the literal "latest".
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/cycles/[date]">,
) {
  const { date } = await ctx.params;
  const data = await getDataset();
  const cycle = resolveCycle(data, date);
  if (!cycle) {
    return notFound(
      `No radar cycle on ${date}. Cycles run every ${data.meta.cycle_length_days} days from ${data.meta.season.start}.`,
    );
  }

  if (request.nextUrl.searchParams.get("format") === "csv") {
    return csvResponse(data, cycle.date);
  }

  const payload: CycleDetail = {
    ...cycle,
    districts: data.stats[cycle.date] ?? {},
  };
  return json(payload);
}

function csvResponse(
  data: Awaited<ReturnType<typeof getDataset>>,
  cycleDate: string,
) {
  const ranked = rankDistricts(data, cycleDate);
  const rankById = new Map(ranked.map((r) => [r.district.id, r.rank]));
  const stats = data.stats[cycleDate] ?? {};

  const header = [
    "rank",
    "district_id",
    "district_en",
    "district_bn",
    "division",
    "observed",
    "coverage_pct",
    "district_area_km2",
    "observed_area_km2",
    "flooded_km2",
    "flooded_pct_of_observed",
    "cycle_date",
    "source",
  ];

  const rows = [...data.districts]
    .sort(
      (a, b) =>
        (rankById.get(a.id) ?? 9_999) - (rankById.get(b.id) ?? 9_999) ||
        a.name_en.localeCompare(b.name_en),
    )
    .map((d) => {
      const s = stats[d.id];
      return [
        rankById.get(d.id) ?? "",
        d.id,
        d.name_en,
        d.name_bn,
        d.division,
        s?.observed ? "yes" : "no",
        s?.observed ? s.coverage_pct : "",
        d.area_km2,
        s?.observed ? (s.observed_km2 ?? "") : "",
        s?.observed ? s.flooded_km2 : "",
        s?.observed && s.flooded_pct !== null ? s.flooded_pct : "",
        cycleDate,
        data.meta.demo_data ? "FloodCast Radar demo data" : data.meta.product,
      ];
    });

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");

  // BOM so Excel opens the Bangla district names correctly.
  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="floodcast-radar-${cycleDate}.csv"`,
    },
  });
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
