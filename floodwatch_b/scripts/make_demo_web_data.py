#!/usr/bin/env python3
"""
Build a demo `web_data/` bundle from the frontend's generated dataset.

    python scripts/make_demo_web_data.py ../floodwatch_f web_data
    python manage.py import_web_data web_data --compute-alerts

The frontend ships a *synthetic* 2026 monsoon (floodwatch_f/scripts/seed_data.py).
This script reshapes it into the same files the Colab pipeline writes, so the
whole import -> API -> frontend path can be exercised before real NISAR
output exists. Everything it writes is labelled `demo_data: true`, and the
frontend shows the "Demo data" chip for as long as that is the case.

Standard library only.
"""

from __future__ import annotations

import csv
import json
import shutil
import sys
from pathlib import Path

DEMO_FRAME = "DEMO_MOSAIC"


def main(frontend: Path, out: Path) -> None:
    data_dir = frontend / "public" / "data"
    dataset = json.loads((data_dir / "dataset.json").read_text(encoding="utf-8"))
    geojson = json.loads((data_dir / "districts.geojson").read_text(encoding="utf-8"))
    meta = dataset["meta"]
    districts = {d["id"]: d for d in dataset["districts"]}

    out.mkdir(parents=True, exist_ok=True)
    (out / "overlays").mkdir(exist_ok=True)

    # districts.geojson - keep the boundary geometry and descriptive fields;
    # season statistics (peak etc.) are recomputed by the backend.
    keep = ("id", "name_en", "name_bn", "source_name", "shape_id", "division", "regime",
            "area_km2", "permanent_water_km2", "centroid", "bbox")
    features = [
        {"type": "Feature", "id": f["id"],
         "properties": {k: f["properties"][k] for k in keep if k in f["properties"]},
         "geometry": f["geometry"]}
        for f in geojson["features"]
    ]
    (out / "districts.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "name": geojson.get("name"), "features": features},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    cycles = [c["date"] for c in dataset["cycles"]]

    with open(out / "district_cycles.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["cycle_start", "district", "observed_km2", "flood_km2_seen", "coverage_pct",
                    "flood_pct", "flood_km2_est", "images", "last_image"])
        for c in cycles:
            for did, s in dataset["stats"][c].items():
                if not s["observed"]:
                    continue  # no radar frame touched it: no row, not a zero
                area = districts[did]["area_km2"]
                w.writerow([c, did, s["observed_km2"], s["flooded_km2"], s["coverage_pct"],
                            s["flooded_pct"], round(s["flooded_pct"] / 100 * area, 1), 1, c])

    with open(out / "national_cycles.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["cycle_start", "flood_km2_est", "districts_seen", "area_seen_km2"])
        for cyc in dataset["cycles"]:
            stats = dataset["stats"][cyc["date"]]
            est = sum(s["flooded_pct"] / 100 * districts[d]["area_km2"]
                      for d, s in stats.items() if s["observed"])
            n = cyc["national"]
            w.writerow([cyc["date"], round(est, 1), n["districts_observed"], n["observed_km2"]])

    with open(out / "checkframes.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["key", "epsg", "images", "water_cutoff_db", "cutoff_source", "contrast_db",
                    "normal_water_method", "first", "last"])
        w.writerow([DEMO_FRAME, 3857, len(cycles), "", "demo", "", "demo", cycles[0], cycles[-1]])

    with open(out / "district_observations.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["scene", "frame", "date", "district", "observed_km2", "water_km2", "flood_km2"])
        for c in cycles:
            for did, s in dataset["stats"][c].items():
                if not s["observed"]:
                    continue
                water = districts[did].get("permanent_water_km2", 0.0) * s["coverage_pct"] / 100
                w.writerow([f"DEMO_{c}", DEMO_FRAME, c, did, s["observed_km2"], round(water, 1),
                            s["flooded_km2"]])

    bounds = meta["grid"]["leaflet_bounds"]
    overlays = [{"file": "overlays/water.png", "kind": "water", "date": cycles[0],
                 "frame": DEMO_FRAME, "bounds": bounds}]
    shutil.copyfile(data_dir / "overlays" / "water.png", out / "overlays" / "water.png")
    for c in cycles:
        src = data_dir / "overlays" / c / "flood.png"
        if src.is_file():
            shutil.copyfile(src, out / "overlays" / f"flood_{c}.png")
            overlays.append({"file": f"overlays/flood_{c}.png", "kind": "flood", "date": c,
                             "frame": DEMO_FRAME, "bounds": bounds})
    (out / "overlays.json").write_text(json.dumps({"overlays": overlays}, indent=1), encoding="utf-8")

    (out / "meta.json").write_text(json.dumps({
        "mission": meta["mission"],
        "instrument": meta["instrument"],
        "distributor": meta["distributor"],
        "product": meta["product"],
        "provisional": True,
        "demo_data": True,
        "demo_note": meta["demo_note"],
        "generated_at": meta["generated_at"],
        "seed": meta.get("seed"),
        "boundaries": meta["boundaries"],
        "pipeline": "floodwatch_f/scripts/seed_data.py via make_demo_web_data.py (synthetic)",
    }, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote demo web_data to {out} ({len(features)} districts, {len(cycles)} cycles, "
          f"{len(overlays)} overlays). demo_data=true.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: make_demo_web_data.py <floodwatch_f dir> <output web_data dir>")
    main(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
