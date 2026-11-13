"use client";

import { ATTRIBUTION } from "@/lib/attribution";
import { FLOOD_CLASSES, NOT_OBSERVED } from "@/lib/colors";
import { formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { Meta } from "@/types/floodwatch";

import { ProvenanceBadges } from "./Badges";
import { RadarDiagram } from "./RadarDiagram";

const STEPS = [
  ["hiw.step1.title", "hiw.step1.body"],
  ["hiw.step2.title", "hiw.step2.body"],
  ["hiw.step3.title", "hiw.step3.body"],
  ["hiw.step4.title", "hiw.step4.body"],
  ["hiw.step5.title", "hiw.step5.body"],
] as const;

const LIMITS = [
  "hiw.limit1",
  "hiw.limit2",
  "hiw.limit3",
  "hiw.limit4",
  "hiw.limit5",
] as const;

const CLASS_LABEL = {
  none: "legend.none",
  moderate: "legend.moderate",
  severe: "legend.severe",
  extreme: "legend.extreme",
} as const;

export function HowItWorksClient({ meta }: { meta: Meta }) {
  const { t, lang } = useLanguage();

  return (
    <div className="shell max-w-4xl py-10 lg:py-14">
      <header>
        <h1 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
          {t("hiw.title")}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-text-dim">
          {t("hiw.lede")}
        </p>
        <ProvenanceBadges className="mt-5" demo={meta.demo_data} provisional={meta.provisional} />
      </header>

      <section className="mt-12">
        <h2 className="text-[20px] font-extrabold tracking-tight text-text">
          {t("hiw.radar.title")}
        </h2>
        <p className="mt-3 max-w-[70ch] text-[14.5px] leading-relaxed text-text-dim">
          {t("hiw.radar.body")}
        </p>
        <div className="mt-6">
          <RadarDiagram />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[20px] font-extrabold tracking-tight text-text">
          {t("hiw.steps.title")}
        </h2>
        <ol className="mt-5 space-y-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="panel flex gap-4 p-4 sm:p-5">
              <span
                aria-hidden
                className="num grid size-9 shrink-0 place-items-center rounded-full
                           border border-accent/35 bg-accent/10 text-[14px] font-extrabold text-accent"
              >
                {formatNumber(i + 1, lang)}
              </span>
              <div>
                <h3 className="text-[15px] font-extrabold text-text">{t(title)}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-text-dim">
                  {t(body)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-[20px] font-extrabold tracking-tight text-text">
          {t("hiw.reading.title")}
        </h2>
        <div className="panel mt-5 overflow-hidden">
          <table className="w-full text-left text-[13.5px]">
            <tbody className="divide-y divide-ink-700">
              {FLOOD_CLASSES.map((c) => (
                <tr key={c.key}>
                  <td className="w-16 py-3 pl-4">
                    <span
                      className="block h-6 w-12 rounded ring-1 ring-black/25"
                      style={{ background: c.color }}
                    />
                  </td>
                  <td className="num py-3 pr-3 font-bold text-text">
                    {formatNumber(c.min, lang)}
                    {Number.isFinite(c.max) ? `–${formatNumber(c.max, lang)}%` : "%+"}
                  </td>
                  <td className="py-3 pr-4 text-text-dim">{t(CLASS_LABEL[c.key])}</td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pl-4">
                  <span
                    className="block h-6 w-12 rounded ring-1 ring-black/25"
                    style={{ background: NOT_OBSERVED.color }}
                  />
                </td>
                <td className="py-3 pr-3 font-bold text-text">—</td>
                <td className="py-3 pr-4 text-text-dim">{t("legend.notObserved")}</td>
              </tr>
              <tr>
                <td className="py-3 pl-4">
                  <span
                    className="block h-6 w-12 rounded ring-1 ring-black/25"
                    style={{
                      background: `repeating-linear-gradient(45deg, ${NOT_OBSERVED.color} 0 3px, #64748b 3px 6px)`,
                    }}
                  />
                </td>
                <td className="py-3 pr-3 font-bold text-text">
                  &lt; {formatNumber(meta.low_coverage_pct, lang)}%
                </td>
                <td className="py-3 pr-4 text-text-dim">{t("legend.partial")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[20px] font-extrabold tracking-tight text-text">
          {t("hiw.limits.title")}
        </h2>
        <ul className="mt-5 space-y-2.5">
          {LIMITS.map((key) => (
            <li
              key={key}
              className="panel-flat flex gap-3 p-4 text-[14px] leading-relaxed text-text-dim"
            >
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 pb-6">
        <h2 className="text-[20px] font-extrabold tracking-tight text-text">
          {t("hiw.sources.title")}
        </h2>
        <dl className="panel mt-5 divide-y divide-ink-700 text-[13.5px]">
          {[
            ["Mission", meta.mission],
            ["Instrument", meta.instrument],
            ["Product", meta.product],
            ["Distributor", meta.distributor],
            ["Cycle length", `${meta.cycle_length_days} days`],
            ["Raster resolution", `~${meta.grid.approx_m_per_px} m per pixel`],
            ["Projection", meta.grid.projection],
            [
              "Boundaries",
              `${meta.boundaries.name} (${meta.boundaries.licence}), release ${meta.boundaries.release}, representing ${meta.boundaries.year_represented}`,
            ],
            ["Boundary source", meta.boundaries.source],
            ["Challenge", `${ATTRIBUTION.challenge.event} — ${ATTRIBUTION.challenge.name}`],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <dt className="eyebrow">{k}</dt>
              <dd className="text-text-dim">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 rounded-xl border border-sky-400/30 bg-sky-400/[0.07] p-4
                      text-[13.5px] leading-relaxed text-sky-100/85">
          {meta.demo_note}
        </p>
      </section>
    </div>
  );
}
