"use client";

/**
 * The two provenance chips (F6).
 *
 * "Provisional NISAR data" has to be visible on the Explorer and the district
 * pages - that is an explicit line in the acceptance checklist. The "Demo data"
 * chip sits next to it whenever the flood extents are generated rather than
 * measured, and a judge should never have to dig for that.
 *
 * Both follow `meta` (`demo_data`, `provisional`). They default to shown: a
 * page that does not know where its numbers came from must not imply they
 * are real.
 */

import { useLanguage } from "@/lib/language";

import { InfoTip } from "./InfoTip";

export function ProvisionalBadge({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-400/35
                  bg-amber-400/10 py-1 pl-2.5 pr-1 text-[11px] font-semibold
                  tracking-wide text-amber-200 ${className}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-amber-400" />
      {t("badge.provisional")}
      <InfoTip label={t("badge.provisional.hint")} />
    </span>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-sky-400/35
                  bg-sky-400/10 py-1 pl-2.5 pr-1 text-[11px] font-semibold
                  tracking-wide text-sky-200 ${className}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-sky-400" />
      {t("badge.demo")}
      <InfoTip label={t("badge.demo.hint")} />
    </span>
  );
}

export function ProvenanceBadges({
  className = "",
  demo = true,
  provisional = true,
}: {
  className?: string;
  demo?: boolean;
  provisional?: boolean;
}) {
  if (!demo && !provisional) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {provisional && <ProvisionalBadge />}
      {demo && <DemoBadge />}
    </div>
  );
}
