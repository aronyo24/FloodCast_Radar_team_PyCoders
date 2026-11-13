"""
A tiny synthetic web_data bundle for tests: three districts, two cycles.

The numbers are invented for testing only.
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

from PIL import Image

CYCLES = ("2026-07-11", "2026-07-23")

DISTRICTS = [
    # id, slug-ish name, bbox (w, s, e, n), area
    (60, "Sirajganj", "সিরাজগঞ্জ", (89.3, 24.1, 89.9, 24.7), 2497.9),
    (61, "Bogura", "বগুড়া", (89.0, 24.6, 89.6, 25.1), 2898.3),
    (62, "Khulna", "খুলনা", (89.2, 21.8, 89.7, 23.0), 4389.1),
]

# cycle -> district name -> (observed_km2, flood_km2_seen, coverage_pct, flood_pct, flood_km2_est)
CYCLE_ROWS = {
    "2026-07-11": {
        "Sirajganj": (2497.9, 299.7, 100.0, 12.0, 299.7),
        "Bogura": (2898.3, 86.9, 100.0, 3.0, 86.9),
        "Khulna": (1580.1, 31.6, 36.0, 2.0, 87.8),
    },
    "2026-07-23": {
        "Sirajganj": (2497.9, 749.4, 100.0, 30.0, 749.4),
        "Bogura": (2898.3, 405.8, 100.0, 14.0, 405.8),
        "Khulna": (4389.1, 175.6, 100.0, 4.0, 175.6),
    },
}


def _square(w, s, e, n):
    return {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}


def _png(path: Path, color=(220, 30, 30, 160)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (8, 12), color).save(path, format="PNG")


def write_bundle(root: Path, cycle_rows: dict | None = None, meta: dict | None = None) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    rows = cycle_rows or CYCLE_ROWS

    features = [
        {
            "type": "Feature",
            "properties": {"id": pk, "name_en": name, "name_bn": bn, "area_km2": area, "division": "Test"},
            "geometry": _square(*bbox),
        }
        for pk, name, bn, bbox, area in DISTRICTS
    ]
    (root / "districts.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False), encoding="utf-8"
    )

    with open(root / "district_cycles.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["cycle_start", "district", "observed_km2", "flood_km2_seen", "coverage_pct",
                    "flood_pct", "flood_km2_est", "images", "last_image"])
        for cycle, by_name in rows.items():
            for name, (obs, seen, cov, pct, est) in by_name.items():
                w.writerow([cycle, name, obs, seen, cov, pct, est, 2, cycle])

    with open(root / "national_cycles.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["cycle_start", "flood_km2_est", "districts_seen", "area_seen_km2"])
        for cycle, by_name in rows.items():
            w.writerow([cycle, round(sum(v[4] for v in by_name.values()), 1), len(by_name),
                        round(sum(v[0] for v in by_name.values()), 1)])

    with open(root / "checkframes.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["key", "epsg", "images", "water_cutoff_db", "cutoff_source", "contrast_db",
                    "normal_water_method", "first", "last"])
        w.writerow(["T045A_F071", 32646, 2, -18.5, "otsu", 6.2, "dry-season-min", CYCLES[0], CYCLES[1]])

    with open(root / "district_observations.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["scene", "frame", "date", "district", "observed_km2", "water_km2", "flood_km2"])
        for cycle, by_name in rows.items():
            for name, (obs, seen, *_rest) in by_name.items():
                w.writerow([f"NISAR_T045A_F071_{cycle}", "T045A_F071", cycle, name, obs, 10.0, seen])

    _png(root / "overlays" / "water.png", (40, 90, 200, 160))
    overlays = [{"file": "overlays/water.png", "kind": "water", "date": CYCLES[0],
                 "bounds": [[21.8, 89.0], [25.1, 89.9]]}]
    for cycle in rows:
        _png(root / "overlays" / f"flood_{cycle}.png")
        overlays.append({"file": f"overlays/flood_{cycle}.png", "kind": "flood", "date": cycle,
                         "frame": "T045A_F071", "south": 21.8, "west": 89.0, "north": 25.1, "east": 89.9})
    (root / "overlays.json").write_text(json.dumps({"overlays": overlays}), encoding="utf-8")

    (root / "meta.json").write_text(
        json.dumps(meta if meta is not None else {"demo_data": True, "demo_note": "Test fixture."}), encoding="utf-8"
    )
    return root


def zip_dir(root: Path, archive: Path, prefix: str = "web_data/") -> Path:
    with zipfile.ZipFile(archive, "w") as zf:
        for path in sorted(root.rglob("*")):
            if path.is_file():
                zf.write(path, prefix + path.relative_to(root).as_posix())
    return archive


def zip_with_member(archive: Path, name: str, data: bytes = b"x") -> Path:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(name, data)
    archive.write_bytes(buf.getvalue())
    return archive
