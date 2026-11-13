"use client";

/**
 * Sign-up for automatic flood e-mails.
 *
 * Name, e-mail, district and the level that should trigger a message. The
 * backend sends a welcome e-mail with today's outlook straight away, then an
 * alert after every radar pass that pushes the district to that level.
 */

import { useEffect, useId, useState, type FormEvent } from "react";

import { ApiError, getDistrictList, subscribe } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import type { DistrictId, SubscribeRequest } from "@/types/floodwatch";

import { CheckIcon } from "./Icons";

type Row = { id: DistrictId; name_en: string; name_bn: string };
let listPromise: Promise<{ districts: Row[] }> | null = null;

const LEVELS: SubscribeRequest["min_level"][] = ["moderate", "high", "severe"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function SubscribeForm({
  district,
  compact = false,
}: {
  /** Pre-selected district; the user can still change it. */
  district?: DistrictId | null;
  compact?: boolean;
}) {
  const { t, lang } = useLanguage();
  const uid = useId();
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<DistrictId>(district ?? "");
  const [level, setLevel] = useState<SubscribeRequest["min_level"]>("moderate");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  // Follow the drawer when the user clicks a different district on the map.
  const [lastProp, setLastProp] = useState(district);
  if (district !== lastProp) {
    setLastProp(district);
    if (district) setPicked(district);
  }

  useEffect(() => {
    listPromise ??= getDistrictList();
    let alive = true;
    listPromise
      .then((d) => alive && setRows(d.districts))
      .catch(() => {
        listPromise = null;
      });
    return () => {
      alive = false;
    };
  }, []);

  const sorted = [...rows].sort((a, b) =>
    lang === "bn" ? a.name_bn.localeCompare(b.name_bn, "bn") : a.name_en.localeCompare(b.name_en),
  );
  const pickedRow = rows.find((r) => r.id === picked);
  const pickedName = pickedRow ? (lang === "bn" ? pickedRow.name_bn : pickedRow.name_en) : picked;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = t("sub.invalid.name");
    if (!EMAIL_RE.test(email.trim())) next.email = t("sub.invalid.email");
    if (!picked) next.district = t("sub.invalid.district");
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("sending");
    try {
      await subscribe({
        name: name.trim(),
        email: email.trim(),
        district: picked,
        min_level: level,
        language: lang,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        setMessage(err.status === 429 ? "Too many sign-ups from this network. Please try again later." : err.message);
      } else {
        setMessage(t("common.error"));
      }
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] p-4 fw-enter" role="status">
        <p className="flex items-center gap-2 text-[14px] font-bold text-emerald-200">
          <span className="grid size-6 place-items-center rounded-full bg-emerald-400 text-ink-900">
            <CheckIcon className="size-3.5" />
          </span>
          {t("sub.done")}
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-emerald-100/80">
          {t("sub.done.body", { name: pickedName, email: email.trim() })}
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setPicked("");
          }}
          className="mt-3 text-[12.5px] font-bold text-accent hover:underline"
        >
          {t("sub.another")}
        </button>
      </div>
    );
  }

  const input =
    "w-full rounded-lg border bg-ink-900/70 px-3 py-2.5 text-[13.5px] text-text placeholder:text-text-faint " +
    "outline-none transition focus:border-accent";
  const border = (k: string) => (errors[k] ? "border-severe" : "border-ink-600");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2.5">
      <div className={compact ? "grid gap-2.5" : "grid gap-2.5 sm:grid-cols-2"}>
        <Field id={`${uid}-name`} label={t("sub.name")} error={errors.name}>
          <input
            id={`${uid}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={100}
            className={`${input} ${border("name")}`}
            aria-invalid={!!errors.name}
          />
        </Field>
        <Field id={`${uid}-email`} label={t("sub.email")} error={errors.email}>
          <input
            id={`${uid}-email`}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@example.com"
            className={`${input} ${border("email")}`}
            aria-invalid={!!errors.email}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field id={`${uid}-district`} label={t("sub.district")} error={errors.district}>
          <select
            id={`${uid}-district`}
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className={`${input} ${border("district")}`}
            aria-invalid={!!errors.district}
          >
            <option value="">{t("sub.district.pick")}</option>
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>
                {lang === "bn" ? r.name_bn : r.name_en}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${uid}-level`} label={t("sub.level")}>
          <select
            id={`${uid}-level`}
            value={level}
            onChange={(e) => setLevel(e.target.value as SubscribeRequest["min_level"])}
            className={`${input} border-ink-600`}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`sub.level.${l}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {status === "error" && message && (
        <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="tap w-full rounded-xl bg-accent px-4 text-[14px] font-extrabold text-ink-900 shadow-[0_8px_24px_-10px_#38bdf8]
                   transition hover:bg-sky-300 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "sending" ? t("sub.sending") : t("sub.submit")}
      </button>
      <p className="text-center text-[11px] text-text-faint">{t("sub.privacy")}</p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[11.5px] font-semibold text-text-dim">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-300">{error}</p>}
    </div>
  );
}
