"use client";

/** File a new field report, or edit one of your own (?edit=<id>). */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api";
import { bmdCreateReport, bmdReport, bmdUpdateReport } from "@/lib/bmd";
import { districtName } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import { useOfficer } from "@/lib/officer";
import { BMD_LEVELS, BMD_TRENDS, type BmdReport, type BmdReportInput } from "@/types/bmd";

import {
  BmdMark,
  borderFor,
  ErrorNote,
  Field,
  FormSection,
  inputClass,
  LEVEL_STYLE,
  localInputValue,
  PrimaryButton,
  VerifiedMark,
} from "./ui";

function blank(): BmdReportInput {
  return {
    level: "",
    water_trend: "unknown",
    rainfall_24h_mm: "",
    river_station: "",
    water_level_m: "",
    danger_level_m: "",
    affected_people: "",
    shelters_open: "",
    conditions: "",
    actions_taken: "",
    needs: "",
    observed_at: localInputValue(),
  };
}

function fromReport(r: BmdReport): BmdReportInput {
  const s = (v: number | null) => (v === null ? "" : String(v));
  return {
    level: r.level,
    water_trend: r.water_trend,
    rainfall_24h_mm: s(r.rainfall_24h_mm),
    river_station: r.river_station,
    water_level_m: s(r.water_level_m),
    danger_level_m: s(r.danger_level_m),
    affected_people: s(r.affected_people),
    shelters_open: s(r.shelters_open),
    conditions: r.conditions,
    actions_taken: r.actions_taken,
    needs: r.needs,
    observed_at: localInputValue(new Date(r.observed_at)),
  };
}

