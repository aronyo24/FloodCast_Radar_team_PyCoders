"use client";

/**
 * A tiny season sparkline, drawn as inline SVG.
 *
 * The click panel re-renders on every slider step, and spinning up a Chart.js
 * instance that often is wasteful - a path with a dozen points costs nothing.
 * Gaps in the line are real: a cycle with no radar coverage is not drawn as
 * zero, it is left out.
 */

export function Sparkline({
  values,
  highlight,
  width = 220,
  height = 44,
  color = "#38bdf8",
  className = "",
}: {
  /** One entry per cycle; `null` means the district was not observed. */
  values: Array<number | null>;
  /** Index of the selected cycle. */
  highlight?: number;
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const pad = 3;
  const usable = values.filter((v): v is number => v !== null);
  if (usable.length === 0) return null;

  const max = Math.max(...usable, 1);
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);

  // Break the path wherever a cycle was not observed.
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
  });
  if (current.length) segments.push(current.join(" "));

  const area =
    usable.length === values.length
      ? `M${x(0).toFixed(1)} ${height - pad} ` +
        values.map((v, i) => `L${x(i).toFixed(1)} ${y(v as number).toFixed(1)}`).join(" ") +
        ` L${x(values.length - 1).toFixed(1)} ${height - pad} Z`
      : null;

  const hi = highlight !== undefined ? values[highlight] : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${className}`}
      style={{ height }}
      aria-hidden
      preserveAspectRatio="none"
    >
      {area && <path d={area} fill={color} opacity={0.14} />}
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {highlight !== undefined && hi !== null && (
        <circle cx={x(highlight)} cy={y(hi)} r={3.2} fill="#fff" stroke={color} strokeWidth={2} />
      )}
    </svg>
  );
}
