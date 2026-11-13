"use client";

/**
 * Right-hand drawer that opens when a district is clicked on the map.
 *
 * It answers the three questions a district officer or a family asks first:
 *   1. How likely is flooding here in the next 12 days?   (gauge + level)
 *   2. Why does the model think so?                        (factor bars)
 *   3. What should I do, and how do I hear about changes?  (steps + e-mail)
 *
 * The outlook follows the time slider: picking 23 July shows what the model
 * would have said on 23 July, using only radar passes up to that date.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getRisk } from "@/lib/api";
import { formatArea, formatLongDate, formatNumber, formatPercent, formatShortDate } from "@/lib/format";
import { divisionName, regimeLabel, type StringKey } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import type { DistrictId, DistrictTimeline, RiskLevel, RiskOutlook } from "@/types/floodwatch";

import { AlertIcon, ArrowRight } from "./Icons";
import { InfoTip } from "./InfoTip";
import { Sparkline } from "./Sparkline";
import { SubscribeForm } from "./SubscribeForm";

export const RISK_COLORS: Record<RiskLevel, { fg: string; bg: string; ring: string }> = {
  low: { fg: "#34d399", bg: "#34d3991a", ring: "#34d39955" },
  moderate: { fg: "#fbbf24", bg: "#fbbf241a", ring: "#fbbf2455" },
  high: { fg: "#fb923c", bg: "#fb923c1f", ring: "#fb923c66" },
  severe: { fg: "#f87171", bg: "#ef444426", ring: "#ef444477" },
};

const ACTION_COUNT: Record<RiskLevel, number> = { low: 3, moderate: 4, high: 4, severe: 4 };

export function RiskDrawer({
  districtId,
  cycle,
  timeline,
  open,
  onClose,
}: {
  districtId: DistrictId | null;
  cycle: string | null;
  timeline: DistrictTimeline | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const [risk, setRisk] = useState<RiskOutlook | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  const key = districtId && cycle ? `${districtId}@${cycle}` : null;

  useEffect(() => {
    if (!open || !districtId || !cycle) return;
    let alive = true;
    getRisk(districtId, cycle)
      .then((r) => {
        if (!alive) return;
        setRisk(r);
        setFailed(null);
      })
      .catch(() => alive && setFailed(`${districtId}@${cycle}`));
    return () => {
      alive = false;
    };
  }, [open, districtId, cycle]);

  // Escape closes; focus moves into the drawer when it opens.
  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Only show data that belongs to the district and date being asked about.
  const current = risk && key === `${risk.district.id}@${risk.cycle}` ? risk : null;
  const error = failed === key;
  const level = current?.level ?? "low";
  const c = RISK_COLORS[level];
  const name = current ? (lang === "bn" ? current.district.name_bn : current.district.name_en) : "";

  const series = timeline && timeline.district.id === districtId ? timeline.series : [];
  const upto = cycle ? series.filter((s) => s.date <= cycle) : series;
  const values = upto.map((s) => (s.observed ? s.flooded_pct : null));

  const trend = current?.trend_pp ?? 0;
  const trendKey: StringKey = trend > 1 ? "risk.trend.up" : trend < -1 ? "risk.trend.down" : "risk.trend.flat";
  const maxContribution = Math.max(...(current?.factors.map((f) => f.contribution) ?? [1]), 1);

  return (
    <>
      {/* Backdrop: dims the page on small screens, click to close. */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-[1100] bg-ink-900/60 backdrop-blur-[2px] transition-opacity duration-300 lg:bg-ink-900/20 lg:backdrop-blur-none
                    ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("risk.title")}
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 right-0 z-[1101] flex w-full max-w-[440px] flex-col border-l border-ink-600
                    bg-ink-850/[0.98] shadow-[-30px_0_60px_-30px_#000] backdrop-blur-xl
                    transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-ink-700 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("risk.title")}</p>
            <h2 className="mt-0.5 truncate text-[22px] font-extrabold leading-tight text-text">
              {name || " "}
            </h2>
            {current && (
              <p className="truncate text-[12px] text-text-faint">
                {t("district.division", { name: divisionName(current.district.division, lang) })}
                {" · "}
                {regimeLabel(current.district.regime, lang)}
                {" · "}
                {formatArea(current.district.area_km2, lang)} {t("common.km2")}
              </p>
            )}
          </div>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="tap grid shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-800 text-text-dim
                       transition hover:bg-ink-700 hover:text-text"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-5">
          {error && !current && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-[13px] text-red-200">
              {t("risk.error")}
            </p>
          )}
          {!current && !error && <Skeleton />}

          {current && (
            <div key={key} className="space-y-4 fw-enter">
              {/* Gauge */}
              <section
                className="relative overflow-hidden rounded-2xl border p-4"
                style={{ borderColor: c.ring, background: `linear-gradient(160deg, ${c.bg}, transparent 70%)` }}
              >
                <div className="flex items-center gap-4">
                  <Gauge value={current.probability} color={c.fg} />
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">{t("risk.chance")}</p>
                    <p
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-extrabold uppercase tracking-wide"
                      style={{ background: c.fg, color: "#0b1220" }}
                    >
                      {(level === "high" || level === "severe") && <AlertIcon className="size-3.5" />}
                      {t(`risk.level.${level}`)}
                    </p>
                    {current.outlook_until && (
                      <p className="mt-2 text-[12px] font-semibold text-text-dim">
                        {t("risk.window", { date: formatLongDate(current.outlook_until, lang) })}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-text-faint">
                      {t("risk.confidence", { level: t(`risk.confidence.${current.confidence}`) })}
                      {current.last_observed && <> · {t("risk.asOf", { date: formatShortDate(current.last_observed, lang) })}</>}
                    </p>
                  </div>
                </div>
                {!current.observed && (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-amber-200/90">{t("risk.notObserved")}</p>
                )}
              </section>

              {/* Key numbers */}
              <section className="grid grid-cols-2 gap-2">
                <Stat label={t("risk.now")} value={formatPercent(current.current_pct, lang)} sub={`${formatPercent(current.coverage_pct, lang, 0)} ${t("panel.coverage").toLowerCase()}`} />
                <Stat
                  label={t("risk.trend")}
                  value={`${trend > 0 ? "▲ +" : trend < 0 ? "▼ " : ""}${formatNumber(trend, lang, 1)} ${t("risk.pp")}`}
                  sub={t(trendKey)}
                  color={trend > 1 ? "#f87171" : trend < -1 ? "#34d399" : undefined}
                />
                <Stat
                  label={t("risk.forecast")}
                  value={`${formatNumber(current.forecast_range[0], lang, 0)}–${formatPercent(current.forecast_range[1], lang, 0)}`}
                  sub={`≈ ${formatPercent(current.forecast_pct, lang)}`}
                />
                <Stat label={t("risk.exposed")} value={`${formatArea(current.exposed_km2, lang)}`} sub={t("common.km2")} />
                <Stat
                  label={t("risk.peak")}
                  value={formatPercent(current.peak_pct, lang)}
                />
                <Stat
                  label={t("risk.recurrence")}
                  value={`${formatNumber(current.flood_cycles, lang)} / ${formatNumber(current.observed_cycles, lang)}`}
                  sub={t("risk.recurrence.sub", {
                    n: formatNumber(current.flood_cycles, lang),
                    m: formatNumber(current.observed_cycles, lang),
                  })}
                />
              </section>

              {/* Season sparkline */}
              {values.some((v) => v !== null) && (
                <section className="panel-flat px-3 py-2.5">
                  <p className="eyebrow mb-1">{t("risk.history")}</p>
                  <Sparkline values={values} highlight={values.length - 1} width={380} height={56} color={c.fg} className="w-full" />
                  <div className="flex justify-between text-[10px] text-text-faint">
                    <span>{upto[0] && formatShortDate(upto[0].date, lang)}</span>
                    <span>{upto.at(-1) && formatShortDate(upto.at(-1)!.date, lang)}</span>
                  </div>
                </section>
              )}

              {/* Why */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[14px] font-extrabold text-text">{t("risk.why")}</h3>
                  <InfoTip label={t("risk.why.hint")} />
                </div>
                <ul className="space-y-2">
                  {current.factors.map((f) => (
                    <li key={f.key}>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="font-semibold text-text-dim">{t(`risk.factor.${f.key}`)}</span>
                        <span className="num shrink-0 text-text-faint">
                          {factorValue(f.key, f.value, lang)}
                          <span className="ml-2 font-bold text-text">+{formatNumber(f.contribution, lang, 0)}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${(f.contribution / maxContribution) * 100}%`, background: c.fg }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* What to do */}
              <section className="rounded-2xl border p-4" style={{ borderColor: c.ring, background: c.bg }}>
                <h3 className="text-[14px] font-extrabold text-text">{t("risk.actions")}</h3>
                <ol className="mt-2 space-y-2">
                  {Array.from({ length: ACTION_COUNT[level] }, (_, i) => (
                    <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug text-text-dim">
                      <span
                        className="num grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
                        style={{ background: c.fg, color: "#0b1220" }}
                      >
                        {formatNumber(i + 1, lang)}
                      </span>
                      {t(`action.${level}.${i + 1}` as StringKey)}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[12.5px] font-extrabold text-text">☎ {t("risk.emergency")}</p>
              </section>

              {/* Subscribe */}
              <section ref={subRef} className="panel p-4">
                <h3 className="text-[15px] font-extrabold text-text">✉ {t("sub.title")}</h3>
                <p className="mb-3 mt-1 text-[12px] leading-relaxed text-text-faint">{t("sub.body")}</p>
                <SubscribeForm district={districtId} compact />
              </section>

              <Link
                href={`/district/${current.district.id}`}
                className="tap flex items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 text-[13px]
                           font-bold text-text transition hover:border-accent-dim hover:bg-ink-700"
              >
                {t("panel.openFull")}
                <ArrowRight className="size-4" />
              </Link>

              <p className="text-[10.5px] leading-relaxed text-text-faint">{t("risk.disclaimer")}</p>
            </div>
          )}
        </div>

        {/* Sticky call to action */}
        {current && (
          <div className="border-t border-ink-700 bg-ink-900/80 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => subRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="tap w-full rounded-xl bg-accent text-[14px] font-extrabold text-ink-900 transition hover:bg-sky-300"
            >
              🔔 {t("sub.cta")} · {name}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function factorValue(key: string, value: number | string, lang: "en" | "bn"): string {
  if (key === "terrain") return regimeLabel(String(value), lang);
  if (key === "season") {
    const month = new Date(Date.UTC(2026, Number(value) - 1, 1));
    return month.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { month: "short", timeZone: "UTC" });
  }
  if (key === "trend") {
    const n = Number(value);
    return `${n > 0 ? "+" : ""}${formatNumber(n, lang, 1)} pp`;
  }
  return formatPercent(Number(value), lang);
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="panel-flat px-3 py-2.5">
      <p className="eyebrow leading-tight">{label}</p>
      <p className="num mt-1 text-[18px] font-extrabold leading-none" style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[10.5px] text-text-faint">{sub}</p>}
    </div>
  );
}

/** Semicircle gauge, 0-100. */
function Gauge({ value, color }: { value: number; color: string }) {
  const r = 46;
  const len = Math.PI * r;
  const shown = Math.max(0, Math.min(100, value));
  return (
    <div className="relative w-[124px] shrink-0">
      <svg viewBox="0 0 120 70" className="w-full" aria-hidden>
        <path d="M14 62 A46 46 0 0 1 106 62" fill="none" stroke="var(--color-ink-600)" strokeWidth={11} strokeLinecap="round" />
        <path
          d="M14 62 A46 46 0 0 1 106 62"
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * len} ${len}`}
          style={{ transition: "stroke-dasharray .7s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <p className="num absolute inset-x-0 bottom-0 text-center text-[30px] font-black leading-none" style={{ color }}>
        {Math.round(shown)}
        <span className="text-[16px]">%</span>
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy>
      <div className="h-[120px] rounded-2xl bg-ink-700/60" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[64px] rounded-xl bg-ink-700/50" />
        ))}
      </div>
      <div className="h-[160px] rounded-2xl bg-ink-700/40" />
    </div>
  );
}
