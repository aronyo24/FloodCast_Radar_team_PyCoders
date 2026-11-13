"use client";

/**
 * "Get flood alerts" button for the site header, with a modal sign-up form.
 * Available on every page, so nobody has to find a district on the map first.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "@/lib/language";

import { SubscribeForm } from "./SubscribeForm";

export function AlertSignup({ block = false }: { block?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative flex items-center justify-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[13px] font-extrabold
                    text-ink-900 shadow-[0_6px_20px_-8px_#38bdf8] transition hover:bg-sky-300 ${block ? "tap w-full" : ""}`}
      >
        <BellIcon className="size-4" />
        {t("sub.cta")}
        <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
        </span>
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-[1200] grid place-items-center overflow-y-auto p-4">
          <div aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 bg-ink-900/75 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-signup-title"
            className="panel relative w-full max-w-[520px] p-5 fw-enter sm:p-6"
          >
            <button
              ref={closeBtn}
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="tap absolute right-2 top-2 grid place-items-center rounded-full text-text-faint hover:text-text"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
            <div className="mb-4 flex items-start gap-3 pr-8">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
                <BellIcon className="size-6" />
              </span>
              <div>
                <h2 id="alert-signup-title" className="text-[18px] font-extrabold leading-tight text-text">
                  {t("sub.title")}
                </h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text-faint">{t("sub.body")}</p>
              </div>
            </div>
            <ol className="mb-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-text-dim">
              {["🛰 NISAR", "📊 Risk", "✉ E-mail"].map((step, i) => (
                <li key={step} className="panel-flat px-2 py-2">
                  <span className="block text-[10px] text-text-faint">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <SubscribeForm />
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinejoin="round" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  );
}
