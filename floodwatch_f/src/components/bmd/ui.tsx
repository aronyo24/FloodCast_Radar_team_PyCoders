"use client";

/** Small building blocks shared by the BMD portal pages. */

import { useEffect, useState, type ReactNode } from "react";

import { getDistrictList } from "@/lib/api";
import { toBanglaDigits } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import type { BmdLevel, BmdTrend } from "@/types/bmd";

// ---- level styling ----------------------------------------------------------

export const LEVEL_STYLE: Record<BmdLevel, { dot: string; chip: string; bar: string; ring: string }> = {
  normal: {
    dot: "bg-emerald-400",
    chip: "border-emerald-400/35 bg-emerald-400/10 text-emerald-200",
    bar: "bg-emerald-400",
    ring: "border-l-emerald-400",
  },
  alert: {
    dot: "bg-yellow-300",
    chip: "border-yellow-300/35 bg-yellow-300/10 text-yellow-100",
    bar: "bg-yellow-300",
    ring: "border-l-yellow-300",
  },
  warning: {
    dot: "bg-orange-400",
    chip: "border-orange-400/40 bg-orange-400/10 text-orange-200",
    bar: "bg-orange-400",
    ring: "border-l-orange-400",
  },
  danger: {
    dot: "bg-red-500",
    chip: "border-red-500/45 bg-red-500/15 text-red-200",
    bar: "bg-red-500",
    ring: "border-l-red-500",
  },
  extreme: {
    dot: "bg-fuchsia-500 fw-pulse",
    chip: "border-fuchsia-500/50 bg-fuchsia-600/20 text-fuchsia-100",
    bar: "bg-fuchsia-500",
    ring: "border-l-fuchsia-500",
  },
};

export function LevelBadge({ level, className = "" }: { level: BmdLevel; className?: string }) {
  const { t } = useLanguage();
  const s = LEVEL_STYLE[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold
                  ${s.chip} ${className}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} />
      {t(`bmd.level.${level}`)}
    </span>
  );
}

const TREND_ARROW: Record<BmdTrend, string> = { rising: "↑", steady: "→", falling: "↓", unknown: "·" };
const TREND_COLOR: Record<BmdTrend, string> = {
  rising: "text-red-300",
  steady: "text-text-dim",
  falling: "text-emerald-300",
  unknown: "text-text-faint",
};

export function TrendLabel({ trend }: { trend: BmdTrend }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${TREND_COLOR[trend]}`}>
      <span aria-hidden className="text-[14px] leading-none">{TREND_ARROW[trend]}</span>
      {t(`bmd.trend.${trend}`)}
    </span>
  );
}

export function VerifiedMark({ verified }: { verified: boolean }) {
  const { t } = useLanguage();
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[10.5px] font-bold text-sky-200">
      <svg viewBox="0 0 16 16" className="size-3" aria-hidden fill="currentColor">
        <path d="M8 0l2 1.6 2.5-.2.8 2.4L15.6 5 15 7.5 16 10l-2 1.4-.5 2.5-2.5.2L8 16l-2-1.6-2.5.2-.8-2.4L.4 11 1 8.5 0 6l2-1.4.5-2.5L5 1.9z" />
        <path d="M5 8.2l2 2 4-4.2" stroke="#0b1220" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("bmd.verified")}
    </span>
  ) : (
    <span className="rounded-full bg-ink-600 px-2 py-0.5 text-[10.5px] font-bold text-text-faint">
      {t("bmd.unverified")}
    </span>
  );
}

// ---- time ---------------------------------------------------------------------

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_BN = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];

/** Bangladesh has one time zone, UTC+6, and no daylight saving. */
export function formatDhaka(iso: string, lang: Lang): string {
  const d = new Date(new Date(iso).getTime() + 6 * 3_600_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const months = lang === "bn" ? MONTHS_BN : MONTHS_EN;
  const text = `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm}`;
  return lang === "bn" ? toBanglaDigits(text) : `${text} BST`;
}

export function useTimeAgo() {
  const { t, lang } = useLanguage();
  // Re-render every minute so "5 min ago" stays true.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return (iso: string) => {
    if (now === null) return formatDhaka(iso, lang);
    const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
    const n = (v: number) => (lang === "bn" ? toBanglaDigits(String(v)) : String(v));
    if (mins < 1) return t("bmd.ago.now");
    if (mins < 60) return t("bmd.ago.min", { n: n(mins) });
    if (mins < 60 * 24) return t("bmd.ago.hour", { n: n(Math.floor(mins / 60)) });
    return t("bmd.ago.day", { n: n(Math.floor(mins / 1440)) });
  };
}

/** Value for <input type="datetime-local"> in the browser's local time. */
export function localInputValue(date: Date = new Date()): string {
  const off = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - off).toISOString().slice(0, 16);
}

// ---- districts ----------------------------------------------------------------

export type DistrictRow = { id: string; name_en: string; name_bn: string; division: string };
let listPromise: Promise<{ districts: DistrictRow[] }> | null = null;

export function useDistricts(): DistrictRow[] {
  const { lang } = useLanguage();
  const [rows, setRows] = useState<DistrictRow[]>([]);
  useEffect(() => {
    listPromise ??= getDistrictList();
    let alive = true;
    listPromise
      .then((d) => alive && setRows(d.districts))
      .catch(() => {
        listPromise = null;
      });
    return () => {
      alive = false;
    };
  }, []);
  return [...rows].sort((a, b) =>
    lang === "bn" ? a.name_bn.localeCompare(b.name_bn, "bn") : a.name_en.localeCompare(b.name_en),
  );
}

// ---- form controls --------------------------------------------------------------

export const inputClass =
  "w-full rounded-lg border bg-ink-900/70 px-3 py-2.5 text-[14px] text-text placeholder:text-text-faint " +
  "outline-none transition focus:border-accent disabled:opacity-60";

export const borderFor = (errors: Record<string, string>, key: string) =>
  errors[key] ? "border-severe" : "border-ink-600";

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-[12.5px] font-semibold text-text-dim">
        {label}
        {required && (
          <span className="text-red-300" title={t("bmd.a.required")} aria-label={t("bmd.a.required")}>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11.5px] leading-snug text-text-faint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11.5px] font-semibold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-ink-700 pt-5 first:border-t-0 first:pt-0">
      <legend className="eyebrow mb-1 float-left w-full">{title}</legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-200">
      {message}
    </p>
  );
}

export function PrimaryButton({
  children,
  busy,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className={`tap inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-extrabold
                  text-ink-900 shadow-[0_8px_24px_-10px_#38bdf8] transition hover:bg-sky-300
                  disabled:cursor-wait disabled:opacity-70 ${className}`}
    >
      {busy && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-ink-900/30 border-t-ink-900" />}
      {children}
    </button>
  );
}

/** BMD seal-style mark used in the portal header. */
export function BmdMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#0b3a55" stroke="#38bdf8" strokeWidth="2" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#38bdf8" strokeOpacity=".35" strokeWidth="1" />
      <path d="M15 27a7 7 0 0 1 2-13.6A9 9 0 0 1 34 17a6 6 0 0 1-1 12H17" fill="#e9eff8" />
      <path d="M18 33l-2 4M24 33l-2 4M30 33l-2 4" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
