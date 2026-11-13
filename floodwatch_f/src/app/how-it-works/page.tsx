import type { Metadata } from "next";

import { HowItWorksClient } from "@/components/HowItWorksClient";
import { getDataset } from "@/lib/dataset";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Why radar sees through monsoon cloud, how a NISAR image becomes a flood percentage, and what the method cannot tell you.",
};

export default async function HowItWorksPage() {
  const data = await getDataset();
  return <HowItWorksClient meta={data.meta} />;
}
