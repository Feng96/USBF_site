"""Generate tiny original-data fixtures with existing PyArrow; no experiment inputs.

All coordinates and attributes are synthetic QA values. Output belongs on scratch.

Parquet V2 null counts are required, independently of optional statistics:
https://github.com/apache/parquet-format/blob/master/src/main/thrift/parquet.thrift
(DataPageHeaderV2: non-null = num_values - num_nulls.)
The installed PyArrow 11 writer with data_page_version="2.0" and
write_statistics=False emits num_nulls=0 even for null-containing pages.
`complete-v2.parquet` enables statistics and is standards-consistent;
`v2-inconsistent-nulls.parquet` deliberately records that existing writer case.
The importer rejects the inconsistency before value decoding; it does not guess
replacement values or patch the vendored decoder. Page-v1 remains supported.
"""
import argparse
import datetime as dt
from decimal import Decimal
import json
import math
from pathlib import Path
import struct
import pyarrow as pa
import pyarrow.parquet as pq


def point(x, y, z=None, endian="<"):
    values = [x, y] if z is None else [x, y, z]
    return struct.pack("B", endian == "<") + struct.pack(endian + "I", 1 if z is None else 1001) + struct.pack(endian + "d" * len(values), *values)


def line(points, endian="<"):
    return struct.pack("B", endian == "<") + struct.pack(endian + "II", 2, len(points)) + b"".join(struct.pack(endian + "dd", *p) for p in points)


def polygon(rings):
    return b"\x01" + struct.pack("<II", 3, len(rings)) + b"".join(struct.pack("<I", len(ring)) + b"".join(struct.pack("<dd", *p) for p in ring) for ring in rings)


def collection(kind, geometries):
    return b"\x01" + struct.pack("<II", kind, len(geometries)) + b"".join(geometries)


def geo(types, *, crs="absent", edges="planar", **extra):
    column = {"encoding": "WKB", "geometry_types": types, "edges": edges, **extra}
    if crs != "absent":
        column["crs"] = crs
    return {"version": "1.1.0", "primary_column": "footprint", "columns": {"footprint": column}}


def wgs_json():
    return {"$schema": "https://proj.org/schemas/v0.7/projjson.schema.json", "type": "GeographicCRS", "name": "WGS 84 longitude-latitude", "datum": {"type": "GeodeticReferenceFrame", "name": "World Geodetic System 1984", "ellipsoid": {"name": "WGS 84", "semi_major_axis": 6378137, "inverse_flattening": 298.257223563}}, "coordinate_system": {"subtype": "ellipsoidal", "axis": [{"name": "Geodetic longitude", "abbreviation": "Lon", "direction": "east", "unit": "degree"}, {"name": "Geodetic latitude", "abbreviation": "Lat", "direction": "north", "unit": "degree"}]}, "id": {"authority": "OGC", "code": "CRS84"}}


def merc_json():
    return {"$schema": "https://proj.org/schemas/v0.7/projjson.schema.json", "type": "ProjectedCRS", "name": "WGS 84 / Pseudo-Mercator", "base_crs": wgs_json(), "conversion": {"name": "Popular Visualisation Pseudo-Mercator", "method": {"name": "Popular Visualisation Pseudo Mercator", "id": {"authority": "EPSG", "code": 1024}}, "parameters": [{"name": "Latitude of natural origin", "value": 0, "unit": "degree", "id": {"authority": "EPSG", "code": 8801}}, {"name": "Longitude of natural origin", "value": 0, "unit": "degree", "id": {"authority": "EPSG", "code": 8802}}, {"name": "False easting", "value": 0, "unit": "metre", "id": {"authority": "EPSG", "code": 8806}}, {"name": "False northing", "value": 0, "unit": "metre", "id": {"authority": "EPSG", "code": 8807}}]}, "coordinate_system": {"subtype": "Cartesian", "axis": [{"name": "Easting", "abbreviation": "X", "direction": "east", "unit": "metre"}, {"name": "Northing", "abbreviation": "Y", "direction": "north", "unit": "metre"}]}, "id": {"authority": "EPSG", "code": 3857}}


