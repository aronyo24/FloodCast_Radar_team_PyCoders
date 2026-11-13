"use client";

/**
 * National timeline (F4) - Chart.js 4, as the Frontend Plan specifies.
 *
 * Only the pieces of Chart.js that are used get registered, which keeps the
 * bundle well under what `chart.js/auto` would pull in. Clicking a point moves
 * the slider, so the chart is a control and not just a picture.
 */

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend as ChartLegend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
  type ChartOptions,
  type ScriptableContext,
} from "chart.js";
import { useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";

import { formatArea, formatPercent, formatShortDate } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { NationalSeries } from "@/types/floodwatch";

ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  ChartTooltip,
  ChartLegend,
);

const ACCENT = "#38bdf8";
const GRID = "#1e3048";
const TEXT = "#7589a6";

export function NationalTimeline({
  national,
  selectedIndex,
  onSelectIndex,
}: {
  national: NationalSeries | null;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
}) {
  const { t, lang } = useLanguage();
  const chartRef = useRef<ChartJS<"line"> | null>(null);

  const data = useMemo(() => {
    const rows = national?.series ?? [];
    return {
      labels: rows.map((r) => formatShortDate(r.date, lang)),
      datasets: [
        {
          label: t("timeline.axis"),
          data: rows.map((r) => r.flooded_km2),
          borderColor: ACCENT,
          borderWidth: 2.4,
          tension: 0.32,
          fill: true,
          backgroundColor: (ctx: ScriptableContext<"line">) => {
            const { chart } = ctx;
            if (!chart.chartArea) return "#38bdf822";
            const g = chart.ctx.createLinearGradient(
              0,
              chart.chartArea.top,
              0,
              chart.chartArea.bottom,
            );
            g.addColorStop(0, "#38bdf855");
            g.addColorStop(1, "#38bdf803");
            return g;
          },
          // The selected cycle is the only large dot, which is what ties the
          // chart to the slider and the map.
          pointRadius: (ctx: ScriptableContext<"line">) =>
            ctx.dataIndex === selectedIndex ? 6 : 3,
          pointBackgroundColor: (ctx: ScriptableContext<"line">) =>
            ctx.dataIndex === selectedIndex ? "#ffffff" : ACCENT,
          pointBorderColor: ACCENT,
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [national, selectedIndex, lang, t]);

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 320 },
      interaction: { mode: "index", intersect: false },
      onClick: (_e, elements) => {
        if (elements.length > 0) onSelectIndex(elements[0].index);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0b1220f2",
          borderColor: "#2a3f5c",
          borderWidth: 1,
          padding: 10,
          titleFont: { weight: "bold", size: 12 },
          bodyFont: { size: 12 },
          displayColors: false,
          callbacks: {
            label: (ctx) => {
              const row = national?.series[ctx.dataIndex];
              if (!row) return "";
              const lines = [
                `${formatArea(row.flooded_km2, lang)} ${t("common.km2")} — ${formatPercent(
                  row.flooded_pct,
                  lang,
                )}`,
                `${row.districts_observed} / 64 ${t("common.districts")}`,
              ];
              if (row.worst_name_en) lines.push(`${t("cards.worstDistrict")}: ${row.worst_name_en}`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: GRID, drawTicks: false },
          border: { color: GRID },
          ticks: { color: TEXT, font: { size: 10.5 }, maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: GRID, drawTicks: false },
          border: { display: false },
          ticks: {
            color: TEXT,
            font: { size: 10.5 },
            maxTicksLimit: 5,
            callback: (value) => formatArea(Number(value), lang),
          },
        },
      },
    }),
    [national, lang, t, onSelectIndex],
  );

  if (!national) {
    return <div className="fw-skeleton h-[180px]" />;
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="eyebrow">{t("timeline.title")}</p>
        <p className="text-[11px] text-text-faint">{t("timeline.sub")}</p>
      </div>
      <div className="h-[168px] sm:h-[190px]">
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
}
