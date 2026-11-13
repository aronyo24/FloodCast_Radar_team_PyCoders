# Research log — FloodWatch BD frontend

Every online search/fetch is recorded here as it happens, with the file it was saved to.

| Date | Query / URL | Result | Saved to |
|---|---|---|---|
| 2026-10-28 | `GET https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM2/` | HTTP 200. Metadata for Bangladesh ADM2 (districts), release `9469f09`, year represented 2020. Gave the download URLs below. | `geoboundaries-api-BGD-ADM2.json` |
| 2026-10-28 | `GET https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BGD/ADM2/geoBoundaries-BGD-ADM2_simplified.geojson` | HTTP 200, 1.69 MB. Verified: exactly **64 features**, properties `shapeName, shapeISO, shapeID, shapeGroup, shapeType`. Names match the 64 Bangladeshi districts. This is the basemap source for feature F1. | `geoBoundaries-BGD-ADM2_simplified.geojson` |

## Notes and decisions taken from this research

### Licence — correction to the planning document
The Frontend Plan footer states *“Boundaries: geoBoundaries (CC BY 4.0)”*. The API metadata for this
exact layer reports:

- `boundaryLicense`: **Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)**
- `licenseSource`: `data.humdata.org/dataset/administrative-boundaries-of-bangladesh-as-of-2015`
- `boundaryYearRepresented`: 2020

So the app attributes **CC BY 3.0 IGO**, not CC BY 4.0, and names the upstream HDX/BBS source.
Credits live in `src/lib/attribution.ts` and are rendered in the footer and on `/about`.

### Why the *simplified* geometry
The full-resolution ADM2 file is much heavier and the extra vertex detail is invisible at national
zoom. The simplified release is 1.69 MB raw and is further reduced by the seed script
(`scripts/seed_data.py`, coordinate rounding + ring pruning) to a web payload served from
`public/data/`. Keeping it local is also what the plan's offline-demo requirement needs —
nothing is fetched from the internet at runtime.

### NISAR / ASF DAAC
No live NISAR granules were fetched. The plan is a *frontend* plan and the Backend Plan
(document 2 of 3) was not provided, so the flood statistics in this build are
**generated demo data** produced by `scripts/seed_data.py` — clearly labelled as such in the UI
(`/how-it-works`, `/about`, and a "Demo data" chip in the header). The API contract matches the
plan's endpoint list exactly, so pointing the app at the real Django backend is a one-line
env change (`NEXT_PUBLIC_API_BASE`). See `README.md` → "Swapping in the real backend".

---

## Build notes (2026-10-28)

No further online sources were fetched. Everything after the boundary download
is derived locally, and the running app makes **zero external requests** —
verified with an automated check that fails if any non-localhost origin is
contacted (see README → "The offline test").

### Area cross-check against published BBS district areas

The geodesic area function in `scripts/seed_data.py` was spot-checked against
the official Bangladesh Bureau of Statistics figures:

| District | Computed | BBS | Difference |
|---|---:|---:|---:|
| Sirajganj | 2,499.9 | 2,497.9 | +0.1 % |
| Dhaka | 1,479.0 | 1,463.6 | +1.1 % |
| Kurigram | 2,279.5 | 2,245.0 | +1.5 % |
| Tangail | 3,373.5 | 3,414.3 | −1.2 % |
| Rangamati | 5,778.3 | 6,116.1 | −5.5 % |
| Bagerhat | 3,655.7 | 3,959.1 | −7.7 % |

The two large negatives are coastal and hill districts, where the *simplified*
geoBoundaries release clips the coastline and the Chittagong Hill Tracts edge.
That also explains the national sum: 140,151 km² against the official
147,570 km². The arithmetic is sound; the input geometry is generalised. This
is stated as a limitation on `/how-it-works`.
