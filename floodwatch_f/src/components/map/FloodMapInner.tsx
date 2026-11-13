"use client";

/**
 * The district map (F1), the radar overlay (F8) and the partly-observed
 * hatching (F12).
 *
 * Leaflet 1.9 with L.geoJSON for the districts and L.imageOverlay for the
 * rasters, exactly as the Frontend Plan specifies. There is deliberately no
 * tile layer by default: the demo has to run with the wifi off, so the land is
 * drawn from the local boundary file onto a plain sea-coloured canvas. The
 * street basemap is an opt-in toggle that says it needs the internet.
 */

import "leaflet/dist/leaflet.css";

import type {
  GeoJSON as LeafletGeoJSON,
  LeafletMouseEvent,
  Path as LeafletPath,
  PathOptions,
} from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  GeoJSON,
  ImageOverlay,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";

import { floodColor, isLowCoverage, NOT_OBSERVED, RISK_FILL } from "@/lib/colors";
import { formatArea, formatPercent } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import { overlayLayers } from "@/lib/overlays";
import type {
  CycleDetail,
  DistrictCollection,
  DistrictFeature,
  DistrictId,
  Meta,
  RiskMap,
} from "@/types/floodwatch";

const BD_CENTER: [number, number] = [23.75, 90.4];
const PAD: [number, number] = [18, 18];

export interface FloodMapProps {
  districts: DistrictCollection;
  cycle: CycleDetail | null;
  meta: Meta;
  selected: DistrictId | null;
  onSelect: (id: DistrictId | null) => void;
  showOverlay: boolean;
  showBasemap: boolean;
  /** "flood": colour by flooded share. "risk": colour by the 12-day outlook. */
  mode?: "flood" | "risk";
  risk?: RiskMap | null;
}

/** Keeps the viewport honest: fit the country, zoom to a chosen district. */
function Viewport({
  districts,
  selected,
}: {
  districts: DistrictCollection;
  selected: DistrictId | null;
}) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    const b = bboxOfAll(districts);
    map.fitBounds(b, { padding: PAD });
    // Never let the user pan off into empty ocean.
    map.setMaxBounds([
      [b[0][0] - 2.2, b[0][1] - 2.2],
      [b[1][0] + 2.2, b[1][1] + 2.2],
    ]);
    map.setMinZoom(map.getZoom() - 0.6);
  }, [map, districts]);

  useEffect(() => {
    if (!selected) return;
    const feature = districts.features.find((f) => f.properties.id === selected);
    if (!feature) return;
    const [w, s, e, n] = feature.properties.bbox;
    // Capped: past zoom 9 the overlay raster is magnified so far that the
    // district fills the screen with a handful of sensor pixels. Generous
    // padding keeps the neighbours visible, which is how you tell whether a
    // flood stops at the district line or carries on across it.
    map.flyToBounds(
      [
        [s, w],
        [n, e],
      ],
      { padding: [70, 70], duration: 0.65, maxZoom: 8.5 },
    );
  }, [map, selected, districts]);

  return null;
}

/**
 * Keeps the 64 district shapes out of the tab order.
 *
 * Chrome puts every interactive SVG shape into sequential focus navigation, so
 * the map inserts 64 unlabelled tab stops between the stat cards and the
 * slider - a keyboard user would have to press Tab seventy times to reach the
 * play button. The accessible route to a district is the ranking list and the
 * search box, both of which are properly labelled, so the shapes are removed
 * from the sequence. They stay clickable, and the map container itself remains
 * focusable for Leaflet's own arrow-key panning.
 */
function ShapeFocus({ label }: { label: string }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute("aria-label", label);

    const strip = () => {
      container
        .querySelectorAll<SVGPathElement>("path.fw-district")
        .forEach((el) => el.setAttribute("tabindex", "-1"));
    };

    strip();
    // Leaflet re-creates paths when the SVG renderer redraws.
    map.on("zoomend moveend", strip);
    return () => {
      map.off("zoomend moveend", strip);
    };
  }, [map, label]);

  return null;
}

