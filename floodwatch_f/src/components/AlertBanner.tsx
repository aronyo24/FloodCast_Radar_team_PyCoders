"use client";

/**
 * Flood alert banner (F10).
 *
 * The plan specifies "latest cycle", but a banner that ignores the slider goes
 * stale the moment anyone moves it, so this follows the selected cycle. The
 * "all clear" state is deliberate: an operational tool that shows nothing when
 * nothing is wrong teaches people that the empty state means "checked and
 * fine", not "broken".
 */

import { formatPercent, formatShortDate } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { Alert, Meta } from "@/types/floodwatch";

import { AlertIcon, CheckIcon } from "./Icons";

export function AlertBanner({
  alerts,
  cycleDate,
  meta,
  peakDate,
  onSelectDistrict,
  onJumpToPeak,
}: {
  alerts: Alert[] | null;
  cycleDate: string;
  meta: Meta | null;
  peakDate?: string | null;
  onSelectDistrict?: (id: string) => void;
  onJumpToPeak?: () => void;
}) {
  const { t, lang } = useLanguage();

  if (!alerts || !meta) {
    return <div className="fw-skeleton h-[52px]" />;
  }

  const severe = alerts.filter((a) => a.level === "severe");
  const headline = severe.length > 0 ? "severe" : alerts.length > 0 ? "warning" : "none";
  const shown = alerts.slice(0, 3);
  const extra = alerts.length - shown.length;

  if (headline === "none") {
    const atPeak = peakDate === cycleDate;
    return (
      <div
        role="status"
        className="panel-flat flex flex-wrap items-center gap-x-3 gap-y-1.5 border-emerald-400/25
                   bg-emerald-400/[0.06] px-4 py-3"
      >
        <CheckIcon className="size-4 text-ok" />
        <p className="text-[13px] font-medium text-emerald-100/90">
          {t("alert.none", {
            pct: formatPercent(meta.alert_levels.warning_pct, lang, 0),
            date: formatShortDate(cycleDate, lang),
          })}
        </p>
        {onJumpToPeak && peakDate && !atPeak && (
          <button
            type="button"
            onClick={onJumpToPeak}
            className="ml-auto rounded-full border border-ink-600 px-3 py-1 text-[12px]
                       font-semibold text-text-dim transition hover:border-accent-dim hover:text-text"
          >
            {t("alert.jumpToPeak")} →
          </button>
        )}
      </div>
    );
  }

  const tone =
    headline === "severe"
      ? "border-flood-4/60 bg-[#7f1d1d]/35 text-red-50"
      : "border-amber-500/50 bg-amber-500/[0.12] text-amber-50";

  return (
    <div
      role="alert"
      className={`panel-flat flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 ${tone}`}
    >
      <AlertIcon
        className={`size-[18px] ${headline === "severe" ? "text-severe" : "text-warning"}`}
      />
      <span className="text-[13px] font-extrabold uppercase tracking-wide">
        {t(headline === "severe" ? "alert.severe" : "alert.warning")}
      </span>
      <p className="text-[13px] leading-snug">
        {t("alert.above", {
          names: shown
            .map((a) => (lang === "bn" ? a.name_bn : a.name_en))
            .join(", "),
          date: formatShortDate(cycleDate, lang),
        })}
        {extra > 0 && <> {t("alert.more", { n: extra })}</>}
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {shown.map((a) => (
          <button
            key={a.district_id}
            type="button"
            onClick={() => onSelectDistrict?.(a.district_id)}
            className="num rounded-full border border-white/25 bg-black/25 px-2.5 py-1
                       text-[12px] font-bold transition hover:border-white/60"
          >
            {lang === "bn" ? a.name_bn : a.name_en} {formatPercent(a.flooded_pct, lang, 0)}
            {a.change_pct !== null && a.change_pct > 0 && (
              <span className="ml-1 opacity-80">▲{formatPercent(a.change_pct, lang, 0)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
