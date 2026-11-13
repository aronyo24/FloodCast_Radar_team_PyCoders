"use client";

import Link from "next/link";

import { DistrictSearch } from "@/components/DistrictSearch";
import { useLanguage } from "@/lib/language";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="shell grid min-h-[60vh] place-items-center py-16">
      <div className="panel w-full max-w-lg p-7 text-center">
        <p className="num text-[56px] font-extrabold leading-none text-accent">404</p>
        <h1 className="mt-3 text-[22px] font-extrabold tracking-tight text-text">{t("err.404.title")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-text-dim">{t("err.404.body")}</p>
        <div className="mx-auto mt-5 max-w-xs text-left">
          <DistrictSearch compact />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Link href="/explorer/" className="tap inline-flex items-center rounded-xl bg-accent px-5 text-[14px] font-extrabold text-ink-900 hover:bg-sky-300">
            {t("home.cta")}
          </Link>
          <Link href="/" className="tap inline-flex items-center rounded-xl border border-ink-500 px-5 text-[14px] font-bold text-text hover:border-accent">
            {t("err.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
