import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/bmd/AuthForms";

export const metadata: Metadata = { title: "Officer sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
