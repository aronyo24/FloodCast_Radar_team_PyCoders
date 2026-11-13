"""
FloodCast Radar - dataset builder
===============================

Turns the geoBoundaries district file in `reference/` into everything the
frontend serves out of `public/data/`:

  public/data/districts.geojson     64 districts, web-simplified, EN + BN names
  public/data/dataset.json          cycles, per-district statistics, meta, alerts
  public/data/overlays/water.png    permanent water (rivers, beels, estuary)
  public/data/overlays/<date>/flood.png
                                    new water for that 12-day cycle

IMPORTANT - what is real and what is not
----------------------------------------
Real: the district boundaries, their geodesic areas, the 12-day cycle calendar,
      the projection, and every arithmetic relationship between the numbers
      (district km2 sum to the national km2, percentages derive from the pixels
      actually drawn in the PNGs).

Demo: the flood extents themselves. The Backend Plan (document 2 of 3) that
      defines the real NISAR ingest was not available, so this script synthesises
      a physically-plausible monsoon season over the real river network. Every
      figure the UI shows therefore carries a "Demo data" marker, and the API
      contract matches the Backend Plan's endpoint list exactly so the real
      service can be dropped in with one env var (see README).

The generator is fully deterministic: same SEED in, same bytes out.

Usage:  python scripts/seed_data.py
"""

from __future__ import annotations

import json
import math

import re
import sys
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from districts_meta import DISTRICTS, REGIME  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC_GEOJSON = ROOT / "reference" / "geoBoundaries-BGD-ADM2_simplified.geojson"
OUT_DATA = ROOT / "public" / "data"
OUT_OVERLAYS = OUT_DATA / "overlays"

SEED = 20261115  # NASA Space Apps weekend
GRID_WIDTH = 960  # px across Bangladesh; ~520 m/px, honest for a SAR flood mask
SIMPLIFY_DECIMALS = 3  # ~110 m - invisible at national zoom, 4x smaller payload

# 12-day NISAR repeat, anchored so that 2026-07-23 is a real cycle date
# (the date used in the Frontend Plan's worked example).
CYCLE_ANCHOR = date(2026, 7, 23)
SEASON_START = date(2026, 6, 5)
SEASON_END = date(2026, 10, 15)
LAST_CHECKED = datetime(2026, 10, 28, 6, 12, 0, tzinfo=timezone.utc)

ALERT_WARNING_PCT = 15.0
ALERT_SEVERE_PCT = 30.0
LOW_COVERAGE_PCT = 50.0  # below this a district is "partly observed" (F12)

# Flood-shape tuning. PROXIMITY_RADIUS_PX sets how far from a channel the
# floodplain is considered low ground; TERRAIN_WEIGHT is how strongly the
# terrain noise is allowed to override that. Raising TERRAIN_WEIGHT makes the
# flood patchier, lowering it collapses the result back to a buffer round
# every river. Calibrated by eye against Sentinel-1 flood maps of the 2020
# Jamuna flood: broad lobes, dry islands, a few detached depressions.
PROXIMITY_RADIUS_PX = 30.0
TERRAIN_WEIGHT = 0.95

BBOX = (88.00, 20.55, 92.72, 26.70)  # west, south, east, north


# --------------------------------------------------------------------------
# projection - spherical Web Mercator, so an L.imageOverlay lines up exactly
# --------------------------------------------------------------------------
def merc_y(lat: float) -> float:
    lat = max(-85.0, min(85.0, lat))
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def inv_merc_y(y: float) -> float:
    return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)


class Grid:
    """Raster grid, linear in (lon, mercator-y) so Leaflet can stretch it."""

    def __init__(self, bbox, width: int):
        self.west, self.south, self.east, self.north = bbox
        self.width = width
        self.y_top = merc_y(self.north)
        self.y_bottom = merc_y(self.south)
        x_span = math.radians(self.east - self.west)
        y_span = self.y_top - self.y_bottom
        # conformal: equal radians per pixel on both axes keeps shapes true
        self.height = int(round(width * y_span / x_span))
        self.dx = (self.east - self.west) / self.width
        self.dy = y_span / self.height

    def to_px(self, lon: float, lat: float):
        return (
            (lon - self.west) / self.dx,
            (self.y_top - merc_y(lat)) / self.dy,
        )

    def row_areas_km2(self) -> np.ndarray:
        """Ground area of one pixel on each row (km2) - varies with latitude."""
        edges = np.array(
            [inv_merc_y(self.y_top - j * self.dy) for j in range(self.height + 1)]
        )
        lat_mid = (edges[:-1] + edges[1:]) / 2.0
        d_lat = np.abs(edges[:-1] - edges[1:])
        w_km = self.dx * 111.320 * np.cos(np.radians(lat_mid))
        h_km = d_lat * 110.574
        return (w_km * h_km).astype(np.float64)

    def km_to_px_x(self, km: float, lat: float) -> float:
        return km / (self.dx * 111.320 * math.cos(math.radians(lat)))


