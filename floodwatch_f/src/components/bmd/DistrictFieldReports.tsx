"use client";

/** The latest BMD officer reports for one district, on the district page. */

import Link from "next/link";
import { useEffect, useState } from "react";

import { bmdReports } from "@/lib/bmd";
import { useLanguage } from "@/lib/language";
import type { BmdReport } from "@/types/bmd";

import { ReportCard } from "./ReportCard";
import { BmdMark } from "./ui";

export function DistrictFieldReports({ districtId, districtLabel }: { districtId: string; districtLabel: string }) {
  const { t } = useLanguage();
  const [reports, setReports] = useState<BmdReport[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    bmdReports({ district: districtId, limit: 3 })
      .then((r) => alive && setReports(r.reports))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [districtId]);

  if (failed) return null; // the radar page still works without the portal

  return (
    <section aria-labelledby="bmd-reports-title" className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BmdMark className="size-8" />
          <div>
            <h2 id="bmd-reports-title" className="text-[18px] font-extrabold tracking-tight text-text">
              {t("bmd.district.title")}
            </h2>
            <p className="text-[12px] text-text-faint">{t("bmd.org")}</p>
          </div>
        </div>
        <Link href="/bmd/" className="text-[13px] font-bold text-accent hover:underline">
          {t("bmd.district.all")} →
        </Link>
      </div>
      <div className="space-y-3">
        {reports === null && <div className="fw-skeleton h-36" />}
        {reports?.length === 0 && (
          <p className="panel-flat p-5 text-center text-[13px] text-text-dim">
            {t("bmd.district.empty", { district: districtLabel })}
          </p>
        )}
        {reports?.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            showDistrict={false}
            onDeleted={(id) => setReports((rs) => rs?.filter((x) => x.id !== id) ?? null)}
          />
        ))}
      </div>
    </section>
  );
}
