"use client";

/**
 * One district in depth: timeline, flood overlay comparison, coverage.
 * The "Provisional NISAR data" badge is required on this page as well as the
 * Explorer, per the acceptance checklist.
 */

import Link from "next/link";

import { floodClass } from "@/lib/colors";
import {
  formatArea,
  formatLongDate,
  formatNumber,
  formatPercent,
  formatShortDate,
} from "@/lib/format";
import { divisionName, regimeLabel } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import { overlayLayers } from "@/lib/overlays";
import type {
  CycleOverlay,
  District,
  DistrictCycleStat,
  DistrictFeature,
  Meta,
  OverlayItem,
} from "@/types/floodwatch";

import { ProvenanceBadges } from "./Badges";
import { DistrictFieldReports } from "./bmd/DistrictFieldReports";
import { BeforeAfter } from "./BeforeAfter";
import { DistrictCoverageChart, DistrictSeasonChart } from "./DistrictCharts";
import { ChevronLeft } from "./Icons";
import { InfoTip } from "./InfoTip";

type Row = { date: string; label: string; index: number } & DistrictCycleStat;

interface Props {
  district: District;
  feature: DistrictFeature;
  series: Row[];
  /** Overlay fields per cycle date, for the before/after comparison. */
  overlays: Record<string, { overlay: CycleOverlay; overlays: OverlayItem[] | null }>;
  meta: Meta;
  rank: number | null;
  rankedTotal: number;
  neighbours: Array<{
    id: string;
    name_en: string;
    name_bn: string;
    flooded_pct: number | null;
  }>;
}

function Stat({
  label,
  value,
  sub,
  hint,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-1">
        <p className="eyebrow leading-tight">{label}</p>
        {hint && <InfoTip label={hint} />}
      </div>
      <p
        className="num mt-2 text-balance text-[21px] font-extrabold leading-tight sm:text-[24px]"
        style={{ color: accent ?? "var(--color-text)" }}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-text-faint">{sub}</p>}
    </div>
  );
}

export function DistrictClient({
  district,
  feature,
  series,
  overlays,
  meta,
  rank,
  rankedTotal,
  neighbours,
}: Props) {
  const { t, lang } = useLanguage();

  const latest = series.find((s) => s.date === meta.latest_cycle) ?? series.at(-1);
  const observed = latest?.observed ?? false;
  const pct = observed ? latest?.flooded_pct ?? null : null;
  const cls = floodClass(pct);
  const name = lang === "bn" ? district.name_bn : district.name_en;

  const baseline = district.baseline_cycle ?? series[0]?.date ?? null;
  const peak = district.peak_cycle ?? null;
  const baselinePct =
    series.find((s) => s.date === baseline)?.flooded_pct ?? null;

  return (
    <div className="shell space-y-4 py-5">
      <Link
        href="/explorer"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold
                   text-text-dim transition hover:text-text"
      >
        <ChevronLeft className="size-4" />
        {t("district.back")}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-text sm:text-[38px]">
            {name}
          </h1>
          <p className="mt-1 text-[13px] text-text-dim">
            {t("district.division", { name: divisionName(district.division, lang) })}
            {" · "}
            {regimeLabel(district.regime, lang)}
            {lang === "bn" && (
              <span className="ml-2 text-text-faint">{district.name_en}</span>
            )}
          </p>
        </div>
        <ProvenanceBadges demo={meta.demo_data} provisional={meta.provisional} />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`${t("panel.flooded")} · ${t("district.latestCycle")}`}
          value={observed ? formatPercent(pct, lang) : t("common.notObserved")}
          sub={
            observed
              ? `${formatArea(latest!.flooded_km2, lang)} ${t("common.km2")} · ${formatShortDate(
                  latest!.date,
                  lang,
                )}`
              : t("panel.notObserved.body")
          }
          accent={observed ? cls?.color : "var(--color-text-faint)"}
        />
        <Stat
          label={t("panel.seasonPeak")}
          value={formatPercent(district.peak_flooded_pct, lang)}
          sub={
            peak
              ? `${formatArea(district.peak_flooded_km2 ?? 0, lang)} ${t(
                  "common.km2",
                )} · ${formatLongDate(peak, lang)}`
              : undefined
          }
          accent={floodClass(district.peak_flooded_pct)?.color}
        />
        <Stat
          label={t("panel.area")}
          value={`${formatArea(district.area_km2, lang)} ${t("common.km2")}`}
          sub={`${t("panel.permanentWater")} ${formatArea(
            district.permanent_water_km2,
            lang,
          )} ${t("common.km2")}`}
        />
        <Stat
          label={t("panel.rank")}
          value={
            rank === null
              ? "—"
              : `${formatNumber(rank, lang)} / ${formatNumber(rankedTotal, lang)}`
          }
          sub={`${t("common.cycle")} ${formatShortDate(meta.latest_cycle, lang)}`}
          hint={t("cards.worstDistrict.hint")}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="panel p-4">
          {baseline && peak ? (
            <BeforeAfter
              feature={feature}
              before={baseline}
              after={peak}
              beforeLayers={overlayLayers(overlays[baseline]?.overlay, overlays[baseline]?.overlays, meta)}
              afterLayers={overlayLayers(overlays[peak]?.overlay, overlays[peak]?.overlays, meta)}
              beforePct={baselinePct}
              afterPct={district.peak_flooded_pct}
            />
          ) : (
            <p className="py-10 text-center text-[13px] text-text-faint">
              {t("common.notObserved")}
            </p>
          )}
        </section>

        <div className="grid gap-4 content-start">
          <section className="panel p-4">
            <DistrictSeasonChart series={series} meta={meta} />
          </section>
          <section className="panel p-4">
            <DistrictCoverageChart series={series} />
          </section>
        </div>
      </div>

      <section className="panel p-4">
        <p className="eyebrow mb-3">{t("district.nearby")}</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {neighbours.map((n) => {
            const c = floodClass(n.flooded_pct);
            return (
              <li key={n.id}>
                <Link
                  href={`/district/${n.id}`}
                  className="panel-flat flex items-center justify-between gap-2 px-3 py-2.5
                             transition hover:border-accent-dim"
                >
                  <span className="truncate text-[13px] font-semibold text-text">
                    {lang === "bn" ? n.name_bn : n.name_en}
                  </span>
                  <span
                    className="num shrink-0 rounded px-1.5 py-0.5 text-[11px] font-extrabold"
                    style={{
                      background: n.flooded_pct === null ? "#334155" : c?.color,
                      color: n.flooded_pct === null ? "#cbd5e1" : c?.ink,
                    }}
                  >
                    {n.flooded_pct === null ? "—" : formatPercent(n.flooded_pct, lang, 0)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <DistrictFieldReports
        districtId={district.id}
        districtLabel={lang === "bn" ? district.name_bn : district.name_en}
      />

      <p className="pb-2 text-[11px] text-text-faint">
        {meta.product} · {meta.distributor} · {t("common.source")}:{" "}
        {meta.boundaries.name} ({meta.boundaries.licence})
      </p>
    </div>
  );
}