export function ReportForm() {
  const { t, lang } = useLanguage();
  const uid = useId();
  const router = useRouter();
  const editId = Number(useSearchParams().get("edit")) || null;
  const { officer, loading, refresh } = useOfficer();

  const [form, setForm] = useState<BmdReportInput>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadedEdit, setLoadedEdit] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !officer) {
      router.replace(`/bmd/login/?next=${encodeURIComponent(`/bmd/submit/${editId ? `?edit=${editId}` : ""}`)}`);
    }
  }, [loading, officer, router, editId]);

  useEffect(() => {
    if (!editId || !officer || loadedEdit === editId) return;
    let alive = true;
    bmdReport(editId)
      .then((r) => {
        if (!alive) return;
        if (!r.mine) {
          setMessage("You can only edit your own reports.");
          return;
        }
        setForm(fromReport(r));
        setLoadedEdit(editId);
      })
      .catch((err) => alive && setMessage((err as Error).message));
    return () => {
      alive = false;
    };
  }, [editId, officer, loadedEdit]);

  const set = (k: keyof BmdReportInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.level) next.level = t("bmd.a.required");
    if (form.conditions.trim().length < 10) next.conditions = t("bmd.f.conditions.hint");
    if (form.actions_taken.trim().length < 10) next.actions_taken = t("bmd.f.actions.hint");
    if (form.observed_at && new Date(form.observed_at).getTime() > Date.now() + 10 * 60_000)
      next.observed_at = "Observation time cannot be in the future.";
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage("");
      document.getElementById(`${uid}-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const saved = editId ? await bmdUpdateReport(editId, form) : await bmdCreateReport(form);
      void refresh(); // report count in the officer box
      router.push(`/bmd/#report-${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setMessage((err as Error).message);
      setBusy(false);
    }
  }

  if (loading || !officer) {
    return (
      <div className="shell max-w-3xl py-10">
        <div className="fw-skeleton h-96" />
      </div>
    );
  }

  const id = (k: string) => `${uid}-${k}`;
  const inp = (k: string) => `${inputClass} ${borderFor(errors, k)}`;

  return (
    <div className="shell max-w-3xl py-8 lg:py-12">
      <Link href="/bmd/" className="text-[13px] font-bold text-accent hover:underline">
        ← {t("bmd.title")}
      </Link>

      <div className="panel mt-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BmdMark className="size-11 shrink-0" />
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-text">
                {editId ? t("bmd.r.edit") : t("bmd.submit")}
              </h1>
              <p className="mt-0.5 text-[13.5px] font-semibold text-accent">
                {t("bmd.f.reportingFor", { district: districtName(officer.station, lang) })}
              </p>
            </div>
          </div>
          <div className="text-right text-[12px] text-text-dim">
            <p className="font-bold text-text">{officer.name}</p>
            <p>{officer.designation}</p>
            <div className="mt-1">
              <VerifiedMark verified={officer.verified} />
            </div>
          </div>
        </div>

        {officer.status === "pending" && (
          <p className="mt-4 rounded-lg bg-amber-400/10 px-3 py-2 text-[12.5px] text-amber-200">{t("bmd.pending.hint")}</p>
        )}

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
          <FormSection title={t("bmd.f.situation")}>
            <div role="radiogroup" aria-labelledby={id("level-label")} aria-describedby={errors.level ? id("level-error") : undefined}>
              <p id={id("level-label")} className="mb-1.5 text-[12.5px] font-semibold text-text-dim">
                {t("bmd.level")} <span className="text-red-300">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {BMD_LEVELS.map((l, i) => {
                  const on = form.level === l;
                  return (
                    <button
                      key={l}
                      id={i === 0 ? id("level") : undefined}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setForm((f) => ({ ...f, level: l }))}
                      className={`tap flex items-center justify-center gap-2 rounded-xl border px-2 text-[13px] font-bold transition
                                  ${on ? `${LEVEL_STYLE[l].chip} ring-2 ring-current` : "border-ink-600 bg-ink-900/50 text-text-dim hover:border-ink-400"}`}
                    >
                      <span aria-hidden className={`size-2 rounded-full ${LEVEL_STYLE[l].bar}`} />
                      {t(`bmd.level.${l}`)}
                    </button>
                  );
                })}
              </div>
              {errors.level && <p id={id("level-error")} className="mt-1 text-[11.5px] font-semibold text-red-300">{errors.level}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("trend")} label={t("bmd.trend")} error={errors.water_trend}>
                <select id={id("trend")} value={form.water_trend} onChange={set("water_trend")} className={inp("water_trend")}>
                  {BMD_TRENDS.map((tr) => (
                    <option key={tr} value={tr}>{t(`bmd.trend.${tr}`)}</option>
                  ))}
                </select>
              </Field>
              <Field id={id("observed_at")} label={t("bmd.f.observedAt")} error={errors.observed_at}>
                <input
                  id={id("observed_at")}
                  type="datetime-local"
                  value={form.observed_at}
                  max={localInputValue()}
                  onChange={set("observed_at")}
                  className={inp("observed_at")}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title={t("bmd.f.narrative")}>
            <Field id={id("conditions")} label={t("bmd.f.conditions")} hint={t("bmd.f.conditions.hint")} error={errors.conditions} required>
              <textarea id={id("conditions")} rows={4} maxLength={4000} value={form.conditions} onChange={set("conditions")} className={`${inp("conditions")} resize-y`} />
            </Field>
            <Field id={id("actions_taken")} label={t("bmd.f.actions")} hint={t("bmd.f.actions.hint")} error={errors.actions_taken} required>
              <textarea id={id("actions_taken")} rows={4} maxLength={4000} value={form.actions_taken} onChange={set("actions_taken")} className={`${inp("actions_taken")} resize-y`} />
            </Field>
            <Field id={id("needs")} label={t("bmd.f.needs")} error={errors.needs}>
              <textarea id={id("needs")} rows={2} maxLength={4000} value={form.needs} onChange={set("needs")} className={`${inp("needs")} resize-y`} />
            </Field>
          </FormSection>

          <FormSection title={t("bmd.f.measurements")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("rain")} label={t("bmd.f.rainfall")} error={errors.rainfall_24h_mm}>
                <input id={id("rain")} type="number" inputMode="decimal" min={0} step="0.1" value={form.rainfall_24h_mm} onChange={set("rainfall_24h_mm")} className={inp("rainfall_24h_mm")} />
              </Field>
              <Field id={id("station")} label={t("bmd.f.station")} error={errors.river_station}>
                <input id={id("station")} placeholder="e.g. Surma @ Sylhet" maxLength={120} value={form.river_station} onChange={set("river_station")} className={inp("river_station")} />
              </Field>
              <Field id={id("wl")} label={t("bmd.f.waterLevel")} error={errors.water_level_m}>
                <input id={id("wl")} type="number" inputMode="decimal" step="0.01" value={form.water_level_m} onChange={set("water_level_m")} className={inp("water_level_m")} />
              </Field>
              <Field id={id("dl")} label={t("bmd.f.dangerLevel")} error={errors.danger_level_m}>
                <input id={id("dl")} type="number" inputMode="decimal" step="0.01" value={form.danger_level_m} onChange={set("danger_level_m")} className={inp("danger_level_m")} />
              </Field>
            </div>
          </FormSection>

          <FormSection title={t("bmd.f.impact")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("affected")} label={t("bmd.f.affected")} error={errors.affected_people}>
                <input id={id("affected")} type="number" inputMode="numeric" min={0} step={1} value={form.affected_people} onChange={set("affected_people")} className={inp("affected_people")} />
              </Field>
              <Field id={id("shelters")} label={t("bmd.f.shelters")} error={errors.shelters_open}>
                <input id={id("shelters")} type="number" inputMode="numeric" min={0} step={1} value={form.shelters_open} onChange={set("shelters_open")} className={inp("shelters_open")} />
              </Field>
            </div>
          </FormSection>

          {message && <ErrorNote message={message} />}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/bmd/"
              className="tap inline-flex items-center justify-center rounded-xl border border-ink-500 px-5 text-[14px] font-bold text-text-dim hover:text-text"
            >
              {t("common.close")}
            </Link>
            <PrimaryButton type="submit" busy={busy}>
              {busy ? t("bmd.f.sending") : editId ? t("bmd.f.update") : t("bmd.f.send")}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
