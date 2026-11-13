"use client";

import Link from "next/link";
import { useState } from "react";

import { bmdDeleteReport } from "@/lib/bmd";
import { districtName, formatNumber } from "@/lib/format";
import { divisionName } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import type { BmdReport } from "@/types/bmd";

import { formatDhaka, LEVEL_STYLE, LevelBadge, TrendLabel, useTimeAgo, VerifiedMark } from "./ui";

export function ReportCard({
  report,
  onDeleted,
  showDistrict = true,
}: {
  report: BmdReport;
  onDeleted?: (id: number) => void;
  showDistrict?: boolean;
}) {
  const { t, lang } = useLanguage();
  const ago = useTimeAgo();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const r = report;

  const gap =
    r.water_level_m !== null && r.danger_level_m !== null ? Math.round((r.water_level_m - r.danger_level_m) * 100) : null;

  async function withdraw() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await bmdDeleteReport(r.id);
      onDeleted?.(r.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      setConfirming(false);
    }
  }

  const facts: Array<[string, string]> = [];
  if (r.rainfall_24h_mm !== null) facts.push([t("bmd.f.rainfall"), formatNumber(r.rainfall_24h_mm, lang, 1)]);
  if (r.water_level_m !== null)
    facts.push([
      r.river_station ? `${t("bmd.f.waterLevel")} · ${r.river_station}` : t("bmd.f.waterLevel"),
      formatNumber(r.water_level_m, lang, 2),
    ]);
  if (r.danger_level_m !== null) facts.push([t("bmd.f.dangerLevel"), formatNumber(r.danger_level_m, lang, 2)]);
  if (r.affected_people !== null) facts.push([t("bmd.f.affected"), formatNumber(r.affected_people, lang)]);
  if (r.shelters_open !== null) facts.push([t("bmd.f.shelters"), formatNumber(r.shelters_open, lang)]);

  return (
    <article
      id={`report-${r.id}`}
      className={`panel-flat scroll-mt-24 border-l-4 ${LEVEL_STYLE[r.level].ring} p-4 sm:p-5 fw-enter`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {showDistrict && (
            <h3 className="text-[16px] font-extrabold tracking-tight text-text">
              <Link href={`/district/${r.district.id}/`} className="hover:text-accent">
                {districtName(r.district, lang)}
              </Link>
              <span className="ml-2 text-[12px] font-semibold text-text-faint">
                {divisionName(r.district.division, lang)}
              </span>
            </h3>
          )}
          <p className="mt-0.5 text-[12px] text-text-faint">
            <time dateTime={r.observed_at} title={formatDhaka(r.observed_at, lang)}>
              {t("bmd.f.observedAt")} {formatDhaka(r.observed_at, lang)} · {ago(r.observed_at)}
            </time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r.mine && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
              {t("bmd.r.yours")}
            </span>
          )}
          <TrendLabel trend={r.water_trend} />
          <LevelBadge level={r.level} />
        </div>
      </header>

      {gap !== null && (
        <p className={`mt-3 text-[12.5px] font-bold ${gap > 0 ? "text-red-300" : "text-emerald-300"}`}>
          {gap > 0
            ? t("bmd.f.aboveDanger", { cm: formatNumber(gap, lang) })
            : t("bmd.f.belowDanger", { cm: formatNumber(-gap, lang) })}
        </p>
      )}

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <section>
          <h4 className="eyebrow mb-1">{t("bmd.f.conditions")}</h4>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-text">{r.conditions}</p>
        </section>
        <section>
          <h4 className="eyebrow mb-1">{t("bmd.f.actions")}</h4>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-text">{r.actions_taken}</p>
        </section>
      </div>

      {r.needs && (
        <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-300">{t("bmd.r.needs")}</h4>
          <p className="mt-0.5 whitespace-pre-line text-[13px] text-amber-50/90">{r.needs}</p>
        </div>
      )}

      {facts.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-ink-900/50 px-2.5 py-2">
              <dt className="truncate text-[10.5px] font-semibold text-text-faint" title={k}>
                {k}
              </dt>
              <dd className="num mt-0.5 text-[15px] font-extrabold text-text">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-3">
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-text-dim">
          <span className="font-bold text-text">{r.officer.name}</span>
          <span>
            {r.officer.designation} · {r.officer.office}
          </span>
          <VerifiedMark verified={r.officer.verified} />
        </p>
        {r.mine && (
          <div className="flex items-center gap-2">
            {confirming && <span className="text-[11.5px] text-red-200">{t("bmd.r.confirmDelete")}</span>}
            <Link
              href={`/bmd/submit/?edit=${r.id}`}
              className="rounded-lg border border-ink-500 px-3 py-1.5 text-[12px] font-bold text-text-dim hover:border-accent hover:text-text"
            >
              {t("bmd.r.edit")}
            </Link>
            <button
              type="button"
              onClick={withdraw}
              onBlur={() => setConfirming(false)}
              disabled={busy}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-60
                          ${confirming ? "border-red-500 bg-red-500/20 text-red-100" : "border-ink-500 text-text-dim hover:border-red-400 hover:text-red-200"}`}
            >
              {t("bmd.r.delete")}
            </button>
          </div>
        )}
      </footer>
      {error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}
    </article>
  );
}
