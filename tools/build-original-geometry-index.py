"""Certify per-shard full geometry envelopes against exact original file hashes."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-engine"))
from usbf_engine.runtime import Runtime, ident, sqlstr


def index_entry(item, root, connection, validate_topology):
    file = root / item["path"]
    if not file.resolve().is_relative_to(root) or file.stat().st_size != item["bytes"]:
        raise ValueError("An original shard is missing or changed: " + item["path"])
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    if digest.hexdigest() != item["sha256"]:
        raise ValueError("An original shard no longer matches the publication SHA256.")
    columns = dict((row[0], row[1]) for row in connection.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(file)]).fetchall())
    if "geometry" not in columns:
        raise ValueError("An original shard has no primary geometry.")
    geom = ident("geometry") if "GEOMETRY" in columns["geometry"] else "ST_GeomFromWKB(" + ident("geometry") + ")"
    # Spatial pruning needs finite complete envelopes; polygon topology quality
    # remains a separate, much more expensive optional certification.
    bounded = "g IS NOT NULL AND NOT ST_IsEmpty(g) AND isfinite(ST_XMin(g)) AND isfinite(ST_YMin(g)) AND isfinite(ST_XMax(g)) AND isfinite(ST_YMax(g)) AND ST_XMin(g)>=-180 AND ST_XMax(g)<=180 AND ST_YMin(g)>=-90 AND ST_YMax(g)<=90"
    valid = "count(*) FILTER (WHERE " + bounded + " AND ST_IsValid(g))" if validate_topology else "NULL::BIGINT"
    row = connection.execute("WITH source AS (SELECT " + geom + " g FROM read_parquet(" + sqlstr(file) + ")) SELECT count(*),count(*) FILTER (WHERE " + bounded + "),min(ST_XMin(g)),min(ST_YMin(g)),max(ST_XMax(g)),max(ST_YMax(g))," + valid + " FROM source").fetchone()
    if row[0] != item["rows"]:
        raise ValueError("The original row count changed.")
    box = list(row[2:6])
    finite = all(isinstance(value, (float, int)) and math.isfinite(value) for value in box)
    usable = finite and -180 <= box[0] <= box[2] <= 180 and -90 <= box[1] <= box[3] <= 90
    return {"path": item["path"], "sha256": item["sha256"], "rows": row[0],
            "geometry_bbox": box if usable else None,
            "geometry_bounds_complete": bool(usable and row[0] == row[1]),
            "missingEmptyOrUnboundedGeometries": row[0] - row[1],
            "topologyValidated": bool(validate_topology),
            "missingOrInvalidGeometries": row[0] - row[6] if validate_topology else None}


def build(raw, source_root, runtime, progress=None, *, validate_topology=False):
    manifest = json.loads(raw)
    if manifest.get("release") != "USBF_v1" or manifest.get("crs") != "EPSG:4326":
        raise ValueError("A geometry index needs the published EPSG:4326 USBF manifest.")
    root = Path(source_root).resolve()
    entries = []
    with runtime.connection() as connection:
        for item in manifest["files"]:
            if not re.fullmatch(r"USBF_x[+-]\d+_y[+-]\d+\.parquet", item["path"]):
                continue
            entries.append(index_entry(item, root, connection, validate_topology))
            if progress and len(entries) % 50 == 0:
                progress(len(entries), manifest["tiles"])
    if len(entries) != manifest["tiles"]:
        raise ValueError("The geometry index is missing source shards.")
    return {"schema": 1, "sourceManifestSha256": hashlib.sha256(raw).hexdigest(), "crs": "EPSG:4326",
            "spatialRule": "whole-geometry-intersects-v1", "providerCompleteness": None,
            "topologyValidated": bool(validate_topology),
            "geometryBoundsGuaranteed": all(item["geometry_bounds_complete"] for item in entries), "files": entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--work", type=Path, required=True, help="Scratch runtime and disk spill directory")
    parser.add_argument("--extension", type=Path, required=True, help="Official signed DuckDB Spatial extension")
    parser.add_argument("--validate-topology", action="store_true", help="Also check polygon validity; not required for complete geometry envelopes")
    args = parser.parse_args()
    runtime = Runtime(args.work, extension_path=args.extension, threads=2, memory_limit="1GB", allow_install=False)
    value = build(args.manifest.read_bytes(), args.source_root, runtime, progress=lambda done,total: print(json.dumps({"indexed":done,"total":total}), flush=True), validate_topology=args.validate_topology)
    encoded = (json.dumps(value, indent=2) + "\n").encode()
    output = args.output.with_name(args.output.stem + "-" + hashlib.sha256(encoded).hexdigest()[:16] + ".json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        stream.write(encoded)
    print(json.dumps({"path": str(output), "sha256": hashlib.sha256(encoded).hexdigest(), "geometryBoundsGuaranteed": value["geometryBoundsGuaranteed"], "files": len(value["files"])}))


if __name__ == "__main__":
    main()
