"use client";

/**
 * Top-10 ranking (F7). Selecting a row zooms the map to that district.
 *
 * Unobserved districts are left out entirely rather than ranked at zero -
 * "we did not look" and "there was no water" are different claims and the
 * ranking must not blur them.
 */

import { floodClass } from "@/lib/colors";
import { formatArea, formatPercent } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { CycleDetail, District, DistrictId } from "@/types/floodwatch";

export function TopRanking({
  cycle,
  districts,
  selected,
  onSelect,
  limit = 10,
}: {
  cycle: CycleDetail | null;
  districts: District[];
  selected: DistrictId | null;
  onSelect: (id: DistrictId) => void;
  limit?: number;
}) {
  const { t, lang } = useLanguage();

  if (!cycle) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="fw-skeleton h-9" />
        ))}
      </div>
    );
  }

  const byId = new Map(districts.map((d) => [d.id, d]));
  const rows = Object.entries(cycle.districts)
    .filter(([, s]) => s.observed && s.flooded_pct !== null)
    .map(([id, s]) => ({ district: byId.get(id), stat: s }))
    .filter((r): r is { district: District; stat: (typeof r)["stat"] } =>
      Boolean(r.district),
    )
    .sort((a, b) => (b.stat.flooded_pct ?? 0) - (a.stat.flooded_pct ?? 0))
    .slice(0, limit);

  const top = rows[0]?.stat.flooded_pct ?? 1;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="eyebrow">{t("ranking.title")}</p>
        <p className="text-[11px] text-text-faint">{t("ranking.subtitle")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-faint">
          {t("ranking.empty")}
        </p>
      ) : (
        <ol className="min-h-0 flex-1 space-y-[3px] overflow-y-auto pr-1.5">
          {rows.map((row, i) => {
            const pct = row.stat.flooded_pct ?? 0;
            const cls = floodClass(pct);
            const active = row.district.id === selected;
            return (
              <li key={row.district.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.district.id)}
                  aria-current={active ? "true" : undefined}
                  className={`group relative flex w-full items-center gap-2.5 overflow-hidden
                              rounded-lg px-2 py-1.5 text-left transition
                              ${active ? "bg-accent-deep/50 ring-1 ring-accent/50" : "hover:bg-ink-700/70"}`}
                >
                  {/* Bar length repeats the percentage so the ranking is readable
                      without relying on the colour alone. */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 -z-0 rounded-lg opacity-25 transition-[width]"
                    style={{
                      width: `${Math.max(4, (pct / Math.max(top, 1)) * 100)}%`,
                      background: cls?.color ?? "#64748b",
                    }}
                  />
                  <span className="num relative z-10 w-4 shrink-0 text-right text-[11px] font-bold text-text-faint">
                    {i + 1}
                  </span>
                  <span className="relative z-10 min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
                    {lang === "bn" ? row.district.name_bn : row.district.name_en}
                  </span>
                  <span className="relative z-10 shrink-0 pl-1 text-right">
                    <span className="num block text-[13px] font-extrabold leading-none text-text">
                      {formatPercent(pct, lang, 0)}
                    </span>
                    <span className="num block text-[10px] leading-tight text-text-faint">
                      {formatArea(row.stat.flooded_km2, lang)} {t("common.km2")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-2 border-t border-ink-700 pt-2 text-[11px] text-text-faint">
        {t("ranking.hint")}
      </p>
    </div>
  );
}
