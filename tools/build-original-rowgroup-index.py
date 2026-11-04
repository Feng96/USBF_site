"""Add exact, SHA-bound Parquet row-group geometry envelopes to a certified index.

Only complete finite envelopes may prune browser reads. Unknown group bounds
remain explicit and must be included conservatively by consumers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-engine"))
from usbf_engine.runtime import Runtime, ident, sqlstr


def valid_box(value):
    return (isinstance(value, list) and len(value) == 4
            and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in value)
            and -180 <= value[0] <= value[2] <= 180 and -90 <= value[1] <= value[3] <= 90)


def validate_groups(groups, rows, whole_bounds):
    if not isinstance(groups, list) or not isinstance(rows, int) or isinstance(rows, bool) or rows < 0:
        raise ValueError("The row-group partition is invalid.")
    expected = 0
    for group in groups:
        if (not isinstance(group, dict) or type(group.get("rowStart")) is not int
                or type(group.get("rowEnd")) is not int or group["rowStart"] != expected
                or not group["rowStart"] < group["rowEnd"] <= rows
                or type(group.get("geometry_bounds_complete")) is not bool):
            raise ValueError("Row groups must form an exact contiguous 0..rows partition.")
        box = group.get("geometry_bbox")
        if group["geometry_bounds_complete"] and not valid_box(box):
            raise ValueError("A complete row group needs finite whole-geometry bounds.")
        if box is not None:
            if not valid_box(box):
                raise ValueError("A row-group geometry envelope is invalid.")
            if valid_box(whole_bounds) and not (whole_bounds[0] <= box[0] <= box[2] <= whole_bounds[2]
                                               and whole_bounds[1] <= box[1] <= box[3] <= whole_bounds[3]):
                raise ValueError("A row-group envelope leaves its certified full-file bounds.")
        expected = group["rowEnd"]
    if expected != rows:
        raise ValueError("The row-group partition omits source records.")
    return groups


def file_hash(file):
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def physical_groups(connection, file, expected_rows):
    groups = connection.execute("SELECT row_group_id,min(row_group_num_rows),max(row_group_num_rows) FROM parquet_metadata(?) GROUP BY row_group_id ORDER BY row_group_id", [str(file)]).fetchall()
    result, offset = [], 0
    for number, (identity, low, high) in enumerate(groups):
        if identity != number or low != high or type(low) is not int or low <= 0:
            raise ValueError("The original physical Parquet row groups are inconsistent.")
        result.append((offset, offset + low))
        offset += low
    if offset != expected_rows:
        raise ValueError("The Parquet metadata row count differs from the certified manifest.")
    return result


def index_groups(connection, file, source, certified, *, small_threshold=50000):
    rows = source["rows"]
    if rows <= small_threshold:
        groups = [] if rows == 0 else [{"rowStart": 0, "rowEnd": rows,
                                       "geometry_bbox": certified.get("geometry_bbox"),
                                       "geometry_bounds_complete": certified.get("geometry_bounds_complete") is True}]
        return validate_groups(groups, rows, certified.get("geometry_bbox"))
    if file_hash(file) != source["sha256"]:
        raise ValueError("An original shard no longer matches the saved SHA256: " + source["path"])
    partitions = physical_groups(connection, file, rows)
    columns = {name: kind for name, kind, *_ in connection.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(file)]).fetchall()}
    if "geometry" not in columns or "file_row_number" in columns:
        raise ValueError("The original source has no supported primary geometry or conflicts with the stable physical row identity.")
    geometry = ident("geometry") if str(columns["geometry"]).startswith("GEOMETRY") else "ST_GeomFromWKB(" + ident("geometry") + ")"
    ranges = ",".join("(" + str(start) + "," + str(end) + ")" for start, end in partitions)
    bounded = ("g IS NOT NULL AND NOT ST_IsEmpty(g) AND isfinite(ST_XMin(g)) AND isfinite(ST_YMin(g)) "
               "AND isfinite(ST_XMax(g)) AND isfinite(ST_YMax(g)) AND ST_XMin(g)>=-180 AND ST_XMax(g)<=180 "
               "AND ST_YMin(g)>=-90 AND ST_YMax(g)<=90")
    query = ("WITH ranges(rowStart,rowEnd) AS (VALUES " + ranges + "), source AS (SELECT file_row_number," + geometry
             + " AS g FROM read_parquet(" + sqlstr(file) + ",file_row_number=true)), grouped AS (SELECT r.rowStart,r.rowEnd,s.g FROM source s ASOF JOIN ranges r ON s.file_row_number>=r.rowStart WHERE s.file_row_number<r.rowEnd) "
             + "SELECT rowStart,rowEnd,count(*),count(*) FILTER (WHERE " + bounded + "),min(ST_XMin(g)),min(ST_YMin(g)),max(ST_XMax(g)),max(ST_YMax(g)) FROM grouped GROUP BY rowStart,rowEnd ORDER BY rowStart")
    records = connection.execute(query).fetchall()
    result = []
    if len(records) != len(partitions):
        raise ValueError("Some physical source row groups were not indexed.")
    for expected, row in zip(partitions, records):
        if tuple(row[:2]) != expected or row[2] != row[1] - row[0]:
            raise ValueError("The source scanner did not retain the exact physical row-group partition.")
        box = list(row[4:])
        valid = valid_box(box)
        result.append({"rowStart": row[0], "rowEnd": row[1], "geometry_bbox": box if valid else None,
                       "geometry_bounds_complete": bool(valid and row[2] == row[3])})
    return validate_groups(result, rows, certified.get("geometry_bbox"))


def build(manifest_raw, geometry_raw, source_root, runtime, *, progress=None, small_threshold=50000):
    manifest, geometry = json.loads(manifest_raw), json.loads(geometry_raw)
    if (manifest.get("release") != "USBF_v1" or manifest.get("crs") != "EPSG:4326"
            or geometry.get("schema") != 1 or geometry.get("crs") != "EPSG:4326"
            or geometry.get("sourceManifestSha256") != hashlib.sha256(manifest_raw).hexdigest()):
        raise ValueError("The certified geometry index does not match the original source manifest.")
    source_files = {item["path"]: item for item in manifest["files"] if re.fullmatch(r"USBF_x[+-]\d+_y[+-]\d+\.parquet", item.get("path", ""))}
    if len(source_files) != manifest["tiles"] or len(geometry.get("files", [])) != len(source_files):
        raise ValueError("The original publication and geometry index shard counts disagree.")
    root, entries, seen = Path(source_root).resolve(), [], set()
    with runtime.connection() as connection:
        for item in geometry["files"]:
            name = item.get("path")
            source = source_files.get(name)
            if (not source or name in seen or item.get("sha256") != source.get("sha256")
                    or item.get("rows") != source.get("rows") or type(item.get("geometry_bounds_complete")) is not bool):
                raise ValueError("A certified source shard identity is missing, duplicated or changed.")
            seen.add(name)
            file = root / name
            if not file.resolve().is_relative_to(root) or not file.is_file() or file.stat().st_size != source["bytes"]:
                raise ValueError("An original shard is missing or changed: " + name)
            groups = index_groups(connection, file, source, item, small_threshold=small_threshold)
            entries.append({**item, "rowGroups": groups})
            if progress and len(entries) % 50 == 0:
                progress(len(entries), len(source_files))
    return {**geometry, "rowGroupIndexVersion": 1, "sourceGeometryIndexSha256": hashlib.sha256(geometry_raw).hexdigest(),
            "rowGroupsComplete": all(group["geometry_bounds_complete"] for item in entries for group in item["rowGroups"]), "files": entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--geometry-index", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--extension", type=Path, required=True)
    args = parser.parse_args()
    runtime = Runtime(args.work, extension_path=args.extension, threads=2, memory_limit="1GB", allow_install=False)
    value = build(args.manifest.read_bytes(), args.geometry_index.read_bytes(), args.source_root, runtime,
                  progress=lambda done, total: print(json.dumps({"indexed": done, "total": total}), flush=True))
    encoded = (json.dumps(value, indent=2) + "\n").encode()
    sha256 = hashlib.sha256(encoded).hexdigest()
    output = args.output.with_name(args.output.stem + "-" + sha256[:16] + ".json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        stream.write(encoded)
    print(json.dumps({"path": str(output), "sha256": sha256, "bytes": len(encoded), "files": len(value["files"]),
                      "rowGroups": sum(len(item["rowGroups"]) for item in value["files"]), "rowGroupsComplete": value["rowGroupsComplete"]}), flush=True)


if __name__ == "__main__":
    main()
