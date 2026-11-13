import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportForm } from "@/components/bmd/ReportForm";

export const metadata: Metadata = { title: "File a field report", robots: { index: false } };

export default function SubmitPage() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}
