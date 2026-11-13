"use client";

/**
 * The Explorer's "12-day risk" mode: map switch, legend, ranking and the
 * country-wide summary card.
 */

import { RISK_FILL } from "@/lib/colors";
import { formatNumber, formatPercent } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { DistrictId, RiskLevel, RiskSummaryResponse } from "@/types/floodwatch";

import { AlertSignup } from "./AlertSignup";

export type MapMode = "flood" | "risk";
const LEVELS: RiskLevel[] = ["severe", "high", "moderate", "low"];

export function MapModeSwitch({ mode, onMode }: { mode: MapMode; onMode: (m: MapMode) => void }) {
  const { t } = useLanguage();
  return (
    <div role="radiogroup" aria-label={t("map.mode.label")} className="inline-flex rounded-full border border-ink-500 bg-ink-850/95 p-1 shadow-lg backdrop-blur">
      {(["flood", "risk"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onMode(m)}
          className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition sm:px-4
                      ${mode === m ? "bg-accent text-ink-900 shadow" : "text-text-dim hover:text-text"}`}
        >
          {m === "flood" ? "🌊 " : "⚠ "}
          {t(m === "flood" ? "map.mode.flood" : "map.mode.risk")}
        </button>
      ))}
    </div>
  );
}

export function RiskLegend() {
  const { t } = useLanguage();
  const range: Record<RiskLevel, string> = { low: "0–24%", moderate: "25–44%", high: "45–64%", severe: "65%+" };
  return (
    <div className="space-y-2.5">
      <p className="eyebrow">{t("risk.legend.title")}</p>
      <ul className="grid grid-cols-2 gap-x-3.5 gap-y-2">
        {[...LEVELS].reverse().map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span aria-hidden className="size-3.5 shrink-0 rounded-[3px] ring-1 ring-black/25" style={{ background: RISK_FILL[l].color }} />
            <span className="num text-[11.5px] font-semibold text-text-dim">{range[l]}</span>
            <span className="text-[11.5px] text-text-faint">{t(`risk.level.${l}`)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10.5px] leading-snug text-text-faint">{t("risk.legend.note")}</p>
    </div>
  );
}

export function RiskRanking({
  data,
  selected,
  onSelect,
  limit = 10,
}: {
  data: RiskSummaryResponse | null;
  selected: DistrictId | null;
  onSelect: (id: DistrictId) => void;
  limit?: number;
}) {
  const { t, lang } = useLanguage();
  if (!data) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="fw-skeleton h-9" />
        ))}
      </div>
    );
  }
  const rows = data.districts.slice(0, limit);
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="eyebrow">{t("risk.ranking.title")}</p>
        <p className="text-[11px] text-text-faint">{t("risk.ranking.sub")}</p>
      </div>
      <ol className="min-h-0 flex-1 space-y-[3px] overflow-y-auto pr-1.5">
        {rows.map((r, i) => {
          const active = r.district.id === selected;
          const fill = RISK_FILL[r.level];
          return (
            <li key={r.district.id}>
              <button
                type="button"
                onClick={() => onSelect(r.district.id)}
                aria-current={active ? "true" : undefined}
                className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2 py-1.5 text-left transition
                            ${active ? "bg-accent-deep/50 ring-1 ring-accent/50" : "hover:bg-ink-700/70"}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-lg opacity-25 transition-[width]"
                  style={{ width: `${Math.max(4, r.probability)}%`, background: fill.color }}
                />
                <span className="num relative w-4 shrink-0 text-right text-[11px] font-bold text-text-faint">
                  {formatNumber(i + 1, lang)}
                </span>
                <span className="relative min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
                  {lang === "bn" ? r.district.name_bn : r.district.name_en}
                </span>
                <span
                  className="relative shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase"
                  style={{ background: fill.color, color: fill.ink }}
                >
                  {t(`risk.level.${r.level}`)}
                </span>
                <span className="num relative w-10 shrink-0 text-right text-[13px] font-extrabold text-text">
                  {formatPercent(r.probability, lang, 0)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 border-t border-ink-700 pt-2 text-[11px] text-text-faint">{t("ranking.hint")}</p>
    </div>
  );
}

/** Shown in the side column before anyone picks a district. */
export function RiskSummary({
  data,
  onSelect,
}: {
  data: RiskSummaryResponse | null;
  onSelect: (id: DistrictId) => void;
}) {
  const { t, lang } = useLanguage();
  const counts = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<RiskLevel, number>;
  data?.districts.forEach((d) => (counts[d.level] += 1));
  const total = data?.districts.length || 1;
  const top = data?.districts[0];

  return (
    <div className="space-y-3 fw-enter">
      <div>
        <p className="eyebrow">{t("risk.summary.title")}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-faint">{t("panel.empty.body")}</p>
      </div>

      {/* Stacked bar of districts per level */}
      <div className="flex h-3 overflow-hidden rounded-full bg-ink-700" aria-hidden>
        {LEVELS.map((l) => (
          <div key={l} style={{ width: `${(counts[l] / total) * 100}%`, background: RISK_FILL[l].color }} />
        ))}
      </div>
      <ul className="grid grid-cols-4 gap-1.5 text-center">
        {LEVELS.map((l) => (
          <li key={l} className="rounded-lg bg-ink-800/80 px-1 py-1.5">
            <p className="num text-[18px] font-black leading-none" style={{ color: RISK_FILL[l].color }}>
              {formatNumber(counts[l], lang)}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-text-faint">{t(`risk.level.${l}`)}</p>
          </li>
        ))}
      </ul>

      {top && (
        <button
          type="button"
          onClick={() => onSelect(top.district.id)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2.5 text-left transition hover:border-accent-dim"
        >
          <span className="min-w-0">
            <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">{t("risk.summary.top")}</span>
            <span className="block truncate text-[14px] font-extrabold text-text">
              {lang === "bn" ? top.district.name_bn : top.district.name_en}
            </span>
          </span>
          <span
            className="num shrink-0 rounded-lg px-2 py-1 text-[15px] font-black"
            style={{ background: RISK_FILL[top.level].color, color: RISK_FILL[top.level].ink }}
          >
            {formatPercent(top.probability, lang, 0)}
          </span>
        </button>
      )}
      <AlertSignup block />
    </div>
  );
}
