"use client";

/**
 * Why flooding looks dark on radar.
 *
 * A diagram earns its place here because the mechanism is geometric: a smooth
 * water surface reflects the pulse *away* from the satellite, so the sensor
 * receives nothing and the pixel comes back dark, while rough land scatters
 * part of the pulse back. Drawn inline so it needs no network and scales
 * cleanly on a projector.
 */

import { useLanguage } from "@/lib/language";

export function RadarDiagram() {
  const { lang } = useLanguage();
  const bn = lang === "bn";

  const label = {
    satellite: bn ? "নিসার" : "NISAR",
    cloud: bn ? "মেঘ — রাডারের কাছে স্বচ্ছ" : "Cloud — transparent to radar",
    pulse: bn ? "পাঠানো সংকেত" : "Pulse out",
    water: bn ? "মসৃণ পানি" : "Smooth water",
    waterResult: bn ? "সংকেত ফেরে না → অন্ধকার" : "Nothing returns → dark",
    land: bn ? "অমসৃণ ভূমি" : "Rough land",
    landResult: bn ? "ছড়িয়ে ফেরে → উজ্জ্বল" : "Scatters back → bright",
  };

  return (
    <figure className="panel overflow-hidden">
      <svg
        viewBox="0 0 680 310"
        className="block w-full"
        role="img"
        aria-label={`${label.satellite}: ${label.waterResult}; ${label.landResult}`}
      >
        <defs>
          <marker id="rd-arrow" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="currentColor" />
          </marker>
          <linearGradient id="rd-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f1a2b" />
            <stop offset="100%" stopColor="#16243a" />
          </linearGradient>
        </defs>

        <rect width="680" height="310" fill="url(#rd-sky)" />

        {/* ground */}
        <path d="M0 238h680v72H0z" fill="#2a3f5c" opacity=".55" />
        <path d="M44 238h252v6H44z" fill="#1f66ba" />
        <rect x="44" y="238" width="252" height="34" fill="#1f66ba" opacity=".35" />
        <path
          d="M352 238c14-7 24 6 38 0s24 6 38 0 24 6 38 0 24 6 38 0 24 6 38 0 24 6 38 0v34H352z"
          fill="#4b5f41"
          opacity=".75"
        />

        {/* satellite */}
        <g transform="translate(300 28)">
          <rect x="-13" y="-9" width="26" height="18" rx="3" fill="#cbd5e1" />
          <rect x="-34" y="-5" width="18" height="10" rx="1.5" fill="#38bdf8" opacity=".8" />
          <rect x="16" y="-5" width="18" height="10" rx="1.5" fill="#38bdf8" opacity=".8" />
          <text x="0" y="-18" textAnchor="middle" fill="#e9eff8" fontSize="13" fontWeight="700">
            {label.satellite}
          </text>
        </g>

        {/* cloud the pulse goes straight through */}
        <g opacity=".5">
          <ellipse cx="170" cy="112" rx="52" ry="22" fill="#93a4bd" />
          <ellipse cx="205" cy="104" rx="36" ry="18" fill="#93a4bd" />
          <ellipse cx="500" cy="120" rx="48" ry="20" fill="#93a4bd" />
          <ellipse cx="462" cy="112" rx="32" ry="16" fill="#93a4bd" />
        </g>
        <text x="170" y="150" textAnchor="middle" fill="#a8bad4" fontSize="11">
          {label.cloud}
        </text>

        {/* --- left: water, specular reflection away from the sensor --- */}
        <g className="text-sky-300" color="#7dd3fc">
          <line x1="288" y1="48" x2="170" y2="234" stroke="currentColor" strokeWidth="2.4"
            markerEnd="url(#rd-arrow)" />
        </g>
        <g color="#7dd3fc" opacity=".55">
          <line x1="170" y1="238" x2="52" y2="150" stroke="currentColor" strokeWidth="2.2"
            strokeDasharray="6 4" markerEnd="url(#rd-arrow)" />
        </g>
        <text x="150" y="288" textAnchor="middle" fill="#e9eff8" fontSize="12.5" fontWeight="700">
          {label.water}
        </text>
        <text x="150" y="304" textAnchor="middle" fill="#7dd3fc" fontSize="11">
          {label.waterResult}
        </text>

        {/* --- right: rough land, part of the pulse scatters back --- */}
        <g color="#fca5a5">
          <line x1="316" y1="48" x2="452" y2="232" stroke="currentColor" strokeWidth="2.4"
            markerEnd="url(#rd-arrow)" />
        </g>
        <g color="#fca5a5" opacity=".9">
          <line x1="452" y1="236" x2="330" y2="60" stroke="currentColor" strokeWidth="2.2"
            markerEnd="url(#rd-arrow)" />
        </g>
        <g color="#fca5a5" opacity=".4">
          <line x1="452" y1="236" x2="560" y2="150" stroke="currentColor" strokeWidth="1.8"
            markerEnd="url(#rd-arrow)" />
          <line x1="452" y1="236" x2="500" y2="110" stroke="currentColor" strokeWidth="1.8"
            markerEnd="url(#rd-arrow)" />
        </g>
        <text x="500" y="288" textAnchor="middle" fill="#e9eff8" fontSize="12.5" fontWeight="700">
          {label.land}
        </text>
        <text x="500" y="304" textAnchor="middle" fill="#fca5a5" fontSize="11">
          {label.landResult}
        </text>

        <text x="326" y="150" fill="#a8bad4" fontSize="11">
          {label.pulse}
        </text>
      </svg>
    </figure>
  );
}