function bboxOfAll(
  districts: DistrictCollection,
): [[number, number], [number, number]] {
  let w = 180, s = 90, e = -180, n = -90;
  for (const f of districts.features) {
    const [fw, fs, fe, fn] = f.properties.bbox;
    w = Math.min(w, fw);
    s = Math.min(s, fs);
    e = Math.max(e, fe);
    n = Math.max(n, fn);
  }
  return [
    [s, w],
    [n, e],
  ];
}

export default function FloodMapInner({
  districts,
  cycle,
  meta,
  selected,
  onSelect,
  showOverlay,
  showBasemap,
  mode = "flood",
  risk = null,
}: FloodMapProps) {
  const { t, lang } = useLanguage();
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  // Memoised so the style and tooltip closures below only change when the
  // cycle actually changes, not on every render of the parent.
  const stats = useMemo(() => cycle?.districts ?? {}, [cycle]);

  /**
   * Leaflet caches the style function from when the layer was created, so the
   * recolour on every slider move has to be pushed with setStyle rather than by
   * re-rendering the GeoJSON component - re-creating 64 polygons per frame
   * would make the play animation stutter.
   */
  const styleFor = useMemo(
    () =>
      (feature?: DistrictFeature): PathOptions => {
        const id = feature?.properties.id;
        const stat = id ? stats[id] : undefined;
        const observed = stat?.observed ?? false;
        const pct = observed ? stat?.flooded_pct ?? null : null;
        const low = isLowCoverage(stat?.coverage_pct, meta.low_coverage_pct);
        const isSelected = id === selected;

        if (mode === "risk") {
          const r = id && risk ? risk[id] : undefined;
          return {
            fillColor: r ? RISK_FILL[r.level].color : NOT_OBSERVED.color,
            fillOpacity: r ? 0.9 : 0.6,
            color: isSelected ? "#0b1220" : "#ffffff",
            weight: isSelected ? 2.6 : 0.7,
            opacity: isSelected ? 1 : 0.8,
            className: "fw-district",
          };
        }

        return {
          fillColor: observed ? floodColor(pct) : NOT_OBSERVED.color,
          fillOpacity: observed ? 0.92 : 0.78,
          color: isSelected ? "#0b1220" : "#ffffff",
          weight: isSelected ? 2.6 : 0.7,
          opacity: isSelected ? 1 : 0.75,
          // `low` is applied as a class by the effect below, not here: see why.
          className: low ? "fw-district fw-partial" : "fw-district",
        };
      },
    [stats, selected, meta.low_coverage_pct, mode, risk],
  );

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.setStyle(styleFor as never);

    /*
     * Leaflet fixes `className` when it creates the <path> and `setStyle` never
     * revisits it, so the partly-observed hatch (F12) would be frozen at
     * whatever the first cycle happened to be. Toggling the class directly is
     * the only way to keep it in step with the slider.
     */
    group.eachLayer((layer) => {
      const path = layer as LeafletPath & { feature?: DistrictFeature };
      const el = path.getElement?.() as SVGPathElement | undefined;
      if (!el) return;
      const stat = path.feature ? stats[path.feature.properties.id] : undefined;
      el.classList.toggle(
        "fw-partial",
        mode === "flood" &&
          Boolean(stat?.observed) &&
          isLowCoverage(stat?.coverage_pct, meta.low_coverage_pct),
      );
      el.setAttribute("tabindex", "-1"); // see ShapeFocus
    });
  }, [styleFor, stats, meta.low_coverage_pct, mode]);

  const tooltipFor = (feature: DistrictFeature): string => {
    const p = feature.properties;
    const stat = stats[p.id];
    const name = lang === "bn" ? p.name_bn : p.name_en;
    const rows: string[] = [];
    const r = risk?.[p.id];
    if (mode === "risk" && r) {
      rows.push(
        `<div class="fw-tooltip-row">${escapeHtml(t("risk.chance"))}: ` +
          `<span class="fw-tooltip-value">${escapeHtml(formatPercent(r.probability, lang, 0))}</span>` +
          ` · ${escapeHtml(t(`risk.level.${r.level}`))}</div>`,
      );
    }

    if (!stat?.observed) {
      rows.push(
        `<div class="fw-tooltip-row fw-tooltip-warn">${escapeHtml(t("common.notObserved"))}</div>`,
      );
    } else {
      rows.push(
        `<div class="fw-tooltip-row">${escapeHtml(t("panel.flooded"))}: ` +
          `<span class="fw-tooltip-value">${escapeHtml(formatPercent(stat.flooded_pct, lang))}</span>` +
          ` · ${escapeHtml(formatArea(stat.flooded_km2, lang))} ${escapeHtml(t("common.km2"))}</div>`,
      );
      const low = isLowCoverage(stat.coverage_pct, meta.low_coverage_pct);
      rows.push(
        `<div class="fw-tooltip-row${low ? " fw-tooltip-warn" : ""}">` +
          `${escapeHtml(t("panel.coverage"))}: ${escapeHtml(formatPercent(stat.coverage_pct, lang, 0))}` +
          `${low ? ` — ${escapeHtml(t("common.partlyObserved"))}` : ""}</div>`,
      );
    }

    return `<div class="fw-tooltip-name">${escapeHtml(name)}</div>${rows.join("")}`;
  };

  // Tooltips are bound once by onEachFeature; keep their text in step with the
  // slider, the map mode and the language.
  const tooltipRef = useRef(tooltipFor);
  useEffect(() => {
    tooltipRef.current = tooltipFor;
  });
  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      const path = layer as LeafletPath & { feature?: DistrictFeature };
      if (path.feature) path.setTooltipContent(tooltipRef.current(path.feature));
    });
  }, [stats, risk, mode, lang]);

  return (
    <>
      {/* The hatch used for partly-observed districts. Lives in the document so
          Leaflet's generated <path> elements can reference it by id from CSS. */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <pattern
            id="fw-hatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="7" height="7" fill={NOT_OBSERVED.color} />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#64748b" strokeWidth="3" />
          </pattern>
        </defs>
      </svg>

      <MapContainer
        center={BD_CENTER}
        zoom={7}
        zoomSnap={0.25}
        zoomDelta={0.5}
        minZoom={5}
        maxZoom={11}
        scrollWheelZoom
        attributionControl
        className="size-full"
      >
        <Viewport districts={districts} selected={selected} />
        <ShapeFocus label={t("map.aria")} />

        {showBasemap && (
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            opacity={0.55}
          />
        )}

        <GeoJSON
          ref={layerRef as never}
          data={districts as never}
          style={styleFor as never}
          onEachFeature={(feature, layer) => {
            const f = feature as unknown as DistrictFeature;
            layer.bindTooltip(tooltipFor(f), {
              sticky: true,
              direction: "top",
              className: "fw-tooltip",
              opacity: 1,
            });
            layer.on({
              click: () => onSelect(f.properties.id),
              mouseover: (e: LeafletMouseEvent) => {
                e.target.setStyle({ weight: 2.2, opacity: 1 });
                e.target.bringToFront();
              },
              mouseout: (e: LeafletMouseEvent) => {
                if (f.properties.id !== selected) {
                  e.target.setStyle({ weight: 0.7, opacity: 0.75 });
                }
              },
              keydown: (e: { originalEvent: KeyboardEvent }) => {
                if (e.originalEvent.key === "Enter" || e.originalEvent.key === " ") {
                  onSelect(f.properties.id);
                }
              },
            });
          }}
        />

        {showOverlay &&
          cycle &&
          overlayLayers(cycle.overlay, cycle.overlays, meta).map((layer) => (
            <ImageOverlay
              // Keyed by URL so Leaflet swaps the image when the cycle changes.
              key={`${layer.kind}:${layer.url}`}
              url={layer.url}
              bounds={layer.bounds}
              opacity={layer.kind === "water" ? 0.65 : 0.8}
              zIndex={layer.kind === "water" ? 450 : 460}
            />
          ))}
      </MapContainer>
    </>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
