import type { Metadata } from "next";

import { AboutClient } from "@/components/AboutClient";
import { getDataset } from "@/lib/dataset";

export const metadata: Metadata = {
  title: "About",
  description:
    "FloodCast Radar: the challenge, the credits, the licences, and an honest note on which numbers are measured and which are generated.",
};

export default async function AboutPage() {
  const data = await getDataset();
  return <AboutClient meta={data.meta} />;
}
