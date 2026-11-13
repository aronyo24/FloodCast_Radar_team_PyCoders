"use client";

/**
 * Any page whose server render throws (most often: the Django backend is not
 * running) lands here instead of on a blank framework error screen.
 */

import Link from "next/link";
import { useEffect } from "react";

import { AlertIcon } from "@/components/Icons";
import { useLanguage } from "@/lib/language";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="shell grid min-h-[60vh] place-items-center py-16">
      <div className="panel max-w-lg p-7 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-500/15 text-red-300">
          <AlertIcon className="size-6" />
        </span>
        <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-text">{t("err.title")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-text-dim">{t("err.body")}</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-text-faint">ref {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="tap rounded-xl bg-accent px-5 text-[14px] font-extrabold text-ink-900 hover:bg-sky-300"
          >
            {t("err.retry")}
          </button>
          <Link
            href="/"
            className="tap inline-flex items-center rounded-xl border border-ink-500 px-5 text-[14px] font-bold text-text hover:border-accent"
          >
            {t("err.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
