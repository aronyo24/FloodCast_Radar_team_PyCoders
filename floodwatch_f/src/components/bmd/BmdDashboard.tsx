"use client";

/**
 * BMD Field Situation Dashboard: KPIs, a district status board and the
 * filterable feed of officer reports. Public; officers get extra actions.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { bmdReports, bmdSummary } from "@/lib/bmd";
import { districtName, formatNumber } from "@/lib/format";
import { DIVISION_BN, divisionName } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import { useOfficer } from "@/lib/officer";
import { BMD_LEVELS, type BmdLevel, type BmdReport, type BmdSummary } from "@/types/bmd";

import { RefreshIcon } from "../Icons";
import { ReportCard } from "./ReportCard";
import {
  BmdMark,
  ErrorNote,
  inputClass,
  LEVEL_STYLE,
  LevelBadge,
  TrendLabel,
  useDistricts,
  useTimeAgo,
  VerifiedMark,
} from "./ui";

const PAGE = 20;
const DIVISIONS = Object.keys(DIVISION_BN);

export function BmdDashboard() {
  const { t, lang } = useLanguage();
  const { officer, loading: authLoading } = useOfficer();
  const districts = useDistricts();
  const ago = useTimeAgo();

  const [summary, setSummary] = useState<BmdSummary | null>(null);
  const [reports, setReports] = useState<BmdReport[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const [district, setDistrict] = useState("");
  const [division, setDivision] = useState("");
  const [level, setLevel] = useState<BmdLevel | "">("");
  const [hours, setHours] = useState<number | "">("");
  const [verified, setVerified] = useState(false);
  const [mine, setMine] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useMemo(
    () => ({ district, division, level, hours, verified, mine: mine && !!officer }),
    [district, division, level, hours, verified, mine, officer],
  );

  // Filters changed: back to the first page.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setLimit(PAGE);
  }

  useEffect(() => {
    let alive = true;
    bmdSummary()
      .then((s) => alive && setSummary(s))
      .catch(() => alive && setError(t("bmd.loadError")));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    bmdReports({ ...query, limit })
      .then((r) => {
        if (!alive) return;
        setReports(r.reports);
        setTotal(r.count);
        setError("");
      })
      .catch(() => alive && setError(t("bmd.loadError")))
      .finally(() => alive && setLoadingMore(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, limit, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const onDeleted = (id: number) => {
    setReports((rs) => rs?.filter((r) => r.id !== id) ?? null);
    setTotal((n) => Math.max(0, n - 1));
    refresh();
  };

  const visibleDistricts = division ? districts.filter((d) => d.division === division) : districts;
  const select = `${inputClass} border-ink-600 py-2 text-[13px]`;

  return (
    <div className="shell py-8 lg:py-10">
      {/* ---- header ------------------------------------------------------- */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <BmdMark className="mt-1 size-14 shrink-0" />
          <div>
            <p className="eyebrow">{t("bmd.org")}</p>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-text sm:text-[34px]">
              {t("bmd.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-text-dim">{t("bmd.lede")}</p>
          </div>
        </div>

        <OfficerBox />
      </header>

      {error && (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      )}

      {/* ---- KPIs --------------------------------------------------------- */}
      <section aria-label="Key figures" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("bmd.kpi.reports24")} value={summary ? formatNumber(summary.reports_24h, lang) : null} />
        <Kpi
          label={t("bmd.kpi.districts")}
          value={summary ? formatNumber(summary.districts_reporting_7d, lang) : null}
          suffix={summary ? ` / ${formatNumber(summary.districts_total, lang)}` : ""}
        />
        <Kpi
          label={t("bmd.kpi.danger")}
          value={summary ? formatNumber(summary.danger_or_worse, lang) : null}
          tone={summary && summary.danger_or_worse > 0 ? "danger" : undefined}
        />
        <Kpi
          label={t("bmd.kpi.affected")}
          value={summary ? formatNumber(summary.people_affected, lang) : null}
          foot={summary ? t("bmd.kpi.shelters", { n: formatNumber(summary.shelters_open, lang) }) : ""}
        />
      </section>

      {summary && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-text-faint">
          <LevelDistribution counts={summary.by_level} />
          <span>
            {t("bmd.kpi.officers", {
              verified: formatNumber(summary.officers_verified, lang),
              total: formatNumber(summary.officers, lang),
            })}
          </span>
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---- feed ------------------------------------------------------- */}
        <section aria-labelledby="feed-title" className="min-w-0 xl:order-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="feed-title" className="text-[20px] font-extrabold tracking-tight text-text">
              {t("bmd.feed.title")}
            </h2>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-3 py-1.5 text-[12px] font-bold text-text-dim hover:border-accent hover:text-text"
            >
              <RefreshIcon className="size-3.5" />
              {t("bmd.refresh")}
            </button>
          </div>

          {/* filters */}
          <div className="panel-flat mt-3 grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <select aria-label={t("bmd.filter.allDivisions")} value={division} onChange={(e) => { setDivision(e.target.value); setDistrict(""); }} className={select}>
              <option value="">{t("bmd.filter.allDivisions")}</option>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>{divisionName(d, lang)}</option>
              ))}
            </select>
            <select aria-label={t("bmd.filter.allDistricts")} value={district} onChange={(e) => setDistrict(e.target.value)} className={select}>
              <option value="">{t("bmd.filter.allDistricts")}</option>
              {visibleDistricts.map((d) => (
                <option key={d.id} value={d.id}>{districtName(d, lang)}</option>
              ))}
            </select>
            <select aria-label={t("bmd.level")} value={level} onChange={(e) => setLevel(e.target.value as BmdLevel | "")} className={select}>
              <option value="">{t("bmd.level")}: {t("bmd.filter.all")}</option>
              {BMD_LEVELS.map((l) => (
                <option key={l} value={l}>{t(`bmd.level.${l}`)}</option>
              ))}
            </select>
            <select
              aria-label={t("bmd.filter.anyTime")}
              value={hours}
              onChange={(e) => setHours(e.target.value ? Number(e.target.value) : "")}
              className={select}
            >
              <option value="">{t("bmd.filter.anyTime")}</option>
              <option value={24}>{t("bmd.filter.24h")}</option>
              <option value={72}>{t("bmd.filter.72h")}</option>
              <option value={168}>{t("bmd.filter.7d")}</option>
            </select>
            <div className="flex flex-wrap gap-x-5 gap-y-1 sm:col-span-2 lg:col-span-4">
              <Check checked={verified} onChange={setVerified} label={t("bmd.filter.verifiedOnly")} />
              {officer && <Check checked={mine} onChange={setMine} label={t("bmd.filter.mine")} />}
            </div>
          </div>

          <div className="mt-4 space-y-3" aria-live="polite">
            {reports === null && !error && [0, 1, 2].map((i) => <div key={i} className="fw-skeleton h-44" />)}
            {reports?.length === 0 && (
              <div className="panel-flat p-8 text-center">
                <p className="text-[14px] text-text-dim">{t("bmd.feed.empty")}</p>
                {!authLoading && (
                  <Link
                    href={officer ? "/bmd/submit/" : "/bmd/login/"}
                    className="mt-3 inline-block text-[13px] font-bold text-accent hover:underline"
                  >
                    {officer ? t("bmd.submit") : t("bmd.signin")} →
                  </Link>
                )}
              </div>
            )}
            {reports?.map((r) => <ReportCard key={r.id} report={r} onDeleted={onDeleted} />)}
          </div>

          {reports && reports.length > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-text-faint">
              <span>
                {t("bmd.feed.count", {
                  shown: formatNumber(reports.length, lang),
                  total: formatNumber(total, lang),
                })}
              </span>
              {reports.length < total && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    setLoadingMore(true);
                    setLimit((l) => Math.min(200, l + PAGE));
                  }}
                  className="tap rounded-xl border border-ink-500 px-4 text-[13px] font-bold text-text hover:border-accent disabled:opacity-60"
                >
                  {t("bmd.feed.more")}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ---- status board ---------------------------------------------- */}
        <aside aria-labelledby="board-title" className="xl:order-2">
          <div className="panel p-4 xl:sticky xl:top-20">
            <h2 id="board-title" className="text-[16px] font-extrabold tracking-tight text-text">
              {t("bmd.board.title")}
            </h2>
            <p className="mt-0.5 text-[12px] text-text-faint">{t("bmd.board.sub")}</p>
            <ul className="mt-3 max-h-[70vh] divide-y divide-ink-700 overflow-y-auto pr-1">
              {summary === null && !error && [0, 1, 2, 3].map((i) => <li key={i} className="fw-skeleton my-2 h-12" />)}
              {summary?.board.length === 0 && (
                <li className="py-6 text-center text-[13px] text-text-faint">{t("bmd.board.empty")}</li>
              )}
              {summary?.board.map((row) => (
                <li key={row.district.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDivision("");
                      setDistrict(row.district.id);
                      document.getElementById("feed-title")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-1.5 py-2.5 text-left transition hover:bg-ink-700/60"
                  >
                    <span aria-hidden className={`h-9 w-1 shrink-0 rounded-full ${LEVEL_STYLE[row.level].bar}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13.5px] font-bold text-text">{districtName(row.district, lang)}</span>
                        <LevelBadge level={row.level} />
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-text-faint">
                        <TrendLabel trend={row.water_trend} />
                        <span>{ago(row.observed_at)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function OfficerBox() {
  const { t, lang } = useLanguage();
  const { officer, loading, signOut } = useOfficer();

  if (loading) return <div className="fw-skeleton h-24 w-full lg:w-80" />;

  if (!officer) {
    return (
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/bmd/login/"
          className="tap inline-flex items-center rounded-xl bg-accent px-5 text-[14px] font-extrabold text-ink-900 hover:bg-sky-300"
        >
          {t("bmd.signin")}
        </Link>
        <Link
          href="/bmd/register/"
          className="tap inline-flex items-center rounded-xl border border-ink-500 px-5 text-[14px] font-bold text-text hover:border-accent"
        >
          {t("bmd.register")}
        </Link>
      </div>
    );
  }

  return (
    <div className="panel w-full p-4 lg:w-[360px]">
      <p className="eyebrow">{t("bmd.signedInAs")}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] font-extrabold text-text">
        {officer.name}
        <VerifiedMark verified={officer.verified} />
      </p>
      <p className="text-[12.5px] text-text-dim">
        {officer.designation} · {districtName(officer.station, lang)}
      </p>
      {officer.status === "pending" && (
        <p className="mt-2 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-amber-200">
          {t("bmd.pending.hint")}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Link
          href="/bmd/submit/"
          className="tap inline-flex flex-1 items-center justify-center rounded-xl bg-accent px-4 text-[13.5px] font-extrabold text-ink-900 hover:bg-sky-300"
        >
          + {t("bmd.submit")}
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className="tap rounded-xl border border-ink-500 px-3 text-[13px] font-bold text-text-dim hover:text-text"
        >
          {t("bmd.signout")}
        </button>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  suffix = "",
  foot,
  tone,
}: {
  label: string;
  value: string | null;
  suffix?: string;
  foot?: string;
  tone?: "danger";
}) {
  return (
    <div className={`panel p-4 ${tone === "danger" ? "border-red-500/50" : ""}`}>
      <p className="text-[11.5px] font-semibold text-text-faint">{label}</p>
      {value === null ? (
        <div className="fw-skeleton mt-2 h-8 w-20" />
      ) : (
        <p className={`num mt-1 text-[30px] font-extrabold leading-none ${tone === "danger" ? "text-red-300" : "text-text"}`}>
          {value}
          <span className="text-[15px] font-bold text-text-faint">{suffix}</span>
        </p>
      )}
      {foot && <p className="mt-1.5 text-[11.5px] text-text-faint">{foot}</p>}
    </div>
  );
}

function LevelDistribution({ counts }: { counts: Record<BmdLevel, number> }) {
  const { t, lang } = useLanguage();
  const sum = BMD_LEVELS.reduce((a, l) => a + counts[l], 0);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex h-2 w-40 shrink-0 overflow-hidden rounded-full bg-ink-700 sm:w-64" aria-hidden>
        {sum > 0 &&
          BMD_LEVELS.map((l) =>
            counts[l] ? (
              <span key={l} className={LEVEL_STYLE[l].bar} style={{ width: `${(counts[l] / sum) * 100}%` }} />
            ) : null,
          )}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {BMD_LEVELS.map((l) => (
          <li key={l} className="inline-flex items-center gap-1">
            <span aria-hidden className={`size-2 rounded-full ${LEVEL_STYLE[l].bar}`} />
            {t(`bmd.level.${l}`)} {formatNumber(counts[l], lang)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-text-dim">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-sky-400"
      />
      {label}
    </label>
  );
}
