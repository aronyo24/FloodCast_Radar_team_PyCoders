"use client";

/**
 * The Flood Explorer - where 90% of the demo happens.
 *
 * Layout follows section 4 of the Frontend Plan: alert strip, four key numbers,
 * map with the ranking beside it, slider under the map, national timeline
 * across the bottom. On a phone it stacks in that same order.
 *
 * Data strategy: the cycle index and the district geometry load once, then all
 * twelve cycles are fetched in the background and cached. The play animation
 * and the slider therefore never wait on the network, while each cycle is still
 * fetched from its own `/api/cycles/<date>/` endpoint exactly as the Backend
 * Plan defines it.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getAlerts,
  getCycle,
  getCycles,
  getDistricts,
  getDistrictTimeline,
  getNational,
  getRiskAll,
  type CyclesIndex,
} from "@/lib/api";
import { useLanguage } from "@/lib/language";
import type {
  Alert,
  CycleDetail,
  DistrictCollection,
  DistrictId,
  DistrictTimeline,
  Meta,
  NationalSeries,
  RiskMap,
  RiskSummaryResponse,
} from "@/types/floodwatch";

import { AlertBanner } from "./AlertBanner";
import { ProvenanceBadges } from "./Badges";
import { CycleSlider } from "./CycleSlider";
import { DistrictPanel } from "./DistrictPanel";
import { ExplorerActions } from "./ExplorerActions";
import { LayersIcon } from "./Icons";
import { InfoTip } from "./InfoTip";
import { Legend } from "./Legend";
import { StatCards } from "./StatCards";
import { FloodMap } from "./map/FloodMap";
import { NationalTimeline } from "./NationalTimeline";
import { RiskDrawer } from "./RiskDrawer";
import { MapModeSwitch, RiskLegend, RiskRanking, RiskSummary, type MapMode } from "./RiskViews";
import { TopRanking } from "./TopRanking";

export function ExplorerClient({ meta }: { meta: Meta }) {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();

  const [index, setIndex] = useState<CyclesIndex | null>(null);
  const [districts, setDistricts] = useState<DistrictCollection | null>(null);
  const [national, setNational] = useState<NationalSeries | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [timeline, setTimeline] = useState<DistrictTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cycleIndex, setCycleIndex] = useState(0);
  const [selected, setSelected] = useState<DistrictId | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showBasemap, setShowBasemap] = useState(false);
  /** The right-hand risk drawer. Opens on a deliberate pick, not on page load. */
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDistrict = useCallback((id: DistrictId | null) => {
    setSelected(id);
    setDrawerOpen(id !== null);
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [mapMode, setMapMode] = useState<MapMode>("flood");
  const [riskAll, setRiskAll] = useState<RiskSummaryResponse | null>(null);

  /**
   * date -> detail. Held in state so render reads it directly; a ref tracks
   * which dates have already been asked for, which is bookkeeping rather than
   * rendered data and so is never read during render.
   */
  const [cycleCache, setCycleCache] = useState<Record<string, CycleDetail>>({});
  const requested = useRef(new Set<string>());

  // ---- initial load ----------------------------------------------------
  useEffect(() => {
    let alive = true;
    Promise.all([getCycles(), getDistricts(), getNational()])
      .then(([cycles, geo, nat]) => {
        if (!alive) return;
        setIndex(cycles);
        setDistricts(geo);
        setNational(nat);
        // Open on the latest cycle - the question an operational tool answers
        // first is "what is happening now", not "what happened in June".
        // A shared link (F15) overrides both the cycle and the district.
        const wantCycle = params.get("cycle");
        const found = cycles.cycles.findIndex((c) => c.date === wantCycle);
        setCycleIndex(found >= 0 ? found : cycles.cycles.length - 1);

        if (params.get("view") === "risk") setMapMode("risk");

        const wantDistrict = params.get("district");
        if (wantDistrict && geo.features.some((f) => f.properties.id === wantDistrict)) {
          setSelected(wantDistrict);
          // A link to a district (from an alert e-mail or the home page) is a
          // request to see its outlook.
          setDrawerOpen(true);
        }
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
    // Reading the URL once on mount is intentional; later changes are pushed
    // by this component, so re-running would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycles = useMemo(() => index?.cycles ?? [], [index]);
  const currentSummary = cycles[cycleIndex] ?? null;
  const currentDate = currentSummary?.date ?? null;

  // ---- cycle details, cached ------------------------------------------
  /**
   * Fetch the selected cycle first, then walk the rest of the season one at a
   * time so Play never waits on the network. Each date is requested at most
   * once; re-selecting a cycle just re-prioritises the walk.
   */
  useEffect(() => {
    if (cycles.length === 0 || !currentDate) return;
    let cancelled = false;

    const order = [
      currentDate,
      ...cycles.map((c) => c.date).filter((d) => d !== currentDate),
    ];

    const step = (i: number): void => {
      if (cancelled || i >= order.length) return;
      const date = order[i];
      if (requested.current.has(date)) {
        step(i + 1);
        return;
      }
      requested.current.add(date);
      getCycle(date)
        .then((detail) => {
          if (!cancelled) setCycleCache((prev) => ({ ...prev, [date]: detail }));
        })
        .catch(() => {
          // One missing cycle must not take the page down: the map keeps its
          // previous colours and the slider still works. Forget the request so
          // a later attempt can retry it.
          requested.current.delete(date);
        })
        .finally(() => step(i + 1));
    };

    step(0);
    return () => {
      cancelled = true;
    };
  }, [cycles, currentDate]);

  const currentCycle = currentDate ? cycleCache[currentDate] ?? null : null;

  // ---- risk outlook for every district, following the slider ---------------
  useEffect(() => {
    if (!currentDate) return;
    let alive = true;
    getRiskAll(currentDate)
      .then((r) => alive && setRiskAll(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [currentDate]);

  const riskForCycle = riskAll && riskAll.cycle === currentDate ? riskAll : null;
  const riskMap = useMemo<RiskMap | null>(
    () =>
      riskForCycle
        ? Object.fromEntries(
            riskForCycle.districts.map((d) => [d.district.id, { probability: d.probability, level: d.level }]),
          )
        : null,
    [riskForCycle],
  );

  // ---- alerts follow the selected cycle --------------------------------
  useEffect(() => {
    if (!currentDate) return;
    let alive = true;
    getAlerts(currentDate)
      .then((r) => alive && setAlerts(r.alerts))
      .catch(() => alive && setAlerts([]));
    return () => {
      alive = false;
    };
  }, [currentDate]);

  // ---- the selected district's season -----------------------------------
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    getDistrictTimeline(selected)
      .then((r) => alive && setTimeline(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [selected]);

  // Derive rather than clearing state in an effect: a timeline left over from
  // the previously selected district must never be shown against this one.
  const activeTimeline =
    timeline && timeline.district.id === selected ? timeline : null;

  // ---- URL state (F15) --------------------------------------------------
  useEffect(() => {
    if (!currentDate) return;
    const next = new URLSearchParams();
    next.set("cycle", currentDate);
    if (selected) next.set("district", selected);
    if (mapMode === "risk") next.set("view", "risk");
    const target = `/explorer?${next.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== target) {
      router.replace(target, { scroll: false });
    }
  }, [currentDate, selected, mapMode, router]);

  // Every GeoJSON feature carries a full district record, so the ranking and
  // the panel both read from the geometry request - no extra round trip.
  const allDistricts = useMemo(
    () => (districts?.features ?? []).map((f) => f.properties),
    [districts],
  );

  const selectedDistrict = useMemo(
    () => allDistricts.find((d) => d.id === selected) ?? null,
    [allDistricts, selected],
  );

  const peakDate = national?.peak?.date ?? null;

  if (error) {
    return (
      <div className="shell py-16">
        <div className="panel mx-auto max-w-lg p-6 text-center">
          <p className="text-[15px] font-bold text-text">{t("common.error")}</p>
          <p className="mt-2 text-[13px] text-text-faint">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="tap mt-4 rounded-lg bg-accent px-4 font-bold text-ink-900"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell space-y-3 py-4 lg:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[20px] font-extrabold tracking-tight text-text sm:text-[24px]">
          {t("nav.explorer")}
        </h1>
        <ProvenanceBadges demo={meta.demo_data} provisional={meta.provisional} />
      </div>

      <AlertBanner
        alerts={alerts}
        cycleDate={currentDate ?? ""}
        meta={meta}
        peakDate={peakDate}
        onSelectDistrict={openDistrict}
        onJumpToPeak={() => {
          const i = cycles.findIndex((c) => c.date === peakDate);
          if (i >= 0) {
            setPlaying(false);
            setCycleIndex(i);
          }
        }}
      />

      <StatCards
        cycle={currentSummary}
        meta={meta}
        onSelectDistrict={openDistrict}
      />

      {/* Map + ranking + panel. On a phone these stack; from `lg` the map takes
          the room and the side column scrolls independently. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel flex flex-col overflow-hidden">
          {/* Bangladesh is a tall country in a wide panel, so the map is given
              real height and the space either side of it is used: layer
              controls top-right, legend bottom-left. Below `sm` both move out
              into the flow, because overlaying them on a 360px map would cover
              the country. */}
          <div className="relative h-[340px] sm:h-[480px] lg:h-[620px] xl:h-[680px]">
            {districts && (
              <FloodMap
                districts={districts}
                cycle={currentCycle}
                meta={meta}
                selected={selected}
                onSelect={openDistrict}
                showOverlay={showOverlay && mapMode === "flood"}
                showBasemap={showBasemap}
                mode={mapMode}
                risk={riskMap}
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
              <div className="pointer-events-auto">
                <MapModeSwitch mode={mapMode} onMode={setMapMode} />
              </div>
            </div>

            <div className="pointer-events-none absolute right-3 top-3 z-[500] hidden w-[210px] sm:block">
              <div className="panel pointer-events-auto space-y-2 p-2.5">
                <p className="eyebrow flex items-center gap-1.5">
                  <LayersIcon className="size-3.5" />
                  {t("overlay.title")}
                </p>
                <Toggle
                  checked={showOverlay}
                  onChange={setShowOverlay}
                  label={t("overlay.show")}
                  hint={t("overlay.hint")}
                />
                <Toggle
                  checked={showBasemap}
                  onChange={setShowBasemap}
                  label={t("overlay.basemap")}
                  hint={t("overlay.basemap.hint")}
                />
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 z-[500] hidden max-w-[300px] sm:block">
              <div className="panel pointer-events-auto p-3">
                {mapMode === "risk" ? <RiskLegend /> : <Legend showOverlay={showOverlay} />}
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-ink-700 p-3 sm:p-4">
            <CycleSlider
              cycles={cycles}
              index={cycleIndex}
              onIndex={setCycleIndex}
              playing={playing}
              onPlaying={setPlaying}
            />
            <div className="space-y-3 border-t border-ink-700 pt-3 sm:hidden">
              <div className="space-y-2">
                <p className="eyebrow flex items-center gap-1.5">
                  <LayersIcon className="size-3.5" />
                  {t("overlay.title")}
                </p>
                <Toggle
                  checked={showOverlay}
                  onChange={setShowOverlay}
                  label={t("overlay.show")}
                  hint={t("overlay.hint")}
                />
                <Toggle
                  checked={showBasemap}
                  onChange={setShowBasemap}
                  label={t("overlay.basemap")}
                  hint={t("overlay.basemap.hint")}
                />
              </div>
              <div className="border-t border-ink-700 pt-3">
                {mapMode === "risk" ? <RiskLegend /> : <Legend showOverlay={showOverlay} />}
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-3 lg:grid-rows-[minmax(260px,1fr)_minmax(0,auto)]">
          <div className="panel flex min-h-0 flex-col p-3 sm:p-4">
            {mapMode === "risk" ? (
              <RiskRanking
                data={riskForCycle}
                selected={selected}
                onSelect={(id) => {
                  setPlaying(false);
                  openDistrict(id);
                }}
              />
            ) : (
              <TopRanking
                cycle={currentCycle}
                districts={allDistricts}
                selected={selected}
                onSelect={(id) => {
                  setPlaying(false);
                  openDistrict(id);
                }}
              />
            )}
          </div>
          <div className="panel p-3 sm:p-4">
            {selectedDistrict ? (
            <DistrictPanel
              district={selectedDistrict}
              stat={selected ? currentCycle?.districts[selected] : undefined}
              timeline={activeTimeline}
              cycle={currentSummary}
              meta={meta}
              onOpenRisk={() => setDrawerOpen(true)}
            />
            ) : (
              <RiskSummary data={riskForCycle} onSelect={openDistrict} />
            )}
          </div>
        </aside>
      </div>

      <section className="panel p-3 sm:p-4">
        <NationalTimeline
          national={national}
          selectedIndex={cycleIndex}
          onSelectIndex={(i) => {
            setPlaying(false);
            setCycleIndex(i);
          }}
        />
      </section>

      <RiskDrawer
        districtId={selected}
        cycle={currentDate}
        timeline={activeTimeline}
        open={drawerOpen && selected !== null}
        onClose={closeDrawer}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        {currentDate && <ExplorerActions cycleDate={currentDate} />}
        <p className="text-[11px] text-text-faint">
          {meta.product} · {meta.distributor}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      {/* The label is the hit area - 44px tall even though the box is 16px. */}
      <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 shrink-0 accent-sky-400"
        />
        <span className="text-[12px] font-semibold leading-tight text-text-dim">
          {label}
        </span>
      </label>
      <InfoTip label={hint} />
    </div>
  );
}
