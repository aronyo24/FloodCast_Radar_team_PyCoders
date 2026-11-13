"use client";

/**
 * District search (F14).
 *
 * A combobox with full keyboard support: type to filter, arrows to move,
 * Enter to go, Escape to dismiss. Matching works on the English name, the
 * Bangla name and the older geoBoundaries romanisation, so "Bogra", "Bogura"
 * and "বগুড়া" all land on the same district.
 */

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { getDistrictList } from "@/lib/api";
import { divisionName } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";

import { SearchIcon } from "./Icons";

interface Row {
  id: string;
  name_en: string;
  name_bn: string;
  /** Pre-2018 romanisation from geoBoundaries: Bogra, Jessore, Comilla, ... */
  source_name: string;
  division: string;
}

/** Shared across every mount - the list is 64 rows and never changes. */
let listPromise: Promise<{ districts: Row[] }> | null = null;

function normalise(value: string): string {
  // Keep ASCII alphanumerics and the Bengali block (U+0980-U+09FF); drop
  // spaces, apostrophes and diacritics so "Cox's Bazar" matches "coxsbazar".
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9ঀ-৿]/g, "");
}

export function DistrictSearch({
  onPick,
  compact = false,
}: {
  /** When given, selecting a district calls this instead of navigating. */
  onPick?: (id: string) => void;
  compact?: boolean;
}) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    listPromise ??= getDistrictList();
    let alive = true;
    listPromise
      .then((data) => alive && setRows(data.districts))
      .catch(() => {
        listPromise = null; // allow a retry on the next mount
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches = useMemo(() => {
    const q = normalise(query);
    if (!q) return [];
    const scored = rows
      .map((row) => {
        // Match the current spelling, the Bangla name, and the older
        // romanisation. Plenty of people still type "Bogra" or "Jessore",
        // and sending them to "no results" would be our bug, not theirs.
        const forms = [row.name_en, row.name_bn, row.source_name].map(normalise);
        const score = forms.some((f) => f.startsWith(q))
          ? 0
          : forms.some((f) => f.includes(q))
            ? 1
            : -1;
        return { row, score };
      })
      .filter((m) => m.score >= 0)
      .sort((a, b) => a.score - b.score || a.row.name_en.localeCompare(b.row.name_en));
    return scored.slice(0, 8).map((m) => m.row);
  }, [rows, query]);

  function choose(row: Row | undefined) {
    if (!row) return;
    setQuery("");
    setOpen(false);
    if (onPick) onPick(row.id);
    else router.push(`/district/${row.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.length > 0;

  return (
    <div ref={wrap} className={`relative ${compact ? "w-full" : "w-full sm:w-64"}`}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint" />
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("search.label")}
          autoComplete="off"
          value={query}
          placeholder={t("search.placeholder")}
          onChange={(e) => {
            setQuery(e.target.value);
            // Reset the highlight here rather than in an effect: the query only
            // ever changes from this handler.
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="tap w-full rounded-full border border-ink-600 bg-ink-850/80 py-2 pl-9 pr-3
                     text-sm text-text placeholder:text-text-faint
                     transition focus:border-accent-dim focus:bg-ink-800"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl
                     border border-ink-600 bg-ink-850/98 shadow-[0_26px_60px_-28px_#000] backdrop-blur fw-enter"
        >
          {matches.length === 0 && (
            <li className="px-3 py-3 text-sm text-text-faint">{t("search.empty")}</li>
          )}
          {matches.map((row, i) => (
            <li key={row.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(row)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left
                            transition ${i === active ? "bg-accent-deep/45" : "hover:bg-ink-700"}`}
              >
                <span className="text-sm font-semibold text-text">
                  {lang === "bn" ? row.name_bn : row.name_en}
                </span>
                <span className="text-[11px] text-text-faint">
                  {divisionName(row.division, lang)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
