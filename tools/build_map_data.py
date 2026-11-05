"""Convert Natural Earth 110m countries (public domain) into a compact JSON the
history channel renders from.  Offline-friendly: the output is committed, so you
only need this script if you want to regenerate / swap the dataset.

    pip install pyshp
    python tools/build_map_data.py path/to/naturalearth_lowres.shp pipeline/data/world_110m.json

The shapefile ships inside geopandas<=0.14 wheels (geopandas/datasets/naturalearth_lowres).
"""
import json
import sys

import shapefile  # pyshp


def main(src, dst):
    r = shapefile.Reader(src)
    names = [f[0] for f in r.fields[1:]]
    out = []
    for sr in r.shapeRecords():
        rec = dict(zip(names, sr.record))
        shp = sr.shape
        parts = list(shp.parts) + [len(shp.points)]
        rings = []
        for a, b in zip(parts[:-1], parts[1:]):
            pts = shp.points[a:b]
            rings.append([[round(x, 2), round(y, 2)] for x, y in pts])
        out.append({"name": rec["name"], "continent": rec["continent"], "rings": rings})
    with open(dst, "w") as f:
        json.dump({"source": "Natural Earth 110m admin-0 (public domain)", "countries": out}, f, separators=(",", ":"))
    print(f"{len(out)} countries -> {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