# --------------------------------------------------------------------------
# geometry helpers
# --------------------------------------------------------------------------
def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def polygons_of(geom: dict):
    """Yield exterior rings as lists of (lon, lat), for Polygon/MultiPolygon."""
    t = geom["type"]
    if t == "Polygon":
        yield geom["coordinates"][0]
    elif t == "MultiPolygon":
        for poly in geom["coordinates"]:
            yield poly[0]


def ring_area_km2(ring) -> float:
    """Geodesic area of a lon/lat ring, spherical excess (km2)."""
    if len(ring) < 4:
        return 0.0
    r = 6371.0088
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(ring, ring[1:]):
        total += math.radians(lon2 - lon1) * (
            2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2))
        )
    return abs(total * r * r / 2.0)


def simplify_ring(ring, decimals: int):
    """Round coordinates and drop the duplicates that rounding creates."""
    out = []
    for lon, lat in ring:
        p = (round(lon, decimals), round(lat, decimals))
        if not out or p != out[-1]:
            out.append(p)
    if len(out) >= 3 and out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def simplify_geometry(geom: dict, decimals: int, min_km2: float):
    """Web-size the geometry: round coords, drop slivers, keep real islands."""
    if geom["type"] == "Polygon":
        polys = [geom["coordinates"]]
    else:
        polys = geom["coordinates"]

    kept = []
    for poly in polys:
        ext = simplify_ring(poly[0], decimals)
        if ext is None or ring_area_km2(ext) < min_km2:
            continue
        rings = [[list(p) for p in ext]]
        for hole in poly[1:]:  # keep only holes big enough to see
            h = simplify_ring(hole, decimals)
            if h is not None and ring_area_km2(h) >= min_km2 * 4:
                rings.append([list(p) for p in h])
        kept.append(rings)

    if not kept:  # never drop a district entirely
        ext = simplify_ring(max(polys, key=lambda p: ring_area_km2(p[0]))[0], decimals + 1)
        kept = [[[list(p) for p in ext]]]

    if len(kept) == 1:
        return {"type": "Polygon", "coordinates": kept[0]}
    return {"type": "MultiPolygon", "coordinates": kept}


