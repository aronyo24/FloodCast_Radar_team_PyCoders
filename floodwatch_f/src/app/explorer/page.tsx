import type { Metadata } from "next";
import { Suspense } from "react";

import { ExplorerClient } from "@/components/ExplorerClient";
import { getDataset } from "@/lib/dataset";

export const metadata: Metadata = {
  title: "Flood Explorer",
  description:
    "Bangladesh district flood map from NISAR radar, with a date slider across the 2026 monsoon.",
};

/**
 * The Explorer. Meta is fetched on the server so the freshness badge and the
 * overlay bounds are available on the first paint; everything that changes with
 * the slider is client-side.
 *
 * The Suspense boundary is required because the client component reads the
 * query string (F15 shareable links) with useSearchParams.
 */
export default async function ExplorerPage() {
  const data = await getDataset();

  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <ExplorerClient meta={data.meta} />
    </Suspense>
  );
}

function ExplorerSkeleton() {
  return (
    <div className="shell space-y-3 py-5">
      <div className="fw-skeleton h-8 w-56" />
      <div className="fw-skeleton h-[52px]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="fw-skeleton h-[112px]" />
        ))}
      </div>
      <div className="fw-skeleton h-[620px]" />
    </div>
  );
}
