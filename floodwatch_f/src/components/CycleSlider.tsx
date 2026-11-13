"use client";

/**
 * Cycle slider and the play animation (F2, F9).
 *
 * The slider is a real <input type="range">, which gets arrow keys, Home/End
 * and screen-reader support for free - the acceptance checklist asks that the
 * keyboard can reach the slider and the play button. The track is tinted with
 * the national flood curve so the shape of the season is visible before anyone
 * touches it.
 */

import { useEffect } from "react";

import { formatShortDate } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { CycleSummary } from "@/types/floodwatch";

import { ChevronLeft, ChevronRight, PauseIcon, PlayIcon } from "./Icons";

const FRAME_MS = 900;

export function CycleSlider({
  cycles,
  index,
  onIndex,
  playing,
  onPlaying,
}: {
  cycles: CycleSummary[];
  index: number;
  onIndex: (i: number) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
}) {
  const { t, lang } = useLanguage();
  const last = cycles.length - 1;

  // One timeout per frame rather than a long-lived interval: the effect then
  // depends on the current index instead of having to read it from a ref, and
  // it stops at the end rather than looping, so the final frame stays on
  // screen for discussion.
  useEffect(() => {
    if (!playing || cycles.length === 0) return;
    const id = window.setTimeout(() => {
      if (index >= last) onPlaying(false);
      else onIndex(index + 1);
    }, FRAME_MS);
    return () => window.clearTimeout(id);
  }, [playing, index, last, cycles.length, onIndex, onPlaying]);

  if (cycles.length === 0) {
    return <div className="fw-skeleton h-[72px]" />;
  }

  const current = cycles[Math.min(index, last)];
  const peak = Math.max(...cycles.map((c) => c.national.flooded_km2), 1);

  function step(delta: number) {
    onPlaying(false);
    onIndex(Math.max(0, Math.min(last, index + delta)));
  }

  function togglePlay() {
    // Restarting from the end should replay the season, not sit still.
    if (!playing && index >= last) onIndex(0);
    onPlaying(!playing);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="eyebrow">{t("slider.label")}</span>
          <span className="num text-[15px] font-extrabold text-text">
            {formatShortDate(current.date, lang)}
          </span>
          <span className="num hidden text-[11px] text-text-faint sm:inline">
            {t("slider.cycleOf", { n: index + 1, total: cycles.length })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={index === 0}
            aria-label={t("slider.prev")}
            className="tap grid place-items-center rounded-lg text-text-dim transition
                       hover:bg-ink-700 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-[18px]" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={t(playing ? "slider.pause" : "slider.play")}
            className="tap flex items-center gap-2 rounded-full bg-accent px-4 font-bold
                       text-ink-900 transition hover:bg-sky-300"
          >
            {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            <span className="hidden text-[13px] sm:inline">
              {t(playing ? "slider.pause" : "slider.play")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => step(1)}
            disabled={index === last}
            aria-label={t("slider.next")}
            className="tap grid place-items-center rounded-lg text-text-dim transition
                       hover:bg-ink-700 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-[18px]" />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* The season's shape, drawn behind the track. Decorative: the same
            information is in the national timeline chart with real axes. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[13px] flex h-[18px] items-end gap-[2px]"
        >
          {cycles.map((c, i) => (
            <span
              key={c.date}
              className="flex-1 rounded-t-[2px] transition-colors"
              style={{
                height: `${Math.max(8, (c.national.flooded_km2 / peak) * 100)}%`,
                background: i === index ? "#38bdf8" : "#2a3f5c",
              }}
            />
          ))}
        </div>

        <input
          type="range"
          className="fw-range relative"
          min={0}
          max={last}
          step={1}
          value={index}
          aria-label={t("slider.aria")}
          aria-valuetext={`${formatShortDate(current.date, lang)} — ${t("slider.cycleOf", {
            n: index + 1,
            total: cycles.length,
          })}`}
          onChange={(e) => {
            onPlaying(false);
            onIndex(Number(e.target.value));
          }}
          style={{ ["--fw-track" as string]: "transparent" }}
        />
      </div>

      <div className="flex justify-between text-[10.5px] text-text-faint">
        <span>{formatShortDate(cycles[0].date, lang)}</span>
        <span>{formatShortDate(cycles[last].date, lang)}</span>
      </div>
    </div>
  );
}
