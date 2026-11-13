import type { Metadata } from "next";
import { Suspense } from "react";

import { RegisterForm } from "@/components/bmd/AuthForms";

export const metadata: Metadata = { title: "Officer registration", robots: { index: false } };

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
