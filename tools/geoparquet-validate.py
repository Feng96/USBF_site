"""Independent PyArrow / Python comparison of JavaScript decoded QA imports."""
import argparse
import base64
from decimal import Decimal
import datetime as dt
import json
import math
from pathlib import Path
import struct
import pyarrow as pa
import pyarrow.parquet as pq


def geometry(blob):
    if blob is None:
        return None
    data = memoryview(blob)
    offset = 0

    def read():
        nonlocal offset
        endian = "<" if data[offset] else ">"
        offset += 1
        raw, = struct.unpack_from(endian + "I", data, offset)
        offset += 4
        kind, dimension = raw % 1000, 3 if raw >= 1000 else 2

        def count():
            nonlocal offset
            size, = struct.unpack_from(endian + "I", data, offset)
            offset += 4
            return size

        def point():
            nonlocal offset
            p = list(struct.unpack_from(endian + "d" * dimension, data, offset))
            offset += dimension * 8
            return None if all(math.isnan(value) for value in p) else p

        if kind == 1:
            p = point()
            return {"type": "Point", "coordinates": p} if p is not None else None
        if kind == 2:
            return {"type": "LineString", "coordinates": [point() for _ in range(count())]}
        if kind == 3:
            rings = [[point() for _ in range(count())] for _ in range(count())]
            return {"type": "Polygon", "coordinates": rings} if rings else None
        values = [read() for _ in range(count())]
        names = {4: "MultiPoint", 5: "MultiLineString", 6: "MultiPolygon", 7: "GeometryCollection"}
        if kind == 7:
            return {"type": names[kind], "geometries": [v for v in values if v is not None]}
        return {"type": names[kind], "coordinates": [v["coordinates"] for v in values if v is not None]}

    result = read()
    assert offset == len(data)
    return result


def close(a, b):
    if isinstance(a, float) or isinstance(b, float):
        assert isinstance(a, (int, float)) and isinstance(b, (int, float)) and math.isclose(a, b, abs_tol=1e-8, rel_tol=1e-10), (a, b)
    elif isinstance(a, dt.date):
        assert a.isoformat() == b, (a, b)
    elif isinstance(a, dict):
        assert set(a) == set(b), (a, b)
        for key in a:
            close(a[key], b[key])
    elif isinstance(a, list):
        assert isinstance(b, list) and len(a) == len(b), (a, b)
        for x, y in zip(a, b):
            close(x, y)
    else:
        assert a == b, (a, b)


def to_wgs(g, source):
    if g is None or source != "EPSG:3857":
        return g

    def coordinates(value):
        if not value or not isinstance(value[0], (float, int)):
            return [coordinates(v) for v in value]
        x, y, *rest = value
        return [math.degrees(x / 6378137), math.degrees(2 * math.atan(math.exp(y / 6378137)) - math.pi / 2), *rest]

    if g["type"] == "GeometryCollection":
        return {"type": g["type"], "geometries": [to_wgs(v, source) for v in g["geometries"]]}
    return {"type": g["type"], "coordinates": coordinates(g["coordinates"])}


def stamp(value, unit, adjusted):
    n = value * {"s": 10**9, "ms": 10**6, "us": 10**3, "ns": 1}[unit]
    seconds, fraction = divmod(n, 10**9)
    return dt.datetime.fromtimestamp(seconds, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + f".{fraction:09d}" + ("Z" if adjusted else "")


def validate(fixtures, decoded):
    checked = []
    for name, result in decoded.items():
        table = pq.read_table(fixtures / name)
        geo = json.loads(table.schema.metadata[b"geo"])
        primary = geo["primary_column"]
        geometry_columns = set(geo["columns"])
        rows = table.to_pylist()
        features = result["data"]["features"]
        assert len(rows) == len(features) == result["metadata"]["rows"]
        timestamp_columns = {field.name: (table[field.name].cast(pa.int64()).to_pylist(), field.type.unit, field.type.tz is not None) for field in table.schema if pa.types.is_timestamp(field.type)}
        for row_index, (row, feature) in enumerate(zip(rows, features)):
            assert set(feature["properties"]) == set(row) - geometry_columns
            for key in set(row) - geometry_columns:
                source, actual = row[key], feature["properties"][key]
                if key in timestamp_columns:
                    values, unit, adjusted = timestamp_columns[key]
                    assert actual == (None if values[row_index] is None else stamp(values[row_index], unit, adjusted))
                elif isinstance(source, int) and not isinstance(source, bool) and abs(source) > 2**53 - 1:
                    assert actual == str(source)
                elif isinstance(source, Decimal):
                    assert actual == str(source)
                elif isinstance(source, bytes):
                    assert actual["encoding"] == "base64" and base64.b64decode(actual["data"]) == source and actual["bytes"] == len(source)
                else:
                    close(source, actual)
            expected = to_wgs(geometry(row[primary]), result["sourceCrs"])
            close(expected, feature["geometry"])
        assert result["data"]["provenance"]["complete"] and not result["metadata"]["truncated"]
        rights = result["data"]["provenance"]["licenses"]
        assert all(isinstance(value, str) for value in rights)
        assert any("footprint_license: ODbL 1.0" in value for value in rights)
        assert any("height_license: CC BY-NC 4.0" in value for value in rights)
        checked.append({"file": name, "rows": len(rows), "sourceCrs": result["sourceCrs"]})
    return {"passed": True, "independentReader": "PyArrow " + pa.__version__, "files": checked}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("fixtures", type=Path)
    parser.add_argument("decoded", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = validate(args.fixtures, json.loads(args.decoded.read_text()))
    if args.output:
        args.output.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
