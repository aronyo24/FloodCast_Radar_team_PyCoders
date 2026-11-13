"use client";

/** Bangla / English switch (F13). A two-option radio group, not a checkbox. */

import { LANGS, LANG_LABEL, LANG_NAME } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t("lang.switch")}
      className={`inline-flex items-center rounded-full border border-ink-600 bg-ink-850/80 p-0.5 ${className}`}
    >
      {LANGS.map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LANG_NAME[code]}
            onClick={() => setLang(code)}
            className={`min-h-[36px] rounded-full px-3 text-[12px] font-bold transition
                        ${active
                          ? "bg-accent text-ink-900 shadow-[0_2px_10px_-2px_#38bdf8aa]"
                          : "text-text-dim hover:text-text"}`}
          >
            {LANG_LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}
