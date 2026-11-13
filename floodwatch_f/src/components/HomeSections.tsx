"use client";

/**
 * Home page sections under the hero: live risk outlook, features, the three
 * steps from radar to alert, and the e-mail sign-up.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { getRiskAll } from "@/lib/api";
import { RISK_FILL } from "@/lib/colors";
import { formatLongDate, formatNumber, formatPercent } from "@/lib/format";
import { divisionName, type StringKey } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import type { RiskLevel, RiskSummaryResponse } from "@/types/floodwatch";

import { ArrowRight, CheckIcon } from "./Icons";
import { SubscribeForm } from "./SubscribeForm";

const LEVELS: RiskLevel[] = ["severe", "high", "moderate", "low"];

export function HomeRisk() {
  const { t, lang } = useLanguage();
  const [data, setData] = useState<RiskSummaryResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getRiskAll()
      .then((r) => alive && setData(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return null;

  const counts = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<RiskLevel, number>;
  data?.districts.forEach((d) => (counts[d.level] += 1));
  const top = data?.districts.slice(0, 6) ?? [];

  return (
    <section className="border-t border-ink-700/70 py-12 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            {t("home.risk.eyebrow")}
          </p>
          <h2 className="mt-2 max-w-[30ch] text-balance text-[24px] font-extrabold leading-tight text-text sm:text-[30px]">
            {t("home.risk.title")}
          </h2>
          {data?.cycle && (
            <p className="mt-1.5 text-[12.5px] text-text-faint">
              {t("home.risk.sub", { date: formatLongDate(data.cycle, lang) })}
            </p>
          )}
        </div>
        <Link
          href="/explorer"
          className="inline-flex items-center gap-2 text-[13.5px] font-bold text-accent hover:underline"
        >
          {t("home.risk.all")}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Counts per level */}
        <div className="panel p-5">
          <div className="flex h-3 overflow-hidden rounded-full bg-ink-700" aria-hidden>
            {LEVELS.map((l) => (
              <div
                key={l}
                className="transition-[width] duration-700"
                style={{ width: `${data ? (counts[l] / data.districts.length) * 100 : 0}%`, background: RISK_FILL[l].color }}
              />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2.5">
            {LEVELS.map((l) => (
              <li key={l} className="rounded-xl bg-ink-800/70 px-3 py-3">
                <p className="num text-[30px] font-black leading-none" style={{ color: RISK_FILL[l].color }}>
                  {data ? formatNumber(counts[l], lang) : "–"}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-text-dim">
                  {t(`risk.level.${l}`)} <span className="text-text-faint">· {t("home.risk.districts")}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Top districts */}
        <ul className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
          {(data ? top : Array.from({ length: 6 }, () => null)).map((d, i) =>
            d ? (
              <li key={d.district.id}>
                <Link
                  href={`/explorer?district=${d.district.id}`}
                  className="panel group flex h-full flex-col gap-3 p-3 transition sm:p-4 hover:-translate-y-0.5 hover:border-accent-dim"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="num text-[11px] font-bold text-text-faint">#{formatNumber(i + 1, lang)}</p>
                      <p className="truncate text-[16px] font-extrabold text-text">
                        {lang === "bn" ? d.district.name_bn : d.district.name_en}
                      </p>
                      <p className="truncate text-[11.5px] text-text-faint">
                        {divisionName(d.district.division, lang)}
                      </p>
                    </div>
                    <span
                      className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] min-[420px]:inline font-extrabold uppercase"
                      style={{ background: RISK_FILL[d.level].color, color: RISK_FILL[d.level].ink }}
                    >
                      {t(`risk.level.${d.level}`)}
                    </span>
                  </div>
                  <div className="mt-auto">
                    <div className="flex items-baseline justify-between">
                      <span className="num text-[22px] font-black leading-none sm:text-[28px]" style={{ color: RISK_FILL[d.level].color }}>
                        {formatPercent(d.probability, lang, 0)}
                      </span>
                      <span className="hidden text-[11px] text-text-faint sm:inline">{t("risk.chance")}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: RISK_FILL[d.level].color }} />
                    </div>
                  </div>
                </Link>
              </li>
            ) : (
              <li key={i} className="fw-skeleton h-[138px] rounded-[14px]" />
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

const FEATURES: Array<{ icon: string; title: StringKey; body: StringKey; href: string }> = [
  { icon: "🗺️", title: "home.f1.title", body: "home.f1.body", href: "/explorer" },
  { icon: "📈", title: "home.f2.title", body: "home.f2.body", href: "/explorer" },
  { icon: "✉️", title: "home.f3.title", body: "home.f3.body", href: "#alerts" },
  { icon: "🌐", title: "home.f4.title", body: "home.f4.body", href: "/about" },
];

export function HomeFeatures() {
  const { t } = useLanguage();
  return (
    <section className="border-t border-ink-700/70 py-12 sm:py-14">
      <p className="eyebrow">{t("home.features.eyebrow")}</p>
      <h2 className="mt-2 max-w-[32ch] text-balance text-[24px] font-extrabold leading-tight text-text sm:text-[30px]">
        {t("home.features.title")}
      </h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <Link
              href={f.href}
              className="panel group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-accent-dim"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-[22px] ring-1 ring-accent/20">
                {f.icon}
              </span>
              <h3 className="mt-4 text-[16px] font-extrabold text-text">{t(f.title)}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-text-dim">{t(f.body)}</p>
              <ArrowRight className="mt-4 size-4 text-text-faint transition group-hover:translate-x-1 group-hover:text-accent" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomeSteps() {
  const { t, lang } = useLanguage();
  const steps: Array<[string, StringKey, StringKey]> = [
    ["🛰️", "home.s1.title", "home.s1.body"],
    ["📊", "home.s2.title", "home.s2.body"],
    ["🔔", "home.s3.title", "home.s3.body"],
  ];
  return (
    <section className="border-t border-ink-700/70 py-12 sm:py-14">
      <p className="eyebrow">{t("home.steps.eyebrow")}</p>
      <ol className="relative mt-6 grid gap-6 md:grid-cols-3 md:gap-4">
        {/* connecting line on wide screens */}
        <span aria-hidden className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-accent/0 via-accent/50 to-accent/0 md:block" />
        {steps.map(([icon, title, body], i) => (
          <li key={title} className="relative text-center md:px-4">
            <span className="relative mx-auto grid size-14 place-items-center rounded-full border border-accent/40 bg-ink-850 text-[24px] shadow-[0_0_30px_-8px_#38bdf8]">
              {icon}
              <span className="num absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[10.5px] font-black text-ink-900">
                {formatNumber(i + 1, lang)}
              </span>
            </span>
            <h3 className="mt-4 text-[16px] font-extrabold text-text">{t(title)}</h3>
            <p className="mx-auto mt-1.5 max-w-[36ch] text-[13px] leading-relaxed text-text-dim">{t(body)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomeAlerts() {
  const { t } = useLanguage();
  const points: StringKey[] = ["home.alert.point1", "home.alert.point2", "home.alert.point3", "home.alert.point4"];
  return (
    <section id="alerts" className="scroll-mt-20 py-12 sm:py-14">
      <div className="relative overflow-hidden rounded-[22px] border border-accent/30 bg-gradient-to-br from-accent-deep/60 via-ink-800 to-ink-850 p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative grid items-start gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-sky-200">{t("home.alert.eyebrow")}</p>
            <h2 className="mt-2 text-balance text-[28px] font-extrabold leading-tight text-text sm:text-[36px]">
              {t("home.alert.title")}
            </h2>
            <p className="mt-3 max-w-[50ch] text-[14.5px] leading-relaxed text-text-dim">{t("sub.body")}</p>
            <ul className="mt-5 space-y-2.5">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[14px] text-text">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400 text-ink-900">
                    <CheckIcon className="size-3" />
                  </span>
                  {t(p)}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-5 sm:p-6">
            <h3 className="mb-4 text-[16px] font-extrabold text-text">✉ {t("sub.title")}</h3>
            <SubscribeForm />
          </div>
        </div>
      </div>
    </section>
  );
}
