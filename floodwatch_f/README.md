# FloodCast Radar

**Where the 2026 monsoon flooded Bangladesh, how much, and when — district by district.**

Built against *FloodCast Radar · Frontend Plan v1.0 (29 September 2026)* for the
NASA Space Apps Challenge 2026 challenge **“Dancing with the SARs”**.

One page where anyone can see which districts are under water, using NASA-ISRO
NISAR L-band radar — which sees through monsoon cloud, the exact weeks when an
optical satellite sees nothing and a flood map matters most.

---

## 1. Run it

You need **Node.js 20 or newer** (built and tested on Node 24). Everything else
is already in the repository, including the generated data.

```bash
cd floodcast-radar
npm install
npm run dev
```

Then open:

### → **http://localhost:3000**

That is the whole setup for the standalone demo: no database, no API key, and no
network access needed after `npm install`. To run against the Django backend,
see [Using the Django backend](#using-the-django-backend).

### The five pages

| Page | URL | What it is |
|---|---|---|
| Home | <http://localhost:3000/> | One sentence, the national headline number, a big button through to the map |
| **Flood Explorer** | <http://localhost:3000/explorer/> | **The main screen.** Map, date slider, cards, ranking, charts |
| District | <http://localhost:3000/district/sirajganj/> | One district in depth — any of the 64 works |
| How it works | <http://localhost:3000/how-it-works/> | Radar basics, the method in five steps, and the limitations |
| About | <http://localhost:3000/about/> | Challenge, credits, licences, and which numbers are real |

A production build runs the same way:

```bash
npm run build
npm start          # also http://localhost:3000
```

---

## 2. Test it — a five-minute walkthrough

Open **<http://localhost:3000/explorer/>** and work down this list. Each step
names the feature ID from the Frontend Plan.

**The map and the season**

1. **F1 — District map.** 64 districts, coloured by the share flooded. Hover any
   district: the tooltip gives its name, percentage *and* radar coverage.
2. **F2 — Date slider.** Drag the slider under the map. Every colour, card,
   ranking row and chart point moves with it. The grey bars behind the slider
   are the national flood curve, so the shape of the season is visible before
   you touch anything.
3. **F9 — Play.** Press **Play season**. The flood spreads up the Jamuna through
   July, holds through August, drains in September, then a late surge hits the
   coast in October. Press again to replay.
4. **F8 — Flood overlay.** Toggle **Show flood overlay** (top-right of the map)
   off and on. Red is new water; blue is river, beel and estuary that is there
   all year. Zoom in and the raster deliberately shows its own pixels — it is a
   ~500 m sensor product, and smoothing it would imply detail that does not
   exist.

**The numbers**

5. **F3 — Key cards.** Total flooded km², worst district, districts observed,
   latest image date. Click the **ⓘ** on any card for what the number means.
6. **F4 — National timeline.** The chart at the bottom. **Click any point** —
   it drives the slider.
7. **F5 — District panel.** Click a district on the map, or a row in the
   ranking. Its numbers and a sparkline of its whole season appear bottom-right.
8. **F7 — Top 10.** The ranking beside the map. Click a row to zoom the map to
   that district.

**The honesty features — these are the ones judges look for**

9. **F6 — Freshness.** “Latest image”, “Last checked”, and the amber
   **Provisional NISAR data** chip are on the Explorer and on every district
   page.
10. **F12 — Partly observed.** Drag the slider to the **first cycle, 5 Jun**.
    Nine districts go flat grey (*no radar frame at all*) and eleven go
    **hatched** (*seen, but less than half of them — Khulna only 4.8 %*). A low
    number from a half-seen district must never read as good news.
11. **F10 — Alerts.** The banner follows the selected cycle. At **23 Jul** it is
    red (*severe*); at **15 Oct** it is amber for the coastal districts; on a
    quiet cycle it turns green and says so, rather than disappearing.

**Everything else**

12. **F11 — Before / after.** Open
    <http://localhost:3000/district/sirajganj/> and drag the handle in the
    *Before and after* panel. Left is 5 June, right is that district’s own peak.
    Arrow keys work too.
13. **F13 — Bangla.** Hit **বাং** in the header. Every label, district name,
    unit *and numeral* switches — ৪,৯৪৪ বর্গকিমি. The choice is remembered.
14. **F14 — Search.** Type in the header search box. Try `bogra`, `bogura` or
    `বগুড়া` — all three find the same district.
15. **F15 — Shareable link.** Move the slider, pick a district, then copy the
    URL. Or use **Copy link to this view**. Paste it in a new tab and the same
    view comes back:
    <http://localhost:3000/explorer/?cycle=2026-07-23&district=sherpur>
16. **F16 — CSV.** **Download CSV** gives one row per district for the selected
    cycle, with coverage and area columns so the figures can be checked.
17. **F17 — Check for new images.** Re-reads the dataset from disk and reports
    exactly what it found. Re-run `npm run seed` with a later `SEASON_END` and
    this button will pick the new cycles up without a restart.

### The offline test

The Frontend Plan requires the demo to run with the wifi off. After
`npm install`, **turn off your network and reload the page** — everything still
works. Nothing is fetched from the internet: no map tiles, no web fonts, no CDN.
The one exception is opt-in and labelled as such: the **Street basemap** toggle,
which is off by default and says it needs the internet.

### Automated checks

```bash
npm run check     # TypeScript, then ESLint. Both are clean.
npm run build     # production build; prerenders all 64 district pages
```

---

## 3. What is real and what is generated

This matters, so it is stated plainly here, in the UI, and on `/about`.

**Real and verifiable**

- The **64 district boundaries**, from geoBoundaries (see Credits).
- Their **geodesic areas**, computed from those boundaries by spherical excess.
  Spot-checked against the official BBS figures: Sirajganj +0.1 %, Dhaka +1.1 %,
  Tangail −1.2 %.
- The **12-day NISAR cycle calendar** and the Web Mercator projection, which is
  why the rasters line up with the vector boundaries exactly.
- **Every arithmetic relationship on screen.** District figures sum to the
  national figure; each percentage is derived from the pixels actually drawn in
  the overlay PNGs; `flooded_km2 ÷ district area` really does equal the
  percentage shown.

**Generated for this build**

- The **flood extents themselves.** The Backend Plan (document 2 of 3), which
  defines the real ASF DAAC ingest, was not available, so `scripts/seed_data.py`
  synthesises a physically-plausible 2026 monsoon over the real river network:
  haor flash floods in late June, the Brahmaputra–Ganges peak in late July, a
  September crest, and an October cyclone surge on the coast.

Nothing here should be quoted as a NISAR measurement. The **Demo data** chip
says so on every page, and the generator is deterministic — same seed, same
bytes.

### Using the Django backend

The Django service in `../floodwatch_b` implements the endpoint list below, with the
same response shapes. Point the app at it:

```bash
# .env.local
FLOODWATCH_API_URL=http://127.0.0.1:8000
```

With that one variable:

- **Server-rendered pages** (Home, Explorer, District, About, How it works) read
  from Django instead of `public/data/`. They are rendered per request (district
  pages regenerate at most once a minute), so the build does not need the backend
  to be running.
- **`/api/`, `/media/` and `/admin/` are proxied** to Django, so the browser only
  talks to this origin: no CORS, and overlay PNGs load from Django's media.
- **The “Demo data” chip and About-page note follow the backend's `meta.demo_data`.**
  They disappear only when a bundle marked as real NISAR output is imported.
- **“Check for new images” needs a staff login.** Sign in at `/admin/` first;
  otherwise the button tells you to.

`NEXT_PUBLIC_API_BASE` (the browser calls Django directly) still works for hosts
that can't proxy; it needs CORS configured on the backend. See `.env.example`.

| Endpoint | Feature |
|---|---|
| `GET /api/districts/` | F1 — boundaries (GeoJSON; `?format=list` for the search box) |
| `GET /api/cycles/` | F2 — the slider's cycle index |
| `GET /api/cycles/<date>/` | F1, F2 — per-district numbers (`?format=csv` for F16) |
| `GET /api/national/` | F3, F4 — national timeline |
| `GET /api/districts/<id>/timeline/` | F5 — one district across the season |
| `GET /api/meta/` | F6 — freshness and the provisional flag |
| `GET /api/alerts/` | F10 — alert banner (`?cycle=` to follow the slider) |
| `GET /api/overlays/?cycle=` | F8, F11 — raster URLs and bounds |
| `POST /api/update/` | F17 — trigger an ingest check |

---

## 4. Regenerating the data

The generated data is committed, so this is only needed to change the season.
It needs **Python 3.9+** with `numpy` and `Pillow`:

```bash
npm run seed      # python scripts/seed_data.py
```

It reads `reference/geoBoundaries-BGD-ADM2_simplified.geojson` and writes
`public/data/`: the district GeoJSON, `dataset.json`, and one flood PNG per
cycle. Takes about a minute. Tuning knobs — season dates, alert thresholds,
raster resolution, flood shape — are the constants at the top of
`scripts/seed_data.py`; per-district behaviour is in `scripts/districts_meta.py`.

---

## 5. How it is put together

```
floodcast-radar/
├─ reference/                 geoBoundaries source + _research-log.md
├─ scripts/
│  ├─ seed_data.py            builds public/data from the boundary file
│  └─ districts_meta.py       64 districts: official EN + BN names, flood regime
├─ public/data/               generated: boundaries, statistics, overlay rasters
└─ src/
   ├─ app/
   │  ├─ page.tsx             Home
   │  ├─ explorer/            Flood Explorer — F1–F12, F15–F17
   │  ├─ district/[name]/     District page — F5, F11
   │  ├─ how-it-works/        method and limitations
   │  ├─ about/               credits, licences, data honesty
   │  └─ api/                 the endpoint list above
   ├─ components/
   │  ├─ map/FloodMap*.tsx    Leaflet: L.geoJSON districts + L.imageOverlay
   │  ├─ CycleSlider.tsx      F2, F9
   │  ├─ BeforeAfter.tsx      F11 — SVG swipe, no second map instance
   │  └─ …                    cards, alerts, ranking, legend, charts
   └─ lib/
      ├─ api.ts               one place for every fetch()
      ├─ colors.ts            the flood scale and legend (plan §5)
      ├─ i18n.ts              English / Bangla strings
      ├─ projection.ts        Web Mercator, shared with the seed script
      └─ dataset.ts           server-side data access
```

**Choices worth knowing about**

- **Next.js instead of Django templates.** The plan specifies Django templates;
  this build is Next.js, as requested. Everything else in the plan is followed —
  Leaflet 1.9, Chart.js 4, the same five pages, the same feature IDs, the same
  endpoint list.
- **No tile layer by default.** The land is drawn from the local boundary file
  onto a plain canvas, which is what makes the offline demo work.
- **No web fonts.** `next/font` downloads from Google at *build* time; a system
  font stack means even a rebuild works with the wifi off.
- **A system of one colour.** ColorBrewer “Reds”, a sequential single-hue scale
  that stays readable for colour-blind users, as the plan asks. Colour is never
  the only signal: every tooltip prints the number, the ranking repeats it as a
  bar length, and partly-observed districts get a hatch *and* a dashed outline.
- **Percentages are of the observed area**, never of the whole district, and the
  coverage figure sits next to every one of them.

### Accessibility

Checked, not assumed — all twelve of these pass:

- Works at 360 px with no horizontal scrolling; touch targets ≥ 44 px.
- Keyboard reaches the slider, the play button and the district search; arrow
  keys step the slider and the before/after handle.
- The 64 map shapes are kept *out* of the tab order — otherwise reaching the
  slider took seventy Tab presses. The ranking list and the search box are the
  labelled keyboard route to a district.
- `prefers-reduced-motion` turns off the animations.
- The Bangla toggle sets `<html lang="bn">` so screen readers switch voice.

---

## 6. Credits and licences

- **Radar data** — NASA-ISRO NISAR (L-band SAR, 12-day repeat), distributed by
  the Alaska Satellite Facility DAAC. Products are **provisional**.
- **Boundaries** — [geoBoundaries](https://www.geoboundaries.org/) gbOpen
  BGD ADM2, release `9469f09`, representing 2020. Licensed **CC BY 3.0 IGO**,
  sourced from HDX / Bangladesh Bureau of Statistics.
  *Note:* the Frontend Plan's footer says CC BY 4.0; the API metadata for this
  exact layer reports CC BY 3.0 IGO, so the stricter, verified wording is what
  ships. See `reference/_research-log.md`.
- **Colour scale** — ColorBrewer “Reds” (Cynthia Brewer, Penn State).
- **Challenge** — NASA Space Apps Challenge 2026, “Dancing with the SARs”.

> **Hackathon rule.** The Frontend Plan notes that the final project must be
> built during the event (14–15 November). Treat this as the practice build the
> plan asks for, and confirm with your Local Lead what may be prepared in
> advance.
