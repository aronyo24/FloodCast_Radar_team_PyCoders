"use client";

/**
 * Map legend - section 5 of the Frontend Plan.
 *
 * Colour is never the only signal: each swatch is labelled with both its
 * numeric range and a word, so the map survives a colour-blind reader, a bad
 * projector and a greyscale print.
 */

import { FLOOD_CLASSES, NOT_OBSERVED, OVERLAY_COLORS } from "@/lib/colors";
import { formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { Lang } from "@/lib/i18n";

const CLASS_LABEL = {
  none: "legend.none",
  moderate: "legend.moderate",
  severe: "legend.severe",
  extreme: "legend.extreme",
} as const;

function range(min: number, max: number, lang: Lang): string {
  const lo = formatNumber(min, lang);
  return Number.isFinite(max)
    ? `${lo}–${formatNumber(max, lang)}%`
    : `${lo}%+`;
}

export function Legend({ showOverlay }: { showOverlay: boolean }) {
  const { t, lang } = useLanguage();

  return (
    <div className="space-y-2.5">
      <p className="eyebrow">{t("legend.title")}</p>

      <ul className="flex flex-wrap gap-x-3.5 gap-y-2">
        {FLOOD_CLASSES.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-[3px] ring-1 ring-black/25"
              style={{ background: c.color }}
            />
            <span className="num text-[11.5px] font-semibold text-text-dim">
              {range(c.min, c.max, lang)}
            </span>
            <span className="text-[11.5px] text-text-faint">{t(CLASS_LABEL[c.key])}</span>
          </li>
        ))}

        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-[3px] ring-1 ring-black/25"
            style={{ background: NOT_OBSERVED.color }}
          />
          <span className="text-[11.5px] text-text-faint">{t("legend.notObserved")}</span>
        </li>

        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-[3px] ring-1 ring-black/25"
            style={{
              background: `repeating-linear-gradient(45deg, ${NOT_OBSERVED.color} 0 2px, #64748b 2px 4px)`,
            }}
          />
          <span className="text-[11.5px] text-text-faint">{t("legend.partial")}</span>
        </li>
      </ul>

      {showOverlay && (
        <ul className="flex flex-wrap gap-x-3.5 gap-y-2 border-t border-ink-700 pt-2.5">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-[3px] ring-1 ring-black/25"
              style={{ background: OVERLAY_COLORS.flood, opacity: 0.8 }}
            />
            <span className="text-[11.5px] text-text-faint">{t("legend.overlayFlood")}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-[3px] ring-1 ring-black/25"
              style={{ background: OVERLAY_COLORS.water, opacity: 0.65 }}
            />
            <span className="text-[11.5px] text-text-faint">{t("legend.overlayWater")}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
