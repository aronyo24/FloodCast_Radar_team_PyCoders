"use client";

import Link from "next/link";

import { formatArea, formatLongDate, formatNumber, formatPercent } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { NationalStat } from "@/types/floodwatch";

import { ProvenanceBadges } from "./Badges";
import { HomeAlerts, HomeFeatures, HomeRisk, HomeSteps } from "./HomeSections";
import { ArrowRight, SatelliteIcon } from "./Icons";

interface Props {
  peak: {
    date: string;
    flooded_km2: number;
    flooded_pct: number;
    worst: NationalStat["worst"];
  };
  cycleCount: number;
  districtCount: number;
  season: { start: string; end: string };
  demo: boolean;
  provisional: boolean;
}

export function HomeClient({ peak, cycleCount, districtCount, season, demo, provisional }: Props) {
  const { t, lang } = useLanguage();

  return (
    <div className="shell">
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:py-20">
        <div className="fw-enter">
          <p className="eyebrow flex items-center gap-2">
            <SatelliteIcon className="size-4 text-accent" />
            {t("home.eyebrow")}
          </p>

          <h1 className="mt-4 text-balance text-[34px] font-extrabold leading-[1.08] tracking-tight text-text sm:text-[46px] lg:text-[54px]">
            {t("home.title")}
          </h1>

          <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-text-dim sm:text-[16px]">
            {t("home.lede")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/explorer"
              className="tap inline-flex items-center gap-2.5 rounded-full bg-accent px-6
                         text-[15px] font-extrabold text-ink-900 shadow-[0_10px_30px_-12px_#38bdf8]
                         transition hover:bg-sky-300"
            >
              {t("home.cta")}
              <ArrowRight className="size-[18px]" />
            </Link>
            <Link
              href="/how-it-works"
              className="tap inline-flex items-center rounded-full border border-ink-600 px-5
                         text-[14px] font-bold text-text-dim transition
                         hover:border-accent-dim hover:text-text"
            >
              {t("home.ctaSecondary")}
            </Link>
            <a
              href="#alerts"
              className="tap inline-flex items-center gap-1.5 rounded-full px-3 text-[14px] font-bold text-sky-300
                         transition hover:text-sky-200"
            >
              🔔 {t("sub.cta")}
            </a>
          </div>

          <ProvenanceBadges className="mt-7" demo={demo} provisional={provisional} />
        </div>

        {/* The headline figure, as its own object rather than buried in prose. */}
        <div className="panel fw-enter p-6 sm:p-8">
          <p className="eyebrow">{t("home.headline.label")}</p>
          <p className="num mt-2 text-[52px] font-extrabold leading-none tracking-tight text-text sm:text-[64px]">
            {formatArea(peak.flooded_km2, lang)}
            <span className="ml-2 text-[20px] font-bold text-text-dim">
              {t("common.km2")}
            </span>
          </p>
          <p className="mt-2 text-[13px] text-text-faint">
            {formatPercent(peak.flooded_pct, lang)}{" "}
            {t("home.headline.sub", { date: formatLongDate(peak.date, lang) })}
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-x-3 gap-y-5 border-t border-ink-700 pt-6">
            <div>
              <dt className="eyebrow">{t("home.worst.label")}</dt>
              <dd className="mt-1.5">
                {peak.worst ? (
                  <Link
                    href={`/district/${peak.worst.id}`}
                    className="text-[19px] font-extrabold text-text underline
                               decoration-ink-500 decoration-2 underline-offset-4
                               transition hover:decoration-accent"
                  >
                    {lang === "bn" ? peak.worst.name_bn : peak.worst.name_en}
                  </Link>
                ) : (
                  <span className="text-[19px] font-extrabold text-text-faint">—</span>
                )}
                {peak.worst && (
                  <span className="num ml-2 text-[15px] font-extrabold text-flood-3">
                    {formatPercent(peak.worst.flooded_pct, lang, 0)}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t("home.districts.label")}</dt>
              <dd className="num mt-1.5 text-[19px] font-extrabold text-text">
                {formatNumber(districtCount, lang)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="eyebrow">{t("home.cycles.label")}</dt>
              <dd className="mt-1.5">
                <span className="num text-[19px] font-extrabold text-text">
                  {formatNumber(cycleCount, lang)}
                </span>
                <span className="ml-2 text-[12px] text-text-faint">
                  {t("home.season", {
                    start: formatLongDate(season.start, lang),
                    end: formatLongDate(season.end, lang),
                  })}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <HomeRisk />
      <HomeFeatures />
      <HomeSteps />

      <section className="border-t border-ink-700/70 py-12">
        <p className="eyebrow">{t("home.audience.title")}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {(["home.audience.1", "home.audience.2", "home.audience.3"] as const).map(
            (key, i) => (
              <li key={key} className="panel-flat p-5">
                <span className="num text-[12px] font-extrabold text-accent">
                  {formatNumber(i + 1, lang)}
                </span>
                <p className="mt-2 text-[14px] leading-relaxed text-text-dim">
                  {t(key)}
                </p>
              </li>
            ),
          )}
        </ul>
      </section>

      <HomeAlerts />
    </div>
  );
}