# --------------------------------------------------------------------------
# noise
# --------------------------------------------------------------------------
def value_noise(h, w, cells, rng, octaves=5, persistence=0.52, aniso=1.0):
    """Multi-octave value noise, bicubic-upsampled. aniso>1 stretches vertically."""
    total = np.zeros((h, w), dtype=np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        step = 2**o
        cy = max(2, int(cells * step))
        cx = max(2, int(cells * step * aniso))
        g = rng.random((cy, cx)).astype(np.float32)
        up = Image.fromarray(g).resize((w, h), Image.BICUBIC)
        total += amp * np.asarray(up, dtype=np.float32)
        norm += amp
        amp *= persistence
    out = total / norm
    lo, hi = float(out.min()), float(out.max())
    return (out - lo) / max(1e-6, hi - lo)


def _box_blur_1d(a: np.ndarray, radius: int, axis: int) -> np.ndarray:
    """Edge-clamped moving average via a cumulative sum - O(n) per pass."""
    if radius < 1:
        return a
    a = np.moveaxis(a, axis, -1)
    pad = np.pad(a, [(0, 0)] * (a.ndim - 1) + [(radius + 1, radius)], mode="edge")
    c = np.cumsum(pad, axis=-1, dtype=np.float64)
    out = (c[..., 2 * radius + 1:] - c[..., : -(2 * radius + 1)]) / (2 * radius + 1)
    return np.moveaxis(out.astype(np.float32), -1, axis)


def blur(a: np.ndarray, radius: float) -> np.ndarray:
    """Three box passes approximate a Gaussian closely and keep float precision
    (PIL's GaussianBlur refuses 'F' mode images)."""
    r = max(1, int(round(radius / 1.75)))
    out = a.astype(np.float32)
    for _ in range(3):
        out = _box_blur_1d(_box_blur_1d(out, r, 0), r, 1)
    return out


# --------------------------------------------------------------------------
# the real river network, as centrelines (lon, lat) with half-width in km
# --------------------------------------------------------------------------
RIVERS = [
    ("Jamuna (Brahmaputra)", 5.0, [
        (89.66, 26.12), (89.72, 25.72), (89.69, 25.30), (89.74, 24.92),
        (89.78, 24.55), (89.72, 24.20), (89.76, 23.92), (89.80, 23.78)]),
    ("Teesta", 1.4, [
        (88.95, 26.32), (89.14, 26.08), (89.34, 25.90), (89.52, 25.80), (89.68, 25.74)]),
    ("Padma (Ganges)", 4.2, [
        (88.05, 24.62), (88.42, 24.38), (88.86, 24.18), (89.28, 23.96),
        (89.80, 23.78), (90.14, 23.56), (90.46, 23.38), (90.62, 23.22)]),
    ("Surma / Upper Meghna", 2.6, [
        (92.18, 25.02), (91.86, 24.90), (91.40, 24.76), (91.04, 24.56),
        (90.90, 24.26), (90.78, 24.04), (90.72, 23.68), (90.63, 23.24)]),
    ("Old Brahmaputra", 1.1, [
        (89.80, 25.16), (90.08, 24.98), (90.38, 24.78), (90.62, 24.52), (90.78, 24.18)]),
    ("Lower Meghna", 7.5, [
        (90.62, 23.22), (90.66, 22.88), (90.60, 22.52), (90.62, 22.16), (90.68, 21.86)]),
    ("Atrai / Chalan Beel", 0.9, [
        (88.82, 25.34), (89.00, 24.96), (89.14, 24.58), (89.30, 24.34)]),
    ("Gorai / Madhumati", 1.2, [
        (89.12, 23.92), (89.42, 23.56), (89.72, 23.14), (89.88, 22.72), (89.62, 22.22)]),
    ("Pashur / Rupsa", 1.6, [
        (89.56, 22.84), (89.52, 22.44), (89.46, 22.04), (89.42, 21.78)]),
    ("Karnaphuli", 1.0, [
        (92.22, 22.56), (91.98, 22.42), (91.80, 22.32)]),
    ("Kushiyara", 0.9, [
        (92.30, 24.72), (91.92, 24.62), (91.48, 24.52), (91.10, 24.42)]),
    ("Dhaleshwari / Buriganga", 0.9, [
        (89.92, 23.92), (90.18, 23.78), (90.42, 23.70), (90.56, 23.62), (90.66, 23.56)]),
    ("Tetulia", 2.4, [
        (90.36, 22.60), (90.28, 22.26), (90.22, 21.96)]),
]

# standing water bodies: (lon, lat, radius km)
WATER_BODIES = [
    (92.28, 22.60, 11.0),   # Kaptai Lake
    (89.32, 24.34, 9.0),    # Chalan Beel
    (91.12, 25.06, 13.0),   # Tanguar / Sunamganj haor basin
    (92.06, 24.66, 7.0),    # Hakaluki haor
    (90.96, 24.42, 8.0),    # Baikka / Hail haor cluster
]


def _meander(px, rng, amplitude_px: float, per_segment: int = 10):
    """Resample a centreline and push it sideways with smooth noise.

    Straight polylines read as drawn-on; real channels wander. The offset is a
    sum of three sines with random phases, tapered to zero at both ends so the
    confluences the lines were authored to hit still line up.
    """
    phases = rng.random(3) * 2 * math.pi
    freqs = (1.7, 3.9, 7.3)
    weights = (1.0, 0.45, 0.22)

    dense = []
    n = len(px) - 1
    for i in range(n):
        (x0, y0), (x1, y1) = px[i], px[i + 1]
        for k in range(per_segment):
            t = (i + k / per_segment) / n
            dense.append((x0 + (x1 - x0) * k / per_segment,
                          y0 + (y1 - y0) * k / per_segment, t))
    dense.append((px[-1][0], px[-1][1], 1.0))

    out = []
    for i, (x, y, t) in enumerate(dense):
        j = min(i + 1, len(dense) - 1)
        dx, dy = dense[j][0] - x, dense[j][1] - y
        if i == len(dense) - 1:
            dx, dy = x - dense[i - 1][0], y - dense[i - 1][1]
        norm = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / norm, dx / norm  # unit normal
        wiggle = sum(wt * math.sin(fq * 2 * math.pi * t + ph)
                     for wt, fq, ph in zip(weights, freqs, phases))
        taper = math.sin(math.pi * t) ** 0.6  # 0 at both ends
        off = amplitude_px * taper * wiggle / sum(weights)
        out.append((x + nx * off, y + ny * off))
    return out


def _lobed_polygon(cx, cy, rx, ry, rng, lobes=5, roughness=0.34, steps=72):
    """A closed blob whose radius wobbles with angle - beels are not ellipses."""
    phases = rng.random(3) * 2 * math.pi
    pts = []
    for s in range(steps):
        a = 2 * math.pi * s / steps
        wob = (math.sin(lobes * a + phases[0])
               + 0.5 * math.sin((lobes + 3) * a + phases[1])
               + 0.3 * math.sin((lobes + 7) * a + phases[2]))
        scale = 1.0 + roughness * wob / 1.8
        pts.append((cx + rx * scale * math.cos(a), cy + ry * scale * math.sin(a)))
    return pts


def build_permanent_water(grid: Grid, land: np.ndarray, rng) -> np.ndarray:
    """Rivers + beels + a noisy tidal-channel network in the Sundarbans."""
    h, w = grid.height, grid.width
    canvas = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(canvas)

    for _name, half_km, pts in RIVERS:
        lat_mid = sum(p[1] for p in pts) / len(pts)
        px = [grid.to_px(lon, lat) for lon, lat in pts]
        amp = grid.km_to_px_x(max(2.5, half_km * 1.5), lat_mid)
        line = _meander(px, rng, amplitude_px=amp)
        n = len(line) - 1
        for i in range(n):
            frac = (i + 0.5) / n
            # widen downstream: the Meghna mouth is far wider than its head
            width_px = 2 * grid.km_to_px_x(half_km * (0.68 + 0.64 * frac), lat_mid)
            d.line([line[i], line[i + 1]], fill=255, width=max(1, int(round(width_px))))
            r = width_px / 2.0  # round the joints so the channel reads continuous
            x, y = line[i]
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)

    for lon, lat, r_km in WATER_BODIES:
        x, y = grid.to_px(lon, lat)
        rx = grid.km_to_px_x(r_km, lat)
        d.polygon(_lobed_polygon(x, y, rx, rx * 0.82, rng), fill=255)

    water = np.asarray(canvas, dtype=np.float32) / 255.0

    # Braided tributaries and tidal creeks: thin ridged filaments, denser in the
    # south-west where the Sundarbans channel network actually is.
    n = value_noise(h, w, 3, rng, octaves=6, persistence=0.55, aniso=2.3)
    ridged = 1.0 - np.abs(2.0 * n - 1.0)
    lat_rows = np.array([inv_merc_y(grid.y_top - (j + 0.5) * grid.dy) for j in range(h)])
    lon_cols = np.array([grid.west + (i + 0.5) * grid.dx for i in range(w)])
    south = np.clip((22.90 - lat_rows) / 1.5, 0, 1)[:, None]
    sundarban_lon = np.exp(-(((lon_cols - 89.45) / 0.75) ** 2))[None, :]
    # Calibrated so rivers + beels + tributaries land near 10% of the land area,
    # which is the published share of inland water for Bangladesh. The threshold
    # is relaxed over the Sundarbans, which genuinely is a channel maze.
    threshold = 0.991 - 0.016 * south * sundarban_lon
    tributaries = (ridged > threshold).astype(np.float32)

    return np.clip(water + tributaries, 0, 1) * land


