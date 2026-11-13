"use client";

/**
 * Before / after swipe for one district (F11).
 *
 * The Frontend Plan suggests the leaflet-side-by-side plugin. This does the
 * same job without a second Leaflet instance on the page: one SVG, the real
 * overlay rasters placed at their true geographic extent, clipped to the
 * district outline, with the "after" half revealed by a moving clip rect.
 * Because both the rasters and the outline go through the same projection in
 * `lib/projection.ts`, they line up exactly.
 *
 * Draggable with a mouse, a finger, or the arrow keys.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { formatPercent, formatShortDate } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { OverlayLayer } from "@/lib/overlays";
import { geometryToPath, projectBbox, viewBoxOf } from "@/lib/projection";
import type { DistrictFeature } from "@/types/floodwatch";

/** Rasters for one side, each placed at its own geographic extent. */
function Rasters({ layers }: { layers: OverlayLayer[] }) {
  return (
    <>
      {layers.map((layer) => {
        const [[south, west], [north, east]] = layer.bounds;
        const r = projectBbox([west, south, east, north]);
        return (
          <image
            key={`${layer.kind}:${layer.url}`}
            href={layer.url}
            x={r.x} y={r.y} width={r.width} height={r.height}
            preserveAspectRatio="none"
            opacity={layer.kind === "water" ? 0.65 : 0.85}
          />
        );
      })}
    </>
  );
}

export function BeforeAfter({
  feature,
  before,
  after,
  beforeLayers,
  afterLayers,
  beforePct,
  afterPct,
}: {
  feature: DistrictFeature;
  before: string;
  after: string;
  /** Normal water first, then flood: the order they are drawn in. */
  beforeLayers: OverlayLayer[];
  afterLayers: OverlayLayer[];
  beforePct: number | null;
  afterPct: number | null;
}) {
  const { t, lang } = useLanguage();
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const box = projectBbox(feature.properties.bbox, 0.06);
  const path = geometryToPath(feature.geometry);

  // Rounded for the same reason the box is: identical strings on both sides.
  const splitX = Number((box.x + (box.width * split) / 100).toFixed(6));

  const move = useCallback((clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      move(e.clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, move]);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSplit((v) => Math.max(0, v - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSplit((v) => Math.min(100, v + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSplit(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSplit(100);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="eyebrow">{t("district.compare.title")}</p>
        <p className="text-[11px] text-text-faint">{t("district.compare.sub")}</p>
      </div>

      <div
        ref={wrap}
        className="relative select-none overflow-hidden rounded-xl border border-ink-600 bg-[#dfe7ee]"
        onPointerDown={(e) => {
          setDragging(true);
          move(e.clientX);
        }}
      >
        <svg
          viewBox={viewBoxOf(box)}
          className="mx-auto block w-full"
          style={{ aspectRatio: `${box.width} / ${box.height}`, maxHeight: 420 }}
          role="img"
          aria-label={`${feature.properties.name_en}: ${formatShortDate(before, lang)} vs ${formatShortDate(after, lang)}`}
        >
          <defs>
            <clipPath id={`clip-district-${uid}`} clipPathUnits="userSpaceOnUse">
              <path d={path} />
            </clipPath>
            <clipPath id={`clip-after-${uid}`} clipPathUnits="userSpaceOnUse">
              <rect
                x={splitX}
                y={box.y}
                width={Math.max(0, box.x + box.width - splitX)}
                height={box.height}
              />
            </clipPath>
          </defs>

          {/* Land inside the district, so the outline reads even where there is
              no water at all. */}
          <g clipPath={`url(#clip-district-${uid})`}>
            <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="#e9e4db" />

            {/* BEFORE: normal water plus the baseline cycle's flood. */}
            <Rasters layers={beforeLayers} />

            {/* AFTER: the same, at this district's peak, revealed by the split. */}
            <g clipPath={`url(#clip-after-${uid})`}>
              <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="#e9e4db" />
              <Rasters layers={afterLayers} />
            </g>
          </g>

          <path
            d={path}
            fill="none"
            stroke="#0b1220"
            strokeWidth={1.4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={splitX} y1={box.y} x2={splitX} y2={box.y + box.height}
            stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Labels and the handle live in HTML so they stay a readable size at
            any viewBox scale. */}
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-ink-900/85 px-2 py-1 text-[11px] font-bold text-text">
          {t("district.compare.before")} · {formatShortDate(before, lang)}
          {beforePct !== null && (
            <span className="num ml-1.5 text-text-dim">{formatPercent(beforePct, lang, 0)}</span>
          )}
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-ink-900/85 px-2 py-1 text-[11px] font-bold text-text">
          {t("district.compare.after")} · {formatShortDate(after, lang)}
          {afterPct !== null && (
            <span className="num ml-1.5 text-flood-2">{formatPercent(afterPct, lang, 0)}</span>
          )}
        </span>

        <button
          type="button"
          role="slider"
          aria-label={t("district.compare.aria")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(split)}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragging(true);
          }}
          className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize
                     place-items-center rounded-full border-2 border-white bg-ink-900/90
                     text-white shadow-[0_6px_20px_-6px_#000] transition hover:bg-ink-800"
          style={{ left: `${split}%` }}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none"
            stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="m10 7-5 5 5 5M14 7l5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
