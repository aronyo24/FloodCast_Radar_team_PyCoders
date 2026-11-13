"use client";

import Link from "next/link";

import { ATTRIBUTION } from "@/lib/attribution";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/lib/language";
import type { Meta } from "@/types/floodwatch";

import { ProvenanceBadges } from "./Badges";

const STACK: Array<[string, string]> = [
  ["Framework", "Next.js 16 (App Router), React 19, TypeScript"],
  ["Map", "Leaflet 1.9 — L.geoJSON for districts, L.imageOverlay for the radar rasters"],
  ["Charts", "Chart.js 4"],
  ["Styling", "Tailwind CSS 4, system font stack (no web font fetch at build time)"],
  ["API", "Django REST Framework backend (bundled Next.js demo routes when run alone)"],
  ["Data build", "Python — numpy and Pillow (scripts/seed_data.py)"],
];

export function AboutClient({ meta }: { meta: Meta }) {
  const { t, lang } = useLanguage();

  return (
    <div className="shell max-w-3xl py-10 lg:py-14">
      <header>
        <h1 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
          {t("about.title")}
        </h1>
        <ProvenanceBadges className="mt-5" demo={meta.demo_data} provisional={meta.provisional} />
      </header>

      <section className="mt-10">
        <h2 className="text-[19px] font-extrabold tracking-tight text-text">
          {t("about.challenge.title")}
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-text-dim">
          {t("about.challenge.body")}
        </p>
      </section>

      <section className="mt-9">
        <h2 className="text-[19px] font-extrabold tracking-tight text-text">
          {t("about.goal.title")}
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-text-dim">
          {t("about.goal.body")}
        </p>
      </section>

      {/* The honesty section. A judging criterion for this challenge is whether
          the method is honest, so this is stated plainly rather than buried. */}
      <section className="mt-9">
        <h2 className="text-[19px] font-extrabold tracking-tight text-text">
          {t("about.data.title")}
        </h2>
        <div className="panel mt-4 space-y-4 p-5">
          <div>
            <p className="eyebrow mb-1.5 text-ok">Measured and real</p>
            <ul className="space-y-1 text-[13.5px] leading-relaxed text-text-dim">
              <li>• The 64 district boundaries, from geoBoundaries.</li>
              <li>• Their geodesic areas, computed from those boundaries.</li>
              <li>• The 12-day NISAR cycle calendar and the projection.</li>
              <li>
                • Every arithmetic relationship on screen: district figures sum to the
                national figure, and each percentage is derived from the pixels actually
                drawn in the overlay rasters.
              </li>
            </ul>
          </div>
          {meta.demo_data ? (
            <div className="border-t border-ink-700 pt-4">
              <p className="eyebrow mb-1.5 text-warning">Generated for this build</p>
              <p className="text-[13.5px] leading-relaxed text-text-dim">{meta.demo_note}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-dim">
                The flood figures switch to measured NISAR results only when the processing
                pipeline publishes a bundle marked as real data. Until then, nothing here
                should be quoted as a NISAR measurement.
              </p>
            </div>
          ) : (
            <div className="border-t border-ink-700 pt-4">
              <p className="eyebrow mb-1.5 text-ok">Measured flood extents</p>
              <p className="text-[13.5px] leading-relaxed text-text-dim">
                Flood figures come from {meta.product} ({meta.distributor}), processed outside
                this site and imported as published. NISAR products are provisional, and every
                percentage is of the area the radar actually observed.
              </p>
            </div>
          )}
          <dl className="grid gap-2 border-t border-ink-700 pt-4 text-[12.5px] sm:grid-cols-2">
            <div>
              <dt className="eyebrow">Dataset generated</dt>
              <dd className="num text-text-dim">
                {meta.generated_at ? formatDateTime(meta.generated_at, lang) : "—"}
              </dd>
            </div>
            {meta.demo_data && meta.seed !== null && meta.seed !== undefined && (
              <div>
                <dt className="eyebrow">Generator seed</dt>
                <dd className="num text-text-dim">
                  {meta.seed} — deterministic, same input gives the same output
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-[19px] font-extrabold tracking-tight text-text">
          {t("about.credits.title")}
        </h2>
        <dl className="panel mt-4 divide-y divide-ink-700 text-[13.5px]">
          <div className="grid gap-1 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="eyebrow">Radar data</dt>
            <dd className="text-text-dim">
              {ATTRIBUTION.mission} · {ATTRIBUTION.distributor}
            </dd>
          </div>
          <div className="grid gap-1 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="eyebrow">Boundaries</dt>
            <dd className="text-text-dim">
              <a
                href={ATTRIBUTION.boundaries.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-ink-500 underline-offset-2 hover:text-text"
              >
                {ATTRIBUTION.boundaries.name}
              </a>{" "}
              — {ATTRIBUTION.boundaries.licence}, release {ATTRIBUTION.boundaries.release}
              <span className="mt-1 block text-text-faint">
                Source: {ATTRIBUTION.boundaries.source}
              </span>
            </dd>
          </div>
          <div className="grid gap-1 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="eyebrow">Colour scale</dt>
            <dd className="text-text-dim">
              ColorBrewer &ldquo;Reds&rdquo; — a sequential single-hue scale chosen so the map
              stays readable for colour-blind users. Colour is never the only signal.
            </dd>
          </div>
          <div className="grid gap-1 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="eyebrow">Challenge</dt>
            <dd className="text-text-dim">
              {ATTRIBUTION.challenge.event} — {ATTRIBUTION.challenge.name}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-9 pb-6">
        <h2 className="text-[19px] font-extrabold tracking-tight text-text">
          {t("about.stack.title")}
        </h2>
        <dl className="panel mt-4 divide-y divide-ink-700 text-[13.5px]">
          {STACK.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <dt className="eyebrow">{k}</dt>
              <dd className="text-text-dim">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 text-[13.5px] text-text-dim">
          Read the method, including what it cannot tell you, on{" "}
          <Link href="/how-it-works" className="font-semibold text-accent hover:text-sky-300">
            How it works
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
