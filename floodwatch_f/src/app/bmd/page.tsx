import type { Metadata } from "next";

import { BmdDashboard } from "@/components/bmd/BmdDashboard";

export const metadata: Metadata = {
  title: "BMD Field Situation Dashboard",
  description:
    "Ground reports from Bangladesh Meteorological Department officers in every district: current flood conditions and the steps taken.",
};

export default function BmdPage() {
  return <BmdDashboard />;
}