# --------------------------------------------------------------------------
# cycles and the seasonal curve
# --------------------------------------------------------------------------
def cycle_dates():
    d, out = CYCLE_ANCHOR, []
    while d > SEASON_START:
        d -= timedelta(days=12)
    if d < SEASON_START:
        d += timedelta(days=12)
    while d <= SEASON_END:
        out.append(d)
        d += timedelta(days=12)
    return out


# The four flood episodes of the demo 2026 season: (centre, width in days).
# Each regime in districts_meta.REGIME weights these differently.
SEASON_EVENTS = {
    "flash":   (date(2026, 6, 22), 9.0),
    "main":    (date(2026, 7, 30), 18.0),
    "late":    (date(2026, 9, 4), 13.0),
    "cyclone": (date(2026, 10, 12), 6.5),
}


def _bell(day: float, centre: float, width: float) -> float:
    return math.exp(-0.5 * ((day - centre) / width) ** 2)


def district_intensity(d: date, cfg: dict, jitter: dict) -> float:
    """0..1 flood intensity for one district on one cycle date.

    Sums the four seasonal episodes with this regime's weights, shifted by the
    regime lag plus a per-district offset so neighbouring districts crest a few
    days apart rather than in lock-step.
    """
    day = (d - date(2026, 1, 1)).days
    total = 0.0
    for name, (centre, width) in SEASON_EVENTS.items():
        weight = cfg["events"][name]
        if weight <= 0:
            continue
        c = (centre - date(2026, 1, 1)).days + cfg["lag"] + jitter["lag"]
        total += weight * _bell(day, c, width * jitter["width"])
    return min(1.0, total)


