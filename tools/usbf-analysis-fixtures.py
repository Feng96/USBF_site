"""Write tiny synthetic USBF-shaped ZSTD GeoParquet files for parser QA.

These invented records validate software behavior; they are not observations or
an extract of the published USBF inventory. All generated files stay on Lustre.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
import struct

import pyarrow as pa
import pyarrow.parquet as pq


def ring(west, south, east, north):
    return [[west, south], [east, south], [east, north], [west, north], [west, south]]


def polygon(*rings):
    return {"type": "Polygon", "coordinates": list(rings)}


def wkb(geometry):
    if geometry["type"] == "MultiPolygon":
        parts = [wkb({"type": "Polygon", "coordinates": part}) for part in geometry["coordinates"]]
        return b"\x01" + struct.pack("<II", 6, len(parts)) + b"".join(parts)
    rings = geometry["coordinates"]
    return b"\x01" + struct.pack("<II", 3, len(rings)) + b"".join(
        struct.pack("<I", len(points)) + b"".join(struct.pack("<dd", *point) for point in points)
        for points in rings
    )


def create(output):
    output.mkdir(parents=True, exist_ok=True)
    source = (Path(__file__).resolve().parent.parent / "usbf-source.js").read_text()
    columns = ast.literal_eval(re.search(r"const columns=(\[.*?\]);", source).group(1))
    numbers = {"cx", "cy", "height", "gba_var", "added_area_m2", "removed_area_m2", "height_valid_fraction", "var"}
    flags = {"modified", "hollow_cut", "shape_changed", "possible_small_FP", "height_missing", "height_incomplete", "is_gba_only", "geometry_fallback"}
    geometries = [
        polygon(ring(-77.075, 38.910, -77.069, 38.914), ring(-77.073, 38.911, -77.072, 38.912)),
        polygon(ring(-77.0715, 38.912, -77.0711, 38.9124)),
        {"type": "MultiPolygon", "coordinates": [[ring(-77.0708, 38.912, -77.0706, 38.9122)], [ring(-77.0704, 38.912, -77.0702, 38.9122)]]},
        polygon(ring(-77.0698, 38.912, -77.0694, 38.9124)),
        *[polygon(ring(-77.301 + i * .0006, 38.600, -77.3006 + i * .0006, 38.6004)) for i in range(4)],
    ]
    rows = []
    names = ["qa-courtyard", "qa-zero", "qa-multipart", "qa-null", "qa-far-0", "qa-far-1", "qa-far-2", "qa-far-3"]
    for i, geometry in enumerate(geometries):
        row = {name: None for name in columns}
        row.update(usbf_id=names[i], source="osm" if i % 2 == 0 else "microsoft", id=2**60 + i + 1,
                   state="DC", cx=[-77.072, -77.0713, -77.0705, -77.0696][i] if i < 4 else -77.3008 + (i - 4) * .0006,
                   cy=38.9122 if i < 4 else 38.6002, height=[18., 0., 12.5, None, 9., 11., -999., None][i],
                   height_missing=[True, False, None, True, False, False, True, None][i],
                   modified=[None, False, True, None, False, True, None, False][i],
                   hollow_cut=False, shape_changed=False, possible_small_FP=None, height_incomplete=False,
                   is_gba_only=False, geometry_fallback=False, height_source="GBA synthetic QA height",
                   height_coverage_status="synthetic QA flag", inference_input_mode="synthetic QA fixture",
                   footprint_license="ODbL 1.0; synthetic QA component", height_license="CC BY-NC 4.0; synthetic QA component",
                   source_identity_basis="Invented QA identifier", release_status="synthetic QA fixture",
                   processing_status="Not observed building data", source_generation="synthetic", update_date="2026-10-28")
        rows.append(row)
    arrays = {}
    for column in columns:
        dtype = pa.int64() if column == "id" else pa.float64() if column in numbers else pa.bool_() if column in flags else pa.string()
        arrays[column] = pa.array([row[column] for row in rows], type=dtype)
    arrays["geometry"] = pa.array([wkb(g) for g in geometries], type=pa.binary())
    crs = {"$schema": "https://proj.org/schemas/v0.7/projjson.schema.json", "type": "GeographicCRS", "name": "WGS 84 longitude-latitude", "datum": {"type": "GeodeticReferenceFrame", "name": "World Geodetic System 1984", "ellipsoid": {"name": "WGS 84", "semi_major_axis": 6378137, "inverse_flattening": 298.257223563}}, "coordinate_system": {"subtype": "ellipsoidal", "axis": [{"name": "Geodetic longitude", "abbreviation": "Lon", "direction": "east", "unit": "degree"}, {"name": "Geodetic latitude", "abbreviation": "Lat", "direction": "north", "unit": "degree"}]}, "id": {"authority": "OGC", "code": "CRS84"}}
    geo = {"version": "1.1.0", "primary_column": "geometry", "columns": {"geometry": {"encoding": "WKB", "geometry_types": ["Polygon", "MultiPolygon"], "crs": crs, "edges": "planar"}}}
    table = pa.table(arrays).replace_schema_metadata({b"geo": json.dumps(geo).encode(), b"qa_notice": b"Invented QA records; not observed USBF buildings"})
    filename = "USBF_x-155_y+77.parquet"
    target = output / filename
    pq.write_table(table, target, compression="zstd", row_group_size=4, data_page_version="1.0", write_statistics=True, version="2.6")
    meta = pq.ParquetFile(target).metadata
    codecs = sorted({meta.row_group(r).column(c).compression for r in range(meta.num_row_groups) for c in range(meta.num_columns)})
    assert meta.num_rows == 8 and meta.num_row_groups == 2 and codecs == ["ZSTD"]
    features = []
    for row, geometry in zip(rows, geometries):
        properties = dict(row)
        properties["id"] = str(properties["id"])
        properties["height_m"] = row["height"] if row["height"] is not None and row["height"] > 0 else None
        properties["country_iso"] = "USA"
        features.append({"type": "Feature", "geometry": geometry, "properties": properties})
    tile = {"path": filename, "bytes": target.stat().st_size, "rows": 8, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "bbox": [-77.301, 38.600, -77.069, 38.914], "tile_bbox": [-77.5, 38.5, -77, 39]}
    result = {"description": "Synthetic parser QA records; not observed USBF buildings", "pyarrow": pa.__version__, "codec": codecs, "rowGroups": 2, "columns": columns + ["geometry"], "tile": tile,
              "near": {"bounds": [-77.074, 38.909, -77.066, 38.917], "features": features[:4]},
              "far": {"bounds": [-77.305, 38.595, -77.295, 38.605], "features": features[4:]}}
    (output / "fixtures.json").write_text(json.dumps(result, indent=2) + "\n")
    single = output / "single"
    single.mkdir(exist_ok=True)
    single_target = single / filename
    pq.write_table(table.slice(0, 1), single_target, compression="zstd", row_group_size=1, data_page_version="1.0", write_statistics=True, version="2.6")
    single_tile = {**tile, "bytes": single_target.stat().st_size, "rows": 1, "sha256": hashlib.sha256(single_target.read_bytes()).hexdigest(), "bbox": [-77.075, 38.910, -77.069, 38.914]}
    single_result = {**result, "rowGroups": 1, "tile": single_tile, "near": {"bounds": result["near"]["bounds"], "features": features[:1]}, "far": {"bounds": result["far"]["bounds"], "features": []}}
    (single / "fixtures.json").write_text(json.dumps(single_result, indent=2) + "\n")
    return {"fixtureDirectory": str(output), "sidecar": str(output / "fixtures.json"), "parquet": str(target), "bytes": tile["bytes"], "rows": 8, "rowGroups": 2, "codec": codecs, "single": str(single)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    location = args.output.resolve()
    if not location.is_relative_to("/lustre/isaac24/scratch/yfeng21"):
        parser.error("Generated data fixtures must be written under the user's Lustre scratch root.")
    print(json.dumps(create(location), indent=2))
