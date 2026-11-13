/**
 * Credits, in one place.
 *
 * geoBoundaries is published under a Creative Commons Attribution licence, so
 * naming it is a licence condition rather than a courtesy. Note that the
 * Frontend Plan's footer says CC BY 4.0; the API metadata for this exact layer
 * (BGD ADM2, gbOpen, release 9469f09) reports CC BY 3.0 IGO, sourced from HDX.
 * The stricter, verified wording is what ships - see reference/_research-log.md.
 */

export const ATTRIBUTION = {
  mission: "NASA-ISRO NISAR (L-band SAR, 12-day repeat)",
  distributor: "Alaska Satellite Facility DAAC",
  provisionalNote: "provisional products",
  boundaries: {
    name: "geoBoundaries gbOpen BGD ADM2",
    licence: "CC BY 3.0 IGO",
    release: "9469f09",
    year: 2020,
    source: "data.humdata.org — Administrative boundaries of Bangladesh",
    url: "https://www.geoboundaries.org/",
  },
  challenge: {
    event: "NASA Space Apps Challenge 2026",
    name: "Dancing with the SARs",
  },
} as const;
