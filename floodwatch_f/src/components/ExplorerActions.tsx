"use client";

/**
 * CSV download (F16), shareable link (F15) and the admin update button (F17).
 *
 * The update button is an operator action. Against the Django backend only
 * staff may run it (sign in at /admin/); with the bundled demo routes there
 * is no auth. Either way it reports exactly what happened rather than
 * flashing a reassuring tick.
 */

import { useEffect, useState } from "react";

import { ApiError, csvUrl, runUpdate } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import type { UpdateResult } from "@/types/floodwatch";

import { CheckIcon, DownloadIcon, LinkIcon, RefreshIcon } from "./Icons";
import { InfoTip } from "./InfoTip";

const BUTTON =
  "tap inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800/80 px-3 " +
  "text-[12.5px] font-semibold text-text-dim transition hover:border-accent-dim hover:text-text " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function ExplorerActions({ cycleDate }: { cycleDate: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the URL bar already holds the shareable link.
      window.prompt("Copy this link", window.location.href);
    }
  }

  async function check() {
    setUpdating(true);
    setResult(null);
    try {
      setResult(await runUpdate());
    } catch (err) {
      setResult({
        ok: false,
        checked_at: new Date().toISOString(),
        granules_found: 0,
        new_cycles: [],
        latest_cycle: "",
        message:
          err instanceof ApiError && (err.status === 401 || err.status === 403)
            ? t("action.update.auth")
            : err instanceof Error
              ? err.message
              : "Update failed",
        duration_ms: 0,
      });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={csvUrl(cycleDate)} download className={BUTTON}>
        <DownloadIcon className="size-4" />
        {t("action.csv")}
      </a>
      <InfoTip label={t("action.csv.hint")} align="start" />

      <button type="button" onClick={copyLink} className={BUTTON}>
        {copied ? (
          <CheckIcon className="size-4 text-ok" />
        ) : (
          <LinkIcon className="size-4" />
        )}
        {copied ? t("action.copied") : t("action.copyLink")}
      </button>

      <button type="button" onClick={check} disabled={updating} className={BUTTON}>
        <RefreshIcon className={`size-4 ${updating ? "fw-pulse" : ""}`} />
        {updating ? t("action.update.running") : t("action.update")}
      </button>

      {result && (
        <p
          role="status"
          className={`w-full text-[11.5px] sm:w-auto ${
            result.ok ? "text-text-faint" : "text-amber-300"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
