"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

import { ApiError } from "@/lib/api";
import { bmdLogin, bmdRegister } from "@/lib/bmd";
import { districtName } from "@/lib/format";
import { divisionName } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import { useOfficer } from "@/lib/officer";
import type { BmdRegisterInput } from "@/types/bmd";

import { BmdMark, borderFor, ErrorNote, Field, FormSection, inputClass, PrimaryButton, useDistricts } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Only follow same-site paths after sign-in, never an arbitrary URL. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/bmd/";
}

function AuthShell({ title, sub, children, wide }: { title: string; sub: string; children: ReactNode; wide?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className={`shell py-10 lg:py-14 ${wide ? "max-w-3xl" : "max-w-md"}`}>
      <div className="mb-6 flex items-center gap-3">
        <BmdMark className="size-12 shrink-0" />
        <div>
          <p className="eyebrow">{t("bmd.org")}</p>
          <p className="text-[13px] font-semibold text-text-dim">{t("bmd.title")}</p>
        </div>
      </div>
      <div className="panel p-5 sm:p-7">
        <h1 className="text-[22px] font-extrabold tracking-tight text-text">{title}</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-dim">{sub}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/** Already signed in: skip the form. */
function useRedirectIfSignedIn(next: string) {
  const { officer, loading } = useOfficer();
  const router = useRouter();
  useEffect(() => {
    if (!loading && officer) router.replace(next);
  }, [loading, officer, next, router]);
}

export function LoginForm() {
  const { t } = useLanguage();
  const uid = useId();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { setSession } = useOfficer();
  useRedirectIfSignedIn(next);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim()) || !password) {
      setError(t("bmd.a.signinSub"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      setSession(await bmdLogin(email.trim(), password));
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Too many attempts. Please wait and try again." : (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("bmd.a.signinTitle")} sub={t("bmd.a.signinSub")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id={`${uid}-email`} label={t("bmd.a.email")}>
          <input
            id={`${uid}-email`}
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@bmd.gov.bd"
            className={`${inputClass} border-ink-600`}
            autoFocus
          />
        </Field>
        <Field id={`${uid}-pw`} label={t("bmd.a.password")}>
          <input
            id={`${uid}-pw`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} border-ink-600`}
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <PrimaryButton type="submit" busy={busy} className="w-full">
          {busy ? t("bmd.a.working") : t("bmd.signin")}
        </PrimaryButton>
      </form>
      <p className="mt-5 text-center text-[13px] text-text-dim">
        {t("bmd.a.noAccount")}{" "}
        <Link href="/bmd/register/" className="font-bold text-accent hover:underline">
          {t("bmd.register")}
        </Link>
      </p>
    </AuthShell>
  );
}

const EMPTY: BmdRegisterInput & { confirm: string } = {
  full_name: "",
  email: "",
  password: "",
  confirm: "",
  designation: "",
  employee_id: "",
  phone: "",
  office_name: "",
  district: "",
};

const DESIGNATIONS = [
  "Director",
  "Deputy Director",
  "Meteorologist",
  "Assistant Meteorologist",
  "Senior Observer",
  "Observer",
  "Forecasting Officer",
];

export function RegisterForm() {
  const { t, lang } = useLanguage();
  const uid = useId();
  const router = useRouter();
  const { setSession } = useOfficer();
  const districts = useDistricts();
  useRedirectIfSignedIn("/bmd/");

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Group the district list by division so 64 options stay scannable.
  const byDivision = new Map<string, typeof districts>();
  for (const d of districts) byDivision.set(d.division, [...(byDivision.get(d.division) ?? []), d]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.full_name.trim().length < 3) next.full_name = t("bmd.a.required");
    if (!EMAIL_RE.test(form.email.trim())) next.email = t("sub.invalid.email");
    if (form.designation.trim().length < 2) next.designation = t("bmd.a.required");
    if (form.employee_id.trim().length < 3) next.employee_id = t("bmd.a.required");
    if (form.phone.replace(/\D/g, "").length < 10) next.phone = t("bmd.a.required");
    if (form.office_name.trim().length < 3) next.office_name = t("bmd.a.required");
    if (!form.district) next.district = t("sub.invalid.district");
    if (form.password.length < 8) next.password = t("bmd.a.password.hint");
    else if (form.password !== form.confirm) next.confirm = t("bmd.a.mismatch");
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage("");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const { confirm: _confirm, ...body } = form;
      void _confirm;
      setSession(await bmdRegister({ ...body, email: body.email.trim() }));
      router.replace("/bmd/");
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setMessage(err instanceof ApiError && err.status === 429 ? "Too many attempts. Please wait and try again." : (err as Error).message);
      setBusy(false);
    }
  }

  const id = (k: string) => `${uid}-${k}`;
  const inp = (k: string) => `${inputClass} ${borderFor(errors, k)}`;

  return (
    <AuthShell title={t("bmd.a.registerTitle")} sub={t("bmd.a.registerSub")} wide>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <FormSection title={t("bmd.a.identity")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("name")} label={t("bmd.a.fullName")} error={errors.full_name} required>
              <input id={id("name")} autoComplete="name" value={form.full_name} onChange={set("full_name")} maxLength={120} className={inp("full_name")} />
            </Field>
            <Field id={id("designation")} label={t("bmd.a.designation")} error={errors.designation} required>
              <input
                id={id("designation")}
                list={id("designations")}
                autoComplete="organization-title"
                value={form.designation}
                onChange={set("designation")}
                maxLength={120}
                className={inp("designation")}
              />
              <datalist id={id("designations")}>
                {DESIGNATIONS.map((d) => <option key={d} value={d} />)}
              </datalist>
            </Field>
            <Field id={id("emp")} label={t("bmd.a.employeeId")} error={errors.employee_id} required>
              <input id={id("emp")} value={form.employee_id} onChange={set("employee_id")} maxLength={40} className={inp("employee_id")} />
            </Field>
            <Field id={id("phone")} label={t("bmd.a.phone")} error={errors.phone} required>
              <input id={id("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={set("phone")} maxLength={20} className={inp("phone")} />
            </Field>
          </div>
        </FormSection>

        <FormSection title={t("bmd.a.posting")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("district")} label={t("bmd.a.district")} error={errors.district} required>
              <select id={id("district")} value={form.district} onChange={set("district")} className={inp("district")}>
                <option value="">{t("sub.district.pick")}</option>
                {[...byDivision.entries()]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([division, rows]) => (
                    <optgroup key={division} label={divisionName(division, lang)}>
                      {rows.map((r) => (
                        <option key={r.id} value={r.id}>{districtName(r, lang)}</option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </Field>
            <Field id={id("office")} label={t("bmd.a.office")} error={errors.office_name} required>
              <input id={id("office")} placeholder="e.g. Sylhet Meteorological Observatory" value={form.office_name} onChange={set("office_name")} maxLength={160} className={inp("office_name")} />
            </Field>
          </div>
        </FormSection>

        <FormSection title={t("bmd.a.account")}>
          <Field id={id("email")} label={t("bmd.a.email")} error={errors.email} required>
            <input id={id("email")} type="email" inputMode="email" autoComplete="email" placeholder="name@bmd.gov.bd" value={form.email} onChange={set("email")} className={inp("email")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("pw")} label={t("bmd.a.password")} hint={t("bmd.a.password.hint")} error={errors.password} required>
              <input id={id("pw")} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} className={inp("password")} />
            </Field>
            <Field id={id("confirm")} label={t("bmd.a.confirm")} error={errors.confirm} required>
              <input id={id("confirm")} type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className={inp("confirm")} />
            </Field>
          </div>
        </FormSection>

        {message && <ErrorNote message={message} />}
        <PrimaryButton type="submit" busy={busy} className="w-full">
          {busy ? t("bmd.a.working") : t("bmd.register")}
        </PrimaryButton>
      </form>
      <p className="mt-5 text-center text-[13px] text-text-dim">
        {t("bmd.a.haveAccount")}{" "}
        <Link href="/bmd/login/" className="font-bold text-accent hover:underline">
          {t("bmd.signin")}
        </Link>
      </p>
    </AuthShell>
  );
}
