"use client";

/**
 * Footer credits. The data and boundary lines are required attribution, not
 * decoration: geoBoundaries is CC BY, which obliges us to name it.
 */

import Link from "next/link";

import { ATTRIBUTION } from "@/lib/attribution";
import { useLanguage } from "@/lib/language";

export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="mt-auto border-t border-ink-700/80 bg-ink-900/60">
      <div className="shell grid gap-6 py-8 text-[12px] leading-relaxed text-text-faint sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[13px] font-extrabold tracking-tight text-text">
            FloodCast<span className="text-accent"> Radar</span>
          </p>
          <p className="mt-1.5 max-w-[26ch]">{t("app.tagline")}</p>
        </div>

        <div>
          <p className="eyebrow mb-2">{t("footer.data")}</p>
          <p>{ATTRIBUTION.mission}</p>
          <p>
            {ATTRIBUTION.distributor} · {ATTRIBUTION.provisionalNote}
          </p>
        </div>

        <div>
          <p className="eyebrow mb-2">{t("footer.boundaries")}</p>
          <p>
            <a
              href={ATTRIBUTION.boundaries.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-ink-500 underline-offset-2 hover:text-text-dim"
            >
              {ATTRIBUTION.boundaries.name}
            </a>
          </p>
          <p>{ATTRIBUTION.boundaries.licence}</p>
        </div>

        <div>
          <p className="eyebrow mb-2">{t("footer.built")}</p>
          <p>{t("footer.challenge")}</p>
          <Link
            href="/how-it-works"
            className="mt-1 inline-flex min-h-[44px] items-center font-semibold text-accent
                       hover:text-sky-300"
          >
            {t("footer.howItWorks")} →
          </Link>
        </div>
      </div>
    </footer>
  );
}
