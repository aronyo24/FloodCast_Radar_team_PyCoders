"use client";

/**
 * District click panel (F5).
 *
 * Shows the selected district's numbers for the current cycle plus a sparkline
 * of its whole season, and links through to the full district page. The
 * not-observed and partly-observed states are first-class, not error states:
 * missing coverage is the most common way a flood map misleads people.
 */

import Link from "next/link";

import { floodClass, isLowCoverage } from "@/lib/colors";
import { formatArea, formatPercent, formatShortDate } from "@/lib/format";
import { divisionName, regimeLabel } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import type {
  CycleSummary,
  District,
  DistrictCycleStat,
  DistrictTimeline,
  Meta,
} from "@/types/floodwatch";

import { ArrowRight } from "./Icons";
import { InfoTip } from "./InfoTip";
import { Sparkline } from "./Sparkline";

function Figure({
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
    <div className="panel-flat px-3 py-2.5">
      <div className="flex items-start justify-between gap-1">
        <p className="eyebrow leading-tight">{label}</p>
        {hint && <InfoTip label={hint} />}
      </div>
      <p
        className="num mt-1 text-[19px] font-extrabold leading-none"
        style={{ color: accent ?? "var(--color-text)" }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-text-faint">{sub}</p>}
    </div>
  );
}

export function DistrictPanel({
  district,
  stat,
  timeline,
  cycle,
  meta,
  onOpenRisk,
}: {
  onOpenRisk?: () => void;
  district: District | null;
  stat: DistrictCycleStat | undefined;
  timeline: DistrictTimeline | null;
  cycle: CycleSummary | null;
  meta: Meta | null;
}) {
  const { t, lang } = useLanguage();

  if (!district) {
    return (
      <div className="flex h-full flex-col justify-center px-1 py-6 text-center">
        <p className="text-[14px] font-bold text-text">{t("panel.empty.title")}</p>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[12px] leading-relaxed text-text-faint">
          {t("panel.empty.body")}
        </p>
      </div>
    );
  }

  const observed = stat?.observed ?? false;
  const pct = observed ? stat?.flooded_pct ?? null : null;
  const cls = floodClass(pct);
  const low = isLowCoverage(stat?.coverage_pct, meta?.low_coverage_pct ?? 50);
  const name = lang === "bn" ? district.name_bn : district.name_en;

  const series = timeline?.series ?? [];
  const values = series.map((s) => (s.observed ? s.flooded_pct : null));
  const highlight = cycle ? series.findIndex((s) => s.date === cycle.date) : -1;

  return (
    <div className="flex h-full flex-col gap-3 fw-enter">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-extrabold leading-tight text-text">
              {name}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-text-faint">
              {t("district.division", { name: divisionName(district.division, lang) })}
              {" · "}
              {regimeLabel(district.regime, lang)}
            </p>
          </div>
          {observed && (
            <span
              className="num shrink-0 rounded-lg px-2.5 py-1 text-[15px] font-extrabold"
              style={{ background: cls?.color, color: cls?.ink }}
            >
              {formatPercent(pct, lang, 0)}
            </span>
          )}
        </div>
      </div>

      {!observed ? (
        <div className="panel-flat border-amber-500/30 bg-amber-500/[0.07] px-3 py-3">
          <p className="text-[12.5px] font-bold text-amber-200">
            {t("panel.notObserved.title")}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-100/70">
            {t("panel.notObserved.body")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Figure
              label={t("panel.floodedArea")}
              value={`${formatArea(stat!.flooded_km2, lang)}`}
              sub={t("common.km2")}
              accent={cls?.color}
            />
            <Figure
              label={t("panel.coverage")}
              value={formatPercent(stat!.coverage_pct, lang, 0)}
              sub={low ? t("common.partlyObserved") : undefined}
              hint={t("panel.coverage.hint")}
              accent={low ? "var(--color-warning)" : undefined}
            />
            <Figure
              label={t("panel.area")}
              value={formatArea(district.area_km2, lang)}
              sub={t("common.km2")}
            />
            <Figure
              label={t("panel.seasonPeak")}
              value={formatPercent(district.peak_flooded_pct, lang, 0)}
              sub={
                district.peak_cycle
                  ? formatShortDate(district.peak_cycle, lang)
                  : undefined
              }
            />
          </div>

          {low && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-2.5 py-2
                          text-[11.5px] leading-relaxed text-amber-100/80">
              {t("panel.partly", {
                pct: formatPercent(stat!.coverage_pct, lang, 0),
              })}
            </p>
          )}
        </>
      )}

      {values.length > 0 && (
        <div className="panel-flat px-3 py-2.5">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="eyebrow">{t("district.timeline.title")}</p>
            <span className="num text-[10.5px] text-text-faint">
              {formatPercent(Math.max(...values.map((v) => v ?? 0)), lang, 0)} max
            </span>
          </div>
          <Sparkline
            values={values}
            highlight={highlight >= 0 ? highlight : undefined}
            color={cls?.color ?? "#38bdf8"}
          />
          <div className="flex justify-between text-[10px] text-text-faint">
            <span>{series[0] && formatShortDate(series[0].date, lang)}</span>
            <span>
              {series.at(-1) && formatShortDate(series.at(-1)!.date, lang)}
            </span>
          </div>
        </div>
      )}

      {onOpenRisk && (
        <button
          type="button"
          onClick={onOpenRisk}
          className="tap mt-auto flex items-center justify-center gap-2 rounded-xl bg-accent text-[13px]
                     font-extrabold text-ink-900 transition hover:bg-sky-300"
        >
          {t("risk.title")}
          <ArrowRight className="size-4" />
        </button>
      )}

      <Link
        href={`/district/${district.id}`}
        className={`tap ${onOpenRisk ? "" : "mt-auto "}flex items-center justify-center gap-2 rounded-xl border
                   border-ink-600 bg-ink-800 text-[13px] font-bold text-text
                   transition hover:border-accent-dim hover:bg-ink-700`}
      >
        {t("panel.openFull")}
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
