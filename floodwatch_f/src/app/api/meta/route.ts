import { getDataset, json } from "@/lib/dataset";

/** GET /api/meta/ - freshness, provenance and the provisional flag (F6). */
export async function GET() {
  const data = await getDataset();
  return json(data.meta);
}
