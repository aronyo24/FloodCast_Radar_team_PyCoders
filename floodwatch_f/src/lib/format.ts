/**
 * Number and date formatting, language aware.
 *
 * Bangla readers expect Bangla digits, so when the UI is in Bangla every
 * numeral - including the ones inside dates - is transliterated. Everything is
 * formatted with explicit locales rather than the browser default so a laptop
 * set to another locale cannot change what judges see.
 */

import type { Lang } from "./i18n";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_BN = [
  "জানু", "ফেব্রু", "মার্চ",
  "এপ্রিল", "মে", "জুন",
  "জুল", "আগ", "সেপ্ট",
  "অক্টো", "নভে", "ডিসে",
];

export function toBanglaDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

function localise(text: string, lang: Lang): string {
  return lang === "bn" ? toBanglaDigits(text) : text;
}

/** Thousands-separated integer, e.g. 2,815 / ২,৮১৫ */
export function formatNumber(value: number, lang: Lang, digits = 0): string {
  const text = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return localise(text, lang);
}

/** Area with sensible precision: big numbers lose the decimals. */
export function formatArea(km2: number, lang: Lang): string {
  const digits = km2 >= 100 ? 0 : km2 >= 10 ? 1 : 2;
  return formatNumber(km2, lang, digits);
}

export function formatPercent(
  pct: number | null | undefined,
  lang: Lang,
  digits = 1,
): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
  return `${formatNumber(pct, lang, digits)}%`;
}

/** "23 Jul" / "২৩ জুল" */
export function formatShortDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const months = lang === "bn" ? MONTHS_BN : MONTHS_EN;
  return localise(`${d.getUTCDate()} ${months[d.getUTCMonth()]}`, lang);
}

/** "23 July 2026" / "২৩ জুলাই ২০২৬" */
export function formatLongDate(iso: string, lang: Lang): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const months = lang === "bn" ? MONTHS_BN : MONTHS_EN;
  return localise(
    `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    lang,
  );
}

/** "28 Oct, 06:12 UTC" - used for "last checked". */
export function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const months = lang === "bn" ? MONTHS_BN : MONTHS_EN;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return localise(
    `${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${hh}:${mm} UTC`,
    lang,
  );
}

/** Whole days between an ISO date/datetime and now. */
export function daysAgo(iso: string, now: Date = new Date()): number {
  const then = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

/** "today" / "3 days ago" - plain words beat a raw timestamp. */
export function formatAge(iso: string, lang: Lang, now?: Date): string {
  const days = daysAgo(iso, now);
  if (lang === "bn") {
    if (days === 0) return "আজ";
    if (days === 1) return "গতকাল";
    return `${toBanglaDigits(String(days))} দিন আগে`;
  }
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function districtName(
  d: { name_en: string; name_bn: string },
  lang: Lang,
): string {
  return lang === "bn" ? d.name_bn : d.name_en;
}
