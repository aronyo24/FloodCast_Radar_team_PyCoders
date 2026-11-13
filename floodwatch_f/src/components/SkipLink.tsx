"use client";

import { useLanguage } from "@/lib/language";

export function SkipLink() {
  const { t } = useLanguage();
  return (
    <a href="#main" className="skip-link">
      {t("common.skipToContent")}
    </a>
  );
}
