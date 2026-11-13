"use client";

/**
 * Client-only wrapper for the Leaflet map.
 *
 * Leaflet touches `window` as soon as it loads, so the real component is pulled
 * in with `ssr: false`. The placeholder keeps the same height to stop the page
 * jumping when the map arrives.
 */

import dynamic from "next/dynamic";

import type { FloodMapProps } from "./FloodMapInner";

const Inner = dynamic(() => import("./FloodMapInner"), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center bg-[#c9d6e4]">
      <div className="fw-pulse text-[12px] font-semibold text-slate-600">
        Loading map…
      </div>
    </div>
  ),
});

export function FloodMap(props: FloodMapProps) {
  return <Inner {...props} />;
}
