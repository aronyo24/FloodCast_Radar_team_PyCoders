"use client";

/**
 * The two district-page charts: flooded share through the season, and how much
 * of the district each radar pass actually saw.
 *
 * Unobserved cycles are drawn as gaps in the flood line (Chart.js `spanGaps`
 * is deliberately off) and as an obvious empty bar in the coverage chart. A
 * zero would read as "no flooding", which is a different and wrong claim.
 */

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
  type ChartOptions,
  type ScriptableContext,
} from "chart.js";
import { useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";

import { floodColor } from "@/lib/colors";
import { formatArea, formatPercent, formatShortDate } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { DistrictCycleStat, Meta } from "@/types/floodwatch";

ChartJS.register(
  LineController,
  LineElement,
  BarController,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  ChartTooltip,
);

const GRID = "#1e3048";
const TEXT = "#7589a6";

type Row = { date: string; label: string; index: number } & DistrictCycleStat;

export function DistrictSeasonChart({
  series,
  meta,
}: {
  series: Row[];
  meta: Meta;
}) {
  const { t, lang } = useLanguage();

  const data = useMemo(
    () => ({
      labels: series.map((r) => formatShortDate(r.date, lang)),
      datasets: [
        {
          data: series.map((r) => (r.observed ? r.flooded_pct : null)),
          borderColor: "#ef3b2c",
          borderWidth: 2.4,
          tension: 0.3,
          fill: true,
          spanGaps: false,
          backgroundColor: (ctx: ScriptableContext<"line">) => {
            const { chart } = ctx;
            if (!chart.chartArea) return "#ef3b2c22";
            const g = chart.ctx.createLinearGradient(
              0, chart.chartArea.top, 0, chart.chartArea.bottom,
            );
            g.addColorStop(0, "#ef3b2c66");
            g.addColorStop(1, "#ef3b2c05");
            return g;
          },
          pointRadius: 4,
          pointBackgroundColor: (ctx: ScriptableContext<"line">) =>
            floodColor(series[ctx.dataIndex]?.flooded_pct),
          pointBorderColor: "#0b1220",
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
        },
      ],
    }),
    [series, lang],
  );

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0b1220f2",
          borderColor: "#2a3f5c",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => {
              const row = series[ctx.dataIndex];
              if (!row?.observed) return t("common.notObserved");
              return [
                `${formatPercent(row.flooded_pct, lang)} ${t("panel.flooded").toLowerCase()}`,
                `${formatArea(row.flooded_km2, lang)} ${t("common.km2")}`,
                `${t("panel.coverage")}: ${formatPercent(row.coverage_pct, lang, 0)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: GRID, drawTicks: false },
          border: { color: GRID },
          ticks: { color: TEXT, font: { size: 10.5 }, maxRotation: 0, autoSkipPadding: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: GRID, drawTicks: false },
          border: { display: false },
          ticks: {
            color: TEXT,
            font: { size: 10.5 },
            maxTicksLimit: 5,
            callback: (v) => `${v}%`,
          },
        },
      },
    }),
    [series, lang, t],
  );

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="eyebrow">{t("district.timeline.title")}</p>
        <p className="text-[11px] text-text-faint">{t("district.timeline.sub")}</p>
      </div>
      <div className="h-[210px]">
        <Line data={data} options={options} />
      </div>
      <p className="mt-1.5 text-[11px] text-text-faint">
        {t("panel.coverage.hint")} {t("common.source")}: {meta.distributor}.
      </p>
    </div>
  );
}

export function DistrictCoverageChart({ series }: { series: Row[] }) {
  const { t, lang } = useLanguage();

  const data = useMemo(
    () => ({
      labels: series.map((r) => formatShortDate(r.date, lang)),
      datasets: [
        {
          data: series.map((r) => r.coverage_pct),
          backgroundColor: series.map((r) =>
            !r.observed ? "#334155" : r.coverage_pct < 50 ? "#f59e0b" : "#2563eb",
          ),
          borderRadius: 3,
          barPercentage: 0.78,
        },
      ],
    }),
    [series, lang],
  );

  const options = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0b1220f2",
          borderColor: "#2a3f5c",
          borderWidth: 1,
          padding: 9,
          displayColors: false,
          callbacks: {
            label: (ctx) => {
              const row = series[ctx.dataIndex];
              if (!row?.observed) return t("common.notObserved");
              return `${formatPercent(row.coverage_pct, lang, 0)} ${t(
                "panel.coverage",
              ).toLowerCase()}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: GRID },
          ticks: { color: TEXT, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 8 },
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: GRID, drawTicks: false },
          border: { display: false },
          ticks: { color: TEXT, font: { size: 10 }, stepSize: 50, callback: (v) => `${v}%` },
        },
      },
    }),
    [series, lang, t],
  );

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="eyebrow">{t("district.coverage.title")}</p>
        <p className="text-[11px] text-text-faint">{t("district.coverage.sub")}</p>
      </div>
      <div className="h-[130px]">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
