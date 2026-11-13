import { getDataset, invalidateDataset, json } from "@/lib/dataset";
import type { UpdateResult } from "@/types/floodwatch";

/**
 * POST /api/update/ - the "check for new images" button (F17).
 *
 * In the real system this triggers the ASF DAAC ingest job. Here it does the
 * honest equivalent: it drops the cached dataset and re-reads it from disk, so
 * if someone re-runs `npm run seed` with a later season end, the new cycles
 * genuinely appear without restarting the server. It reports exactly what it
 * found rather than pretending to have downloaded anything.
 */

let knownCycles: string[] | null = null;

export async function POST() {
  const started = Date.now();

  const before = knownCycles ?? (await getDataset()).cycles.map((c) => c.date);
  invalidateDataset();
  const data = await getDataset();
  const after = data.cycles.map((c) => c.date);
  knownCycles = after;

  const newCycles = after.filter((d) => !before.includes(d));

  const payload: UpdateResult = {
    ok: true,
    checked_at: new Date().toISOString(),
    granules_found: after.length,
    new_cycles: newCycles,
    latest_cycle: data.meta.latest_cycle,
    message: newCycles.length
      ? `${newCycles.length} new cycle(s): ${newCycles.join(", ")}`
      : `No new radar cycles. ${after.length} cycles on file, latest ${data.meta.latest_cycle}.`,
    duration_ms: Date.now() - started,
  };

  return json(payload);
}

export function GET() {
  return Response.json(
    { error: "Use POST to trigger an update check." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
