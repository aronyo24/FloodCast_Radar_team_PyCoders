/**
 * Map colours and legend - section 5 of the Frontend Plan.
 *
 * The plan asks for a sequential single-hue red scale so the map stays readable
 * for colour-blind users. These are the ColorBrewer "Reds" steps, which are
 * tested for exactly that. Colour is never the only signal: every district
 * tooltip prints the percentage and the legend carries text labels.
 */

export interface FloodClass {
  /** Lower bound, inclusive, in percent. */
  min: number;
  /** Upper bound, exclusive. `Infinity` for the top class. */
  max: number;
  color: string;
  /** Readable text colour on top of `color`. */
  ink: string;
  key: "none" | "moderate" | "severe" | "extreme";
}

export const FLOOD_CLASSES: FloodClass[] = [
  { min: 0, max: 5, color: "#fee0d2", ink: "#7f1d1d", key: "none" },
  { min: 5, max: 15, color: "#fc9272", ink: "#7f1d1d", key: "moderate" },
  { min: 15, max: 30, color: "#ef3b2c", ink: "#ffffff", key: "severe" },
  { min: 30, max: Infinity, color: "#a50f15", ink: "#ffffff", key: "extreme" },
];

/** Grey = no image in this cycle. Hatched over it = coverage under 50%. */
export const NOT_OBSERVED = {
  color: "#cbd5e1",
  ink: "#334155",
  key: "not-observed" as const,
};

export const OVERLAY_COLORS = {
  /** New water - "not normally water". */
  flood: "#d61f26",
  /** Rivers, beels and ponds present most of the time. */
  water: "#1f66ba",
};

export const ALERT_COLORS = {
  warning: { bg: "#b45309", ink: "#fffbeb", dot: "#f59e0b" },
  severe: { bg: "#991b1b", ink: "#fef2f2", dot: "#ef4444" },
};

export function floodClass(pct: number | null | undefined): FloodClass | null {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  return (
    FLOOD_CLASSES.find((c) => pct >= c.min && pct < c.max) ??
    FLOOD_CLASSES[FLOOD_CLASSES.length - 1]
  );
}

/** Fill for a district polygon. `null` percent means it was not observed. */
export function floodColor(pct: number | null | undefined): string {
  return floodClass(pct)?.color ?? NOT_OBSERVED.color;
}

export function floodInk(pct: number | null | undefined): string {
  return floodClass(pct)?.ink ?? NOT_OBSERVED.ink;
}

/**
 * Districts whose coverage is below the threshold are drawn with a hatch so
 * "we only saw part of this" is visible rather than implied (F12).
 */
export function isLowCoverage(
  coveragePct: number | null | undefined,
  threshold = 50,
): boolean {
  return (
    coveragePct !== null &&
    coveragePct !== undefined &&
    coveragePct > 0 &&
    coveragePct < threshold
  );
}

/** Risk-outlook fills for the map (green -> red), with readable ink. */
export const RISK_FILL: Record<"low" | "moderate" | "high" | "severe", { color: string; ink: string }> = {
  low: { color: "#86efac", ink: "#14532d" },
  moderate: { color: "#fcd34d", ink: "#713f12" },
  high: { color: "#fb923c", ink: "#431407" },
  severe: { color: "#dc2626", ink: "#ffffff" },
};