def observation_footprint(grid: Grid, idx: int, total: int) -> np.ndarray:
    """Which pixels this cycle actually has a usable NISAR frame for.

    Most cycles are complete. A few have a missing descending pass or an
    unprocessed frame - that is what drives the grey / hatched districts the
    Frontend Plan asks for (F12), instead of pretending coverage is perfect.
    """
    h, w = grid.height, grid.width
    lat_rows = np.array([inv_merc_y(grid.y_top - (j + 0.5) * grid.dy) for j in range(h)])
    lon_cols = np.array([grid.west + (i + 0.5) * grid.dx for i in range(w)])
    # slanted track coordinate, mimicking a near-polar descending orbit
    track = lon_cols[None, :] + 0.34 * (lat_rows[:, None] - 23.7)

    gaps = {
        0: [(88.00, 89.35), (91.55, 92.75)],  # season start, partial ingest
        1: [(90.45, 91.30)],
        5: [(88.55, 89.15)],
        8: [(91.05, 91.80)],
        total - 1: [(88.00, 88.62)],          # newest cycle still processing
    }
    missing = np.zeros((h, w), dtype=bool)
    for lo, hi in gaps.get(idx, []):
        missing |= (track >= lo) & (track < hi)
    return ~missing


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main() -> int:
    if not SRC_GEOJSON.exists():
        print(f"ERROR: missing {SRC_GEOJSON}", file=sys.stderr)
        return 1

    rng = np.random.default_rng(SEED)
    grid = Grid(BBOX, GRID_WIDTH)
    print(f"grid        : {grid.width} x {grid.height} px")

    # ---- districts -------------------------------------------------------
    raw = json.loads(SRC_GEOJSON.read_text(encoding="utf-8"))
    districts, features = [], []
    for feat in raw["features"]:
        source_name = feat["properties"]["shapeName"]
        name_en, name_bn, division, regime = DISTRICTS[source_name]
        geom_full = feat["geometry"]
        area = sum(ring_area_km2(r) for r in polygons_of(geom_full))
        geom = simplify_geometry(geom_full, SIMPLIFY_DECIMALS, min_km2=1.5)

        xs = [p[0] for r in polygons_of(geom) for p in r]
        ys = [p[1] for r in polygons_of(geom) for p in r]
        biggest = max(polygons_of(geom), key=ring_area_km2)
        cx = sum(p[0] for p in biggest[:-1]) / (len(biggest) - 1)
        cy = sum(p[1] for p in biggest[:-1]) / (len(biggest) - 1)

        rec = {
            "id": slugify(name_en),
            "name_en": name_en,
            "name_bn": name_bn,
            "source_name": source_name,
            "shape_id": feat["properties"].get("shapeID"),
            "division": division,
            "regime": regime,
            "area_km2": round(area, 1),
            "centroid": [round(cx, 4), round(cy, 4)],
            "bbox": [round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)],
        }
        districts.append(rec)
        # Properties are filled in from `rec` once the season summary exists, so
        # a GeoJSON feature carries a complete district record and the frontend
        # needs no second lookup to render the map, the ranking or the panel.
        features.append({
            "type": "Feature",
            "id": rec["id"],
            "properties": rec,
            "geometry": geom,
        })

    districts.sort(key=lambda r: r["name_en"])
    features.sort(key=lambda f: f["properties"]["name_en"])
    index_of = {rec["id"]: i + 1 for i, rec in enumerate(districts)}  # 0 = outside
    print(f"districts   : {len(districts)}")
    print(f"land area   : {sum(r['area_km2'] for r in districts):,.0f} km2 "
          f"(official total 147,570 km2)")

    # ---- rasterise districts --------------------------------------------
    canvas = Image.new("L", (grid.width, grid.height), 0)
    d = ImageDraw.Draw(canvas)
    for feat in features:
        idx = index_of[feat["properties"]["id"]]
        for ring in polygons_of(feat["geometry"]):
            d.polygon([grid.to_px(lon, lat) for lon, lat in ring], fill=idx)
    dmap = np.asarray(canvas, dtype=np.uint8)
    land = (dmap > 0).astype(np.float32)

    px_area = grid.row_areas_km2()[:, None]
    raster_area = {rec["id"]: float(((dmap == index_of[rec["id"]]) * px_area).sum())
                   for rec in districts}
    err = [abs(raster_area[r["id"]] - r["area_km2"]) / max(1.0, r["area_km2"])
           for r in districts]
    print(f"raster check: mean area error {100 * sum(err) / len(err):.2f}% "
          f"(max {100 * max(err):.2f}%)")

    # ---- permanent water + river proximity ------------------------------
    water = build_permanent_water(grid, land, rng)
    water_bool = water > 0.5
    proximity = blur(water_bool.astype(np.float32), radius=PROXIMITY_RADIUS_PX)
    proximity = proximity / max(1e-6, float(proximity.max()))
    proximity = np.power(proximity, 0.55)  # widen the reach of the big rivers
    print(f"water       : {float((water_bool * px_area).sum()):,.0f} km2 permanent "
          f"({100 * water_bool.sum() / max(1, (dmap > 0).sum()):.1f}% of land)")

    # ---- per-district pixel bookkeeping ---------------------------------
    # Two index sets per district, and the distinction matters:
    #   all_*   every pixel of the district, permanent water included. Radar
    #           coverage is measured against this, because the satellite sees
    #           rivers as readily as fields.
    #   land_*  the pixels that can newly flood. Somewhere that is already a
    #           river cannot become "new water", so it is excluded from the
    #           flood numerator.
    # Dividing flooded land by the land-only area would quietly report riverine
    # districts as partly observed when coverage was in fact complete.
    cells = {}
    for rec in districts:
        idx = index_of[rec["id"]]
        in_district = dmap == idx
        all_rows, all_cols = np.nonzero(in_district)
        land_rows, land_cols = np.nonzero(in_district & ~water_bool)
        cells[rec["id"]] = (all_rows, all_cols, land_rows, land_cols)
        rec["permanent_water_km2"] = round(
            float(((in_district & water_bool) * px_area).sum()), 1)
    # Per-district variation: how severe it gets, how many days it lags its
    # regime, and how drawn-out its crest is. Drawn once, reused every cycle,
    # so the season stays internally consistent.
    district_jitter = {
        rec["id"]: {
            "peak": 0.80 + 0.40 * float(rng.random()),
            "lag": round(-5.0 + 10.0 * float(rng.random()), 1),
            "width": 0.85 + 0.30 * float(rng.random()),
        }
        for rec in districts
    }

    # ---- cycles ----------------------------------------------------------
    dates = cycle_dates()
    print(f"cycles      : {len(dates)}  {dates[0]} .. {dates[-1]}")
    OUT_OVERLAYS.mkdir(parents=True, exist_ok=True)

    cycles, stats = [], {}
    for ci, cdate in enumerate(dates):
        iso = cdate.isoformat()
        footprint = observation_footprint(grid, ci, len(dates))
        # Two scales of "how wet is this spot": a broad field that moves the
        # weather around between cycles, and a fine one that roughens the edge
        # of the water so the result does not look like a buffer round a river.
        wetness = value_noise(grid.height, grid.width, 4, rng,
                              octaves=5, persistence=0.58, aniso=1.7)
        rough = value_noise(grid.height, grid.width, 9, rng,
                            octaves=4, persistence=0.50, aniso=1.2)
        flood = np.zeros((grid.height, grid.width), dtype=bool)
        per_district = {}

        for rec in districts:
            did = rec["id"]
            all_rows, all_cols, land_rows, land_cols = cells[did]
            if all_rows.size == 0:
                per_district[did] = {"observed": False, "coverage_pct": 0.0,
                                     "flooded_km2": 0.0, "flooded_pct": None}
                continue

            # Coverage is measured over the whole district, water included.
            seen_all = footprint[all_rows, all_cols]
            area_all = raster_area[did]
            coverage = 100.0 * float((px_area[all_rows, 0] * seen_all).sum())                 / max(1e-6, area_all)

            # Rasterising a polygon at ~520 m/px gains or loses a couple of
            # percent against its true geodesic area. Every area derived from
            # pixel counts is therefore rescaled onto the geodesic area, so the
            # figures on screen divide the way a reader expects: flooded_km2
            # over the district area really is flooded_pct.
            scale = rec["area_km2"] / max(1e-6, area_all)
            observed_km2 = rec["area_km2"] * coverage / 100.0

            if coverage < 1.0:
                per_district[did] = {"observed": False, "coverage_pct": 0.0,
                                     "flooded_km2": 0.0, "flooded_pct": None}
                continue

            # Flooding can only appear on land that is not already water.
            rows, cols = land_rows, land_cols
            seen = footprint[rows, cols]

            cfg = REGIME[rec["regime"]]
            jit = district_jitter[did]
            target = cfg["peak"] * district_intensity(cdate, cfg, jit) * jit["peak"]
            target = max(0.0, min(0.92, target))

            r_in, c_in = rows[seen], cols[seen]
            n_take = int(round(target * r_in.size))
            flooded_km2 = 0.0
            if n_take > 0:
                # Ranking straight by distance-to-channel would select a tidy
                # buffer around every river, which is not what inundation looks
                # like. This is instead a crude inverse-elevation model: low
                # ground is ground close to a channel, minus whatever the
                # multi-scale terrain noise raises. Flooding fills the lowest
                # `target` share of the district, giving ragged fronts, dry
                # islands inside the flood, and isolated depressions that fill
                # with no channel next to them.
                pull = cfg["river_pull"]
                wet, rgh = wetness[r_in, c_in], rough[r_in, c_in]
                terrain = 0.60 * wet + 0.40 * rgh
                score = (pull * proximity[r_in, c_in]
                         + TERRAIN_WEIGHT * (terrain - 0.5)
                         + (1.0 - pull) * wet)
                pick = np.argpartition(score, -n_take)[-n_take:]
                fr, fc = r_in[pick], c_in[pick]
                flood[fr, fc] = True
                flooded_km2 = float(px_area[fr, 0].sum()) * scale

            per_district[did] = {
                "observed": True,
                "coverage_pct": round(coverage, 1),
                "flooded_km2": round(flooded_km2, 1),
                # New water as a share of the district area the radar actually
                # saw this cycle. Permanent rivers and beels are already out of
                # the numerator; they stay in the denominator because they are
                # still part of the district.
                "flooded_pct": round(100.0 * flooded_km2 / max(1e-6, observed_km2), 1),
                "observed_km2": round(observed_km2, 1),
            }

        write_flood_png(OUT_OVERLAYS / iso / "flood.png", flood)

        seen_ids = [i for i, v in per_district.items() if v["observed"]]
        total_flooded = sum(per_district[i]["flooded_km2"] for i in seen_ids)
        total_observed = sum(per_district[i]["observed_km2"] for i in seen_ids)
        worst = max(seen_ids, key=lambda i: per_district[i]["flooded_pct"], default=None)
        by_name = {r["id"]: r for r in districts}

        cycles.append({
            "date": iso,
            "index": ci,
            "label": f"{cdate.day} {cdate.strftime('%b')}",
            "national": {
                "flooded_km2": round(total_flooded, 1),
                "observed_km2": round(total_observed, 1),
                "flooded_pct": round(100.0 * total_flooded / max(1e-6, total_observed), 2),
                "coverage_pct": round(
                    100.0 * total_observed / sum(r["area_km2"] for r in districts), 1),
                "districts_observed": len(seen_ids),
                "districts_total": len(districts),
                "worst": None if worst is None else {
                    "id": worst,
                    "name_en": by_name[worst]["name_en"],
                    "name_bn": by_name[worst]["name_bn"],
                    "flooded_pct": per_district[worst]["flooded_pct"],
                    "flooded_km2": per_district[worst]["flooded_km2"],
                },
            },
            "overlay": {
                "flood": f"/data/overlays/{iso}/flood.png",
                "water": "/data/overlays/water.png",
            },
        })
        stats[iso] = per_district
        print(f"  {iso}  flooded {total_flooded:8,.0f} km2   "
              f"observed {len(seen_ids):2d}/64   worst "
              f"{by_name[worst]['name_en'] if worst else '-'}")

    write_water_png(OUT_OVERLAYS / "water.png", water_bool)

    # ---- per-district season summary (drives F11 before/after) ----------
    for rec in districts:
        did = rec["id"]
        seen = [c["date"] for c in cycles if stats[c["date"]][did]["observed"]]
        if seen:
            peak = max(seen, key=lambda dt: stats[dt][did]["flooded_pct"])
            rec["peak_cycle"] = peak
            rec["peak_flooded_pct"] = stats[peak][did]["flooded_pct"]
            rec["peak_flooded_km2"] = stats[peak][did]["flooded_km2"]
            rec["baseline_cycle"] = seen[0]
            rec["cycles_observed"] = len(seen)
        else:
            rec.update(peak_cycle=None, peak_flooded_pct=None, peak_flooded_km2=None,
                       baseline_cycle=None, cycles_observed=0)

    # ---- alerts (F10) ----------------------------------------------------
    latest = cycles[-1]["date"]
    prev = cycles[-2]["date"] if len(cycles) > 1 else None
    alerts = []
    for rec in districts:
        cur = stats[latest][rec["id"]]
        if not cur["observed"] or cur["flooded_pct"] < ALERT_WARNING_PCT:
            continue
        before = stats[prev][rec["id"]] if prev else None
        prev_pct = before["flooded_pct"] if before and before["observed"] else None
        alerts.append({
            "district_id": rec["id"],
            "name_en": rec["name_en"],
            "name_bn": rec["name_bn"],
            "level": "severe" if cur["flooded_pct"] >= ALERT_SEVERE_PCT else "warning",
            "flooded_pct": cur["flooded_pct"],
            "flooded_km2": cur["flooded_km2"],
            "previous_pct": prev_pct,
            "change_pct": None if prev_pct is None else round(cur["flooded_pct"] - prev_pct, 1),
            "cycle": latest,
        })
    alerts.sort(key=lambda a: -a["flooded_pct"])
    print(f"alerts      : {len(alerts)} district(s) at or above "
          f"{ALERT_WARNING_PCT:.0f}% in cycle {latest}")

    # ---- write -----------------------------------------------------------
    dataset = {
        "meta": {
            "mission": "NASA-ISRO NISAR",
            "instrument": "L-band SAR, 12-day repeat",
            "distributor": "ASF DAAC",
            "product": "Provisional NISAR L-band dual-pol amplitude, water/no-water threshold",
            "provisional": True,
            "demo_data": True,
            "demo_note": ("Flood extents in this build are generated by "
                          "scripts/seed_data.py, not measured from NISAR granules. "
                          "Boundaries, areas, the cycle calendar and all arithmetic "
                          "are real."),
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "seed": SEED,
            "cycle_length_days": 12,
            "season": {"start": SEASON_START.isoformat(), "end": SEASON_END.isoformat()},
            "latest_cycle": latest,
            "last_checked": LAST_CHECKED.isoformat(),
            "country_area_km2": round(sum(r["area_km2"] for r in districts), 1),
            "alert_levels": {"warning_pct": ALERT_WARNING_PCT, "severe_pct": ALERT_SEVERE_PCT},
            "low_coverage_pct": LOW_COVERAGE_PCT,
            "grid": {
                "width": grid.width,
                "height": grid.height,
                "projection": "EPSG:3857 (linear in lon / mercator-y)",
                "bounds": {"west": grid.west, "south": grid.south,
                           "east": grid.east, "north": grid.north},
                "leaflet_bounds": [[grid.south, grid.west], [grid.north, grid.east]],
                "approx_m_per_px": round(
                    (grid.east - grid.west) * 111320 * math.cos(math.radians(23.7)) / grid.width),
            },
            "boundaries": {
                "name": "geoBoundaries gbOpen BGD ADM2",
                "release": "9469f09",
                "year_represented": 2020,
                "licence": "CC BY 3.0 IGO",
                "source": "data.humdata.org/dataset/administrative-boundaries-of-bangladesh-as-of-2015",
                "url": "https://www.geoboundaries.org/",
            },
        },
        "cycles": cycles,
        "districts": districts,
        "stats": stats,
        "alerts": alerts,
    }

    # `properties` is the same dict object as the district record, so the peak
    # fields added above are already present; this asserts that rather than
    # trusting it.
    for feat in features:
        assert "peak_cycle" in feat["properties"], feat["properties"]["id"]

    OUT_DATA.mkdir(parents=True, exist_ok=True)
    (OUT_DATA / "dataset.json").write_text(
        json.dumps(dataset, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DATA / "districts.geojson").write_text(
        json.dumps({"type": "FeatureCollection",
                    "name": "bgd_adm2_districts",
                    "attribution": "geoBoundaries gbOpen BGD ADM2 (CC BY 3.0 IGO)",
                    "features": features},
                   ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    for path in (OUT_DATA / "dataset.json", OUT_DATA / "districts.geojson"):
        print(f"wrote       : public/data/{path.name}  {path.stat().st_size / 1024:,.0f} KB")
    png_kb = sum(p.stat().st_size for p in OUT_OVERLAYS.rglob("*.png")) / 1024
    print(f"wrote       : {len(list(OUT_OVERLAYS.rglob('*.png')))} overlay PNGs  {png_kb:,.0f} KB")
    return 0


def write_flood_png(path: Path, mask: np.ndarray) -> None:
    """Red, 80% opacity - 'new water (not normally water)' per the plan."""
    path.parent.mkdir(parents=True, exist_ok=True)
    h, w = mask.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = 214
    rgba[..., 1] = 31
    rgba[..., 2] = 38
    rgba[..., 3] = (mask * 204).astype(np.uint8)
    Image.fromarray(rgba).save(path, optimize=True)


def write_water_png(path: Path, mask: np.ndarray) -> None:
    """Blue, 65% opacity - 'rivers, beels, ponds present most of the time'."""
    path.parent.mkdir(parents=True, exist_ok=True)
    h, w = mask.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = 31
    rgba[..., 1] = 102
    rgba[..., 2] = 186
    rgba[..., 3] = (mask * 166).astype(np.uint8)
    Image.fromarray(rgba).save(path, optimize=True)


if __name__ == "__main__":
    raise SystemExit(main())