def write(output, name, table, metadata=None, codec="zstd", row_group_size=2, page_version="1.0", statistics=False, **options):
    meta = dict(table.schema.metadata or {})
    if metadata is not None:
        meta[b"geo"] = json.dumps(metadata, separators=(",", ":")).encode()
    meta[b"license"] = b"Synthetic QA fixture; generated for parser validation"
    meta[b"attribution"] = b"Not observed building data"
    meta[b"footprint_license"] = b"ODbL 1.0; synthetic QA component"
    meta[b"height_license"] = b"CC BY-NC 4.0; synthetic QA component"
    table = table.replace_schema_metadata(meta)
    target = output / name
    pq.write_table(table, target, compression=codec, row_group_size=row_group_size, write_statistics=statistics, version="2.6", data_page_version=page_version, **options)
    return {"file": name, "bytes": target.stat().st_size, "rows": table.num_rows, "codec": codec}


def create(output):
    output.mkdir(parents=True, exist_ok=True)
    ring = [[-77.072, 38.912], [-77.0717, 38.912], [-77.0717, 38.9123], [-77.072, 38.9123], [-77.072, 38.912]]
    geometry = [point(-77.071, 38.912), polygon([ring]), point(-77.070, 38.911, 12.5, ">"), None, point(float("nan"), float("nan"))]
    table = pa.table({"id": pa.array([2**60 + 1, 2**60 + 2, 2**60 + 3, 0, None], type=pa.int64()), "zero": pa.array([0, 0, 0, 0, 0], type=pa.int32()), "flag": pa.array([False, True, None, False, None]), "height": pa.array([0.0, None, 12.5, 5.0, None]), "license": pa.array(["CC BY 4.0", "ODbL 1.0", None, "QA", "QA"]), "note": pa.array(["alpha", "β", None, "", "empty geometry"]), "decimal": pa.array([Decimal("9007199254740993.123456"), Decimal("-0.000001"), Decimal("0"), None, Decimal("2.500000")], type=pa.decimal128(24, 6)), "observed_at": pa.array([1700000000000000001, -1, 0, None, 1700000000000000999], type=pa.timestamp("ns", tz="UTC")), "binary_payload": pa.array([b"\x00\xff", None, b"", b"abc", None], type=pa.binary()), "nested": pa.array([{"count": 0, "description": None}, None, {"count": 2, "description": "x"}, {"count": None, "description": ""}, None], type=pa.struct([("count", pa.int32()), ("description", pa.string())])), "footprint": pa.array(geometry, type=pa.binary()), "geometry": pa.array([point(1, 2)] * 5, type=pa.binary())})
    metadata = geo(["Point", "Polygon", "Point Z"])
    metadata["columns"]["geometry"] = {"encoding": "WKB", "geometry_types": ["Point"]}
    index = {"description": "Synthetic original-data fixtures; no experiment or publication files", "files": []}
    for codec in ["zstd", "snappy", "none"]:
        index["files"].append(write(output, "complete-" + codec + ".parquet", table, metadata, codec=codec))
    index["files"].append(write(output, "complete-v2.parquet", table, metadata, page_version="2.0", statistics=True))
    index["files"].append(write(output, "v2-inconsistent-nulls.parquet", table, metadata, page_version="2.0", statistics=False))
    point_table = pa.table({"id": [1, 2], "flag": [False, None], "footprint": pa.array([point(-77, 39), point(-76, 38)], type=pa.binary())})
    index["files"].append(write(output, "explicit-wgs.parquet", point_table, geo(["Point"], crs=wgs_json())))
    index["files"].append(write(output, "unknown-crs.parquet", point_table, geo(["Point"], crs=None)))
    custom = wgs_json()
    del custom["id"]
    index["files"].append(write(output, "unidentified-projjson.parquet", point_table, geo(["Point"], crs=custom)))
    xy = [(6378137 * math.radians(lon), 6378137 * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))) for lon, lat in [(-77, 39), (-76, 38)]]
    projected = pa.table({"id": [1, 2], "footprint": pa.array([point(*p) for p in xy], type=pa.binary())})
    index["files"].append(write(output, "web-mercator.parquet", projected, geo(["Point"], crs=merc_json())))
    index["files"].append(write(output, "unknown-projected.parquet", projected, geo(["Point"], crs=None)))
    index["files"].append(write(output, "epoch.parquet", point_table, geo(["Point"], epoch=2022.5)))
    index["files"].append(write(output, "spherical-points.parquet", point_table, geo(["Point"], edges="spherical")))
    line_table = pa.table({"footprint": pa.array([line([[-77, 39], [-76, 38]])], type=pa.binary())})
    index["files"].append(write(output, "spherical-lines.parquet", line_table, geo(["LineString"], edges="spherical")))
    index["files"].append(write(output, "no-geo.parquet", point_table, None))
    arrow_table = pa.table({"footprint": pa.array([{"x": -77.0, "y": 39.0}], type=pa.struct([pa.field("x", pa.float64(), nullable=False), pa.field("y", pa.float64(), nullable=False)]))})
    arrow_geo = geo(["Point"])
    arrow_geo["columns"]["footprint"]["encoding"] = "point"
    index["files"].append(write(output, "geoarrow-point.parquet", arrow_table, arrow_geo))
    many = pa.table({"id": pa.array(range(50001), type=pa.int32()), "footprint": pa.array([point(-77, 39)] * 50001, type=pa.binary())})
    index["files"].append(write(output, "too-many-rows.parquet", many, geo(["Point"]), row_group_size=50001))
    bomb = pa.table({"note": ["a" * (1024 * 1024)] * 20, "footprint": pa.array([point(-77, 39)] * 20, type=pa.binary())})
    index["files"].append(write(output, "column-budget.parquet", bomb, geo(["Point"]), row_group_size=20, use_dictionary=False))
    complex_geometry = [collection(4, [point(-77, 39), point(-76, 38, endian=">")]), collection(5, [line([[-77, 39], [-76, 38]])]), collection(6, [polygon([ring])]), collection(7, [point(-77, 39), polygon([ring])])]
    complex_table = pa.table({"footprint": pa.array(complex_geometry, type=pa.binary()), "flag": [False, True, False, None]})
    index["files"].append(write(output, "multi-geometries.parquet", complex_table, geo(["MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection"])))
    index["files"].append(write(output, "unsupported-gzip.parquet", point_table, geo(["Point"]), codec="gzip"))
    times = pa.table({"footprint": pa.array([point(-77, 39)] * 3, type=pa.binary()), **{label + unit: pa.array([1700000000000000001 // factor, -1, None], type=pa.timestamp(unit, tz=tz)) for label, tz in [("local_", None), ("utc_", "UTC")] for unit, factor in [("ns", 1), ("us", 1000), ("ms", 1000000)]}})
    times = times.append_column("calendar_date", pa.array([0, -1, None], type=pa.date32()))
    times = times.append_column("nested_calendar", pa.array([{"date": -1}, {"date": 0}, None], type=pa.struct([("date", pa.date32())])))
    index["files"].append(write(output, "timestamp-semantics.parquet", times, geo(["Point"])))
    nested_time = pa.table({"footprint": pa.array([point(-77, 39)], type=pa.binary()), "nested": pa.array([{"local": 1700000000000001}], type=pa.struct([("local", pa.timestamp("us"))]))})
    index["files"].append(write(output, "nested-local-time.parquet", nested_time, geo(["Point"])))

    (output / "fixtures.json").write_text(json.dumps(index, indent=2))
    return index


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(create(args.output), indent=2))
