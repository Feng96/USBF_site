"""Indexed, complete-result exploration; display tiles never become analysis inputs.

Indexes and immutable selections are disposable, workspace-local cache files. The
checksummed original GeoParquet remains the authority for every result.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
import shutil
import threading
import uuid
from contextlib import contextmanager
from pathlib import Path

from .runtime import ident, sqlstr
from .validation import bounds, json_exact, scope_geometry

GEOM = "__usbf_geometry"
MAX_PAGE_BYTES = 16 * 1024 * 1024
MAX_TILE_BYTES = 8 * 1024 * 1024
DETAIL_MIN_ZOOM = 14
DISPLAY_FIELDS = {"height_m", "height", "render_height", "area_m2", "area_in_meters", "bf_source", "source", "geom_source", "modified"}
_locks_guard = threading.Lock()
_locks = {}
_queries = threading.BoundedSemaphore(2)


def _lock(path):
    with _locks_guard:
        return _locks.setdefault(str(path), threading.RLock())


def _atomic_json(path, value):
    temporary = Path(str(path) + ".writing")
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    os.replace(temporary, path)


def _bounded(value, maximum=MAX_PAGE_BYTES):
    if len(json.dumps(value, ensure_ascii=False, allow_nan=False).encode()) > maximum:
        raise ValueError("This native response exceeds 16 MiB. Request a smaller page or export the full original values.")
    return value


class ResultsMixin:
    @staticmethod
    def _display_fields(info):
        return [column for column in info["columns"] if column["name"].lower() in DISPLAY_FIELDS
                and (column["type"] in {"VARCHAR", "BOOLEAN"} or re.fullmatch(r"(?:U?TINYINT|U?SMALLINT|U?INTEGER|U?BIGINT|HUGEINT|UHUGEINT|FLOAT|DOUBLE|DECIMAL\([0-9]+,[0-9]+\))", str(column["type"])))]

    def _result_index(self, job_id):
        source = self.result_path(job_id)
        result = self.get_job(job_id)["result"]
        stat = source.stat()
        if stat.st_size != result["bytes"] or stat.st_mtime_ns != result["mtimeNs"]:
            raise ValueError("The complete native result changed. Reconnect or reprocess its original file before exploring it.")
        folder = self.workspace / "Cache" / "native-results" / job_id
        folder.mkdir(parents=True, exist_ok=True)
        database, metadata = folder / "index.duckdb", folder / "index.json"
        with _lock(database):
            if database.is_file() and metadata.is_file():
                info = json.loads(metadata.read_text(encoding="utf-8"))
                if info.get("sourceSha256") == result["sha256"] and info.get("schema") == 1:
                    return database, info
            if shutil.disk_usage(folder).free < max(stat.st_size * 5, 64 * 1024 * 1024):
                raise ValueError("Insufficient workspace disk space for the complete-result spatial index.")
            temporary = folder / "index.writing.duckdb"
            temporary.unlink(missing_ok=True)
            Path(str(temporary) + ".wal").unlink(missing_ok=True)
            try:
                with self.runtime.connection() as c:
                    description = c.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(source)]).fetchall()
                    fields = [{"name": r[0], "type": r[1]} for r in description if r[0] != GEOM]
                    names = {r[0].lower() for r in description}
                    def unique(name):
                        while name.lower() in names:
                            name += "_"
                        names.add(name.lower())
                        return name
                    row, projected = unique("__usbf_row"), unique("__usbf_map_geometry")
                    c.execute("ATTACH " + sqlstr(temporary) + " AS result_index")
                    # A single ordered Parquet scanner assigns stable 0-based
                    # identities without reserving any source attribute name.
                    c.execute("SET threads=1")
                    c.execute("SET preserve_insertion_order=true")
                    c.execute("CREATE TABLE result_index.features AS SELECT (row_number() OVER ()-1)::BIGINT AS " + ident(row)
                              + ",*,CASE WHEN " + ident(GEOM) + " IS NULL THEN NULL ELSE "
                              + "ST_Transform(ST_Force2D(" + ident(GEOM) + "),'EPSG:4326','EPSG:3857',always_xy:=true) END AS "
                              + ident(projected) + " FROM read_parquet(?)", [str(source)])
                    c.execute("CREATE UNIQUE INDEX native_row ON result_index.features(" + ident(row) + ")")
                    c.execute("CREATE INDEX native_map ON result_index.features USING RTREE(" + ident(projected) + ")")
                    c.execute("CREATE INDEX native_geometry ON result_index.features USING RTREE(" + ident(GEOM) + ")")
                    extent = c.execute("SELECT min(ST_XMin(" + ident(GEOM) + ")),min(ST_YMin(" + ident(GEOM)
                                       + ")),max(ST_XMax(" + ident(GEOM) + ")),max(ST_YMax(" + ident(GEOM)
                                       + ")) FROM result_index.features").fetchone()
                    count = c.execute("SELECT count(*) FROM result_index.features").fetchone()[0]
                    if count != result["rows"]:
                        raise ValueError("The result index row count does not match the original result.")
                    c.execute("DETACH result_index")
                info = {"schema": 1, "sourceSha256": result["sha256"], "recordCount": count,
                        "rowColumn": row, "mapColumn": projected, "columns": fields,
                        "bounds": list(extent) if all(x is not None and math.isfinite(x) for x in extent) else None}
                os.replace(temporary, database)
                _atomic_json(metadata, info)
                return database, info
            finally:
                temporary.unlink(missing_ok=True)
                Path(str(temporary) + ".wal").unlink(missing_ok=True)

    @contextmanager
    def _indexed_result(self, job_id):
        with _queries:
            database, info = self._result_index(job_id)
            with self.runtime.connection() as c:
                c.execute("SET threads=1")
                c.execute("ATTACH " + sqlstr(database) + " AS native_result (READ_ONLY)")
                yield c, info

    def result_map(self, job_id):
        _, info = self._result_index(job_id)
        return {"mode": "native-tiles", "sourceLayer": "buildings", "clusterSourceLayer": "clusters",
                "bounds": info["bounds"], "recordCount": info["recordCount"], "detailMinZoom": DETAIL_MIN_ZOOM,
                "maximumZoom": 22, "selection": True, "spatialIndex": "DuckDB RTree",
                "displayFields": [column["name"] for column in self._display_fields(info)],
                "displayFieldPolicy": "Common styling scalars only; text over 128 characters and unsafe/nonfinite display numbers are omitted. Full feature attributes remain original.",
                "displayRule": "All intersecting records contribute. Dense tiles aggregate adaptively; tiles generalize display geometry only."}

    def result_summary(self, job_id, value):
        if not isinstance(value, dict) or set(value) - {"selectionId", "field", "positiveOnly"}:
            raise ValueError("Unsupported native summary options.")
        if "positiveOnly" in value and not isinstance(value["positiveOnly"], bool):
            raise ValueError("The positive-value summary rule must be true or false.")
        with self._indexed_result(job_id) as (c, info):
            numeric = [column["name"] for column in info["columns"] if re.fullmatch(r"(?:U?TINYINT|U?SMALLINT|U?INTEGER|U?BIGINT|HUGEINT|UHUGEINT|FLOAT|DOUBLE|DECIMAL\([0-9]+,[0-9]+\))", str(column["type"]))]
            field = value.get("field")
            if field is not None and field not in numeric:
                raise ValueError("Choose an original numeric field for the full-result summary.")
            if field is None:
                field = next((name for name in numeric if name.lower() in {"height", "height_m", "height_meters", "height_metres"}), None)
            where = self._selection_clause(job_id, value["selectionId"], info) if value.get("selectionId") else "true"
            aggregations = ["count(*)", "min(ST_XMin(f." + ident(GEOM) + "))", "min(ST_YMin(f." + ident(GEOM) + "))", "max(ST_XMax(f." + ident(GEOM) + "))", "max(ST_YMax(f." + ident(GEOM) + "))"]
            if field:
                expression = "f." + ident(field)
                finite = "isfinite(TRY_CAST(" + expression + " AS DOUBLE))"
                if value.get("positiveOnly"):
                    finite += " AND " + expression + ">0"
                aggregations.extend(["count(*) FILTER (WHERE " + finite + ")", "min(" + expression + ") FILTER (WHERE " + finite + ")", "max(" + expression + ") FILTER (WHERE " + finite + ")", "avg(" + expression + ") FILTER (WHERE " + finite + ")", "sum(" + expression + ") FILTER (WHERE " + finite + ")"])
            result = c.execute("SELECT " + ",".join(aggregations) + " FROM native_result.features f WHERE " + where).fetchone()
            output = {"records": result[0], "sourceTotal": info["recordCount"], "field": field, "numericFields": numeric,
                      "extent": list(result[1:5]) if all(x is not None for x in result[1:5]) else None,
                      "coverage": self.get_job(job_id).get("coverage", {}), "execution": "native-full-result"}
            output["valueRule"] = "positive-finite-values" if value.get("positiveOnly") else "finite-values"
            if field:
                output.update(valid=result[5], missing=result[0] - result[5], min=result[6], max=result[7], mean=result[8], sum=result[9])
            else:
                output.update(valid=None, missing=None, min=None, max=None, mean=None, sum=None)
            return json_exact(output)

    def _selection_file(self, job_id, selection_id, info):
        if not isinstance(selection_id, str) or not re.fullmatch(r"[a-f0-9-]{36}", selection_id):
            raise ValueError("The native selection identity is invalid.")
        folder = self.workspace / "Cache" / "native-results" / job_id / "selections"
        path, receipt = folder / (selection_id + ".parquet"), folder / (selection_id + ".json")
        if not path.is_file() or not receipt.is_file():
            raise ValueError("This native selection is no longer available. Select the records again.")
        meta = json.loads(receipt.read_text(encoding="utf-8"))
        if meta.get("sourceSha256") != info["sourceSha256"] or meta.get("jobId") != job_id:
            raise ValueError("The native selection belongs to a different complete result.")
        stat = path.stat()
        if stat.st_size != meta.get("bytes") or stat.st_mtime_ns != meta.get("mtimeNs"):
            raise ValueError("The native selection cache changed. Select the records again before continuing.")
        return path, meta

    def _query_where(self, info, value, *, alias="f"):
        if not isinstance(value, dict) or set(value) - {"offset", "limit", "filters", "search", "sort", "selectionId", "highlightSelectionId"}:
            raise ValueError("Unsupported native query options.")
        fields = {field["name"]: field["type"] for field in info["columns"]}
        filters = value.get("filters", [])
        if not isinstance(filters, list) or len(filters) > 16:
            raise ValueError("Choose at most 16 native attribute conditions.")
        clauses, parameters = [], []
        for condition in filters:
            if not isinstance(condition, dict) or set(condition) - {"field", "op", "value"} or condition.get("field") not in fields:
                raise ValueError("Choose an original attribute field for the native condition.")
            field = alias + "." + ident(condition["field"])
            operation, item = condition.get("op"), condition.get("value")
            if operation in {"is-null", "not-null"}:
                clauses.append(field + (" IS NULL" if operation == "is-null" else " IS NOT NULL"))
            elif operation == "contains":
                if not isinstance(item, str) or len(item) > 2000:
                    raise ValueError("Native text conditions accept at most 2,000 characters.")
                clauses.append("contains(lower(CAST(" + field + " AS VARCHAR)),lower(?))")
                parameters.append(item)
            elif operation in {"eq", "ne", "gt", "gte", "lt", "lte"}:
                if item is None and operation in {"eq", "ne"}:
                    clauses.append(field + (" IS NULL" if operation == "eq" else " IS NOT NULL"))
                else:
                    if not isinstance(item, (str, int, float, bool)) or isinstance(item, str) and len(item) > 2000 or isinstance(item, float) and not math.isfinite(item):
                        raise ValueError("Native conditions need a scalar value; large identifiers should be decimal strings.")
                    clauses.append(field + {"eq": "=", "ne": "<>", "gt": ">", "gte": ">=", "lt": "<", "lte": "<="}[operation] + "?")
                    parameters.append(item)
            else:
                raise ValueError("Unsupported native attribute condition.")
        search = value.get("search", "")
        if not isinstance(search, str) or len(search) > 500:
            raise ValueError("Native search accepts at most 500 characters.")
        if search:
            clauses.append("(" + " OR ".join("contains(lower(CAST(" + alias + "." + ident(name) + " AS VARCHAR)),lower(?))" for name in fields) + ")" if fields else "false")
            parameters.extend([search] * len(fields))
        return " AND ".join(clauses) or "true", parameters

    def _selection_clause(self, job_id, selection_id, info, alias="f"):
        path, _ = self._selection_file(job_id, selection_id, info)
        return alias + "." + ident(info["rowColumn"]) + " IN (SELECT native_row FROM read_parquet(" + sqlstr(path) + "))"

    def result_query(self, job_id, value):
        with self._indexed_result(job_id) as (c, info):
            where, parameters = self._query_where(info, value)
            if value.get("selectionId"):
                where += " AND " + self._selection_clause(job_id, value["selectionId"], info)
            offset, limit = int(value.get("offset", 0)), int(value.get("limit", 100))
            if not 0 <= offset <= 2**53 - 1 or not 1 <= limit <= 1000:
                raise ValueError("Native tables accept a nonnegative offset and pages of 1–1,000 rows.")
            sort = value.get("sort") or {}
            if not isinstance(sort, dict) or set(sort) - {"field", "direction"}:
                raise ValueError("The native sort options are invalid.")
            direction = sort.get("direction", "asc")
            field = sort.get("field")
            if direction not in {"asc", "desc"} or field and field not in {column["name"] for column in info["columns"]}:
                raise ValueError("Choose an original attribute and asc/desc sort direction.")
            row = "f." + ident(info["rowColumn"])
            highlight = self._selection_clause(job_id, value.get("highlightSelectionId") or value["selectionId"], info) if value.get("highlightSelectionId") or value.get("selectionId") else "false"
            order = ("f." + ident(field) + " " + direction.upper() + " NULLS LAST," if field else "") + row
            total = c.execute("SELECT count(*) FROM native_result.features f WHERE " + where, parameters).fetchone()[0]
            fields = ["f." + ident(column["name"]) for column in info["columns"]]
            packed = "to_json(struct_pack(" + ",".join(ident(column["name"]) + ":=f." + ident(column["name"]) for column in info["columns"]) + "))" if fields else "'{}'"
            # The SQL guard does not transfer enormous source strings into Python.
            projection = [row, highlight] + ["CASE WHEN octet_length(encode(CAST(" + packed + " AS VARCHAR)))<=" + str(MAX_PAGE_BYTES) + " THEN " + name + " ELSE NULL END" for name in fields]
            projection.append("octet_length(encode(CAST(" + packed + " AS VARCHAR)))")
            c.execute("SELECT " + ",".join(projection) + " FROM native_result.features f WHERE " + where + " ORDER BY " + order + " LIMIT ? OFFSET ?", [*parameters, limit, offset])
            values, used = [], 4096 + len(json.dumps(info["columns"]).encode())
            while True:
                record = c.fetchone()
                if record is None:
                    break
                if record[-1] > MAX_PAGE_BYTES:
                    raise ValueError("A native attribute row exceeds 16 MiB. Export its original values instead.")
                properties = self._original_properties(info, record[2:-1])
                item = {"id": f"{job_id}:{record[0]}", "properties": properties, "selected": bool(record[1])}
                used += len(json.dumps(item, ensure_ascii=False, allow_nan=False).encode()) + 2
                if used > MAX_PAGE_BYTES:
                    raise ValueError("This native table page exceeds 16 MiB. Choose a smaller page or export the original file.")
                values.append(item)
            return {"columns": info["columns"], "rows": values, "total": total, "sourceTotal": info["recordCount"],
                    "offset": offset, "limit": limit, "maximumBytes": MAX_PAGE_BYTES,
                    "numericEncoding": "Large integer and decimal values use exact decimal strings; original file types are unchanged."}

    @staticmethod
    def _original_properties(info, values):
        return json_exact({column["name"]: json.loads(value) if column["type"] == "JSON" and value is not None else value
                           for column, value in zip(info["columns"], values)})

    def result_feature(self, job_id, row_id):
        if isinstance(row_id, str) and row_id.startswith(job_id + ":"):
            row_id = row_id[len(job_id) + 1:]
        if isinstance(row_id, bool) or not str(row_id).isdigit():
            raise ValueError("Choose a native feature row identity.")
        with self._indexed_result(job_id) as (c, info):
            row_id = int(row_id)
            if not 0 <= row_id < info["recordCount"]:
                raise KeyError("The native feature does not exist.")
            fields = [ident(column["name"]) for column in info["columns"]]
            names = {column["name"].lower() for column in info["columns"]}
            json_name, bytes_name = "__usbf_feature_json", "__usbf_feature_bytes"
            while json_name in names:
                json_name += "_"
            while bytes_name in names:
                bytes_name += "_"
            json_column, bytes_column = ident(json_name), ident(bytes_name)
            packed = "to_json(struct_pack(" + ",".join(ident(column["name"]) + ":=" + ident(column["name"]) for column in info["columns"]) + "))" if fields else "'{}'"
            query = "SELECT *,ST_AsGeoJSON(" + ident(GEOM) + ") AS " + json_column + " FROM native_result.features WHERE " + ident(info["rowColumn"]) + "=?"
            measured = "SELECT *,octet_length(encode(CAST(" + packed + " AS VARCHAR)))+coalesce(octet_length(encode(" + json_column + ")),4) AS " + bytes_column + " FROM (" + query + ")"
            projection = ["CASE WHEN " + bytes_column + "<=" + str(MAX_PAGE_BYTES) + " THEN " + field + " ELSE NULL END" for field in fields]
            projection.extend(["CASE WHEN " + bytes_column + "<=" + str(MAX_PAGE_BYTES) + " THEN " + json_column + " ELSE NULL END", bytes_column])
            record = c.execute("SELECT " + ",".join(projection) + " FROM (" + measured + ")", [row_id]).fetchone()
            if record[-1] > MAX_PAGE_BYTES:
                raise ValueError("This original feature exceeds 16 MiB. Export the complete result to inspect it without truncation.")
            return _bounded({"type": "Feature", "id": f"{job_id}:{row_id}",
                             "properties": self._original_properties(info, record[:-2]),
                             "geometry": json.loads(record[-2]) if record[-2] else None})

    def result_selection(self, job_id, value):
        if not isinstance(value, dict) or set(value) - {"mode", "baseSelectionId", "ids", "scope", "query"}:
            raise ValueError("Unsupported native selection options.")
        mode = value.get("mode", "replace")
        if mode not in {"replace", "add", "remove", "intersect", "invert", "clear"}:
            raise ValueError("Unsupported native selection mode.")
        if mode == "clear":
            return {"selectionId": None, "count": 0, "jobId": job_id, "bounds": None}
        with self._indexed_result(job_id) as (c, info):
            row = "f." + ident(info["rowColumn"])
            criterion = [key for key in ("ids", "scope", "query") if key in value]
            if mode != "invert" and len(criterion) != 1 or mode == "invert" and criterion:
                raise ValueError("Choose exactly one selection source: feature identities, boundary or attribute query.")
            parameters = []
            if mode == "invert":
                where = "true"
            elif "ids" in value:
                ids = value["ids"]
                if not isinstance(ids, list) or len(ids) > 10000:
                    raise ValueError("Choose at most 10,000 explicit native identities; use a boundary or query for bulk selection.")
                numbers = []
                for item in ids:
                    if not isinstance(item, str) or not item.startswith(job_id + ":") or not item[len(job_id) + 1:].isdigit():
                        raise ValueError("A selected feature belongs to another result.")
                    number = int(item[len(job_id) + 1:])
                    if not 0 <= number < info["recordCount"]:
                        raise ValueError("A selected native feature no longer exists.")
                    numbers.append(number)
                where = row + " IN (SELECT unnest(?::BIGINT[]))"
                parameters.append(numbers)
            elif "scope" in value:
                geometry = scope_geometry(value["scope"])
                if geometry is None:
                    raise ValueError("Native spatial selection needs a fixed Polygon or MultiPolygon boundary.")
                if not c.execute("SELECT ST_IsValid(ST_GeomFromGeoJSON(?))", [json.dumps(geometry)]).fetchone()[0]:
                    raise ValueError("The native selection boundary is invalid.")
                where = "ST_Intersects(f." + ident(GEOM) + ",ST_GeomFromGeoJSON(?))"
                parameters.append(json.dumps(geometry, allow_nan=False))
            else:
                where, parameters = self._query_where(info, value["query"])
                if value["query"].get("selectionId"):
                    where += " AND " + self._selection_clause(job_id, value["query"]["selectionId"], info)
            target = "SELECT " + row + " AS native_row FROM native_result.features f WHERE " + where
            base_id = value.get("baseSelectionId")
            if mode in {"add", "remove", "intersect", "invert"}:
                if base_id:
                    file, _ = self._selection_file(job_id, base_id, info)
                    base = "SELECT native_row FROM read_parquet(" + sqlstr(file) + ")"
                else:
                    base = "SELECT NULL::BIGINT AS native_row WHERE false"
                if mode == "add":
                    target = "(" + base + ") UNION (" + target + ")"
                elif mode == "remove":
                    target = "(" + base + ") EXCEPT (" + target + ")"
                elif mode == "intersect":
                    target = "(" + base + ") INTERSECT (" + target + ")"
                else:
                    target = "(" + target + ") EXCEPT (" + base + ")"
            selection_id = str(uuid.uuid4())
            folder = self.workspace / "Cache" / "native-results" / job_id / "selections"
            folder.mkdir(exist_ok=True)
            file = folder / (selection_id + ".parquet")
            temporary = Path(str(file) + ".writing")
            try:
                c.execute("COPY (SELECT DISTINCT native_row FROM (" + target + ") ORDER BY native_row) TO " + sqlstr(temporary) + " (FORMAT PARQUET,COMPRESSION ZSTD)", parameters)
                count = c.execute("SELECT count(*) FROM read_parquet(?)", [str(temporary)]).fetchone()[0]
                selected_bounds = c.execute("SELECT min(ST_XMin(" + ident(GEOM) + ")),min(ST_YMin(" + ident(GEOM) + ")),max(ST_XMax(" + ident(GEOM) + ")),max(ST_YMax(" + ident(GEOM) + ")) FROM native_result.features f WHERE " + row + " IN (SELECT native_row FROM read_parquet(?))", [str(temporary)]).fetchone()
                os.replace(temporary, file)
                receipt = {"jobId": job_id, "selectionId": selection_id, "count": count, "sourceSha256": info["sourceSha256"],
                           "bytes": file.stat().st_size, "mtimeNs": file.stat().st_mtime_ns, "sha256": self._hash_file(file),
                           "bounds": list(selected_bounds) if all(x is not None for x in selected_bounds) else None}
                _atomic_json(file.with_suffix(".json"), receipt)
                return {key: receipt[key] for key in ("jobId", "selectionId", "count", "bounds")}
            finally:
                temporary.unlink(missing_ok=True)

    def selection_input(self, source):
        job_id, selection_id = source.get("jobId"), source.get("selectionId")
        if not isinstance(job_id, str) or not re.fullmatch(r"[a-f0-9-]{36}", job_id):
            raise ValueError("Choose a complete native result for the selected input.")
        with self._indexed_result(job_id) as (c, info):
            file, selection = self._selection_file(job_id, selection_id, info)
            if self._hash_file(file) != selection.get("sha256"):
                raise ValueError("The native selection checksum changed. Select the records again before analysis.")
            target = file.with_name(selection_id + ".data.parquet")
            with _lock(target):
                if not target.exists():
                    fields = ",".join("f." + ident(column["name"]) for column in info["columns"])
                    query = "SELECT " + (fields + "," if fields else "") + "f." + ident(GEOM) + " FROM native_result.features f WHERE " + self._selection_clause(job_id, selection_id, info) + " ORDER BY f." + ident(info["rowColumn"])
                    temporary = Path(str(target) + ".writing")
                    try:
                        c.execute("COPY (" + query + ") TO " + sqlstr(temporary) + " (FORMAT PARQUET,COMPRESSION ZSTD)")
                        os.replace(temporary, target)
                    finally:
                        temporary.unlink(missing_ok=True)
                checksum = self._hash_file(target)
            return {"kind": "file", "path": target.relative_to(self.workspace).as_posix(), "format": "geoparquet",
                    "sha256": checksum, "rows": selection["count"], "crs": "EPSG:4326"}

    def result_tile(self, job_id, z, x, y, selection_id=None):
        z, x, y = int(z), int(x), int(y)
        if not 0 <= z <= 22 or not 0 <= x < 2**z or not 0 <= y < 2**z:
            raise ValueError("Native map tile coordinates are invalid.")
        _, cached_info = self._result_index(job_id)
        if selection_id:
            self._selection_file(job_id, selection_id, cached_info)
        folder = self.workspace / "Cache" / "native-results" / job_id / "tiles"
        folder.mkdir(exist_ok=True)
        key = hashlib.sha256(("style-v2/" + str(z) + "/" + str(x) + "/" + str(y) + "/" + (selection_id or "all")).encode()).hexdigest()
        cached = folder / (key + ".pbf")
        if cached.is_file() and cached.stat().st_size <= MAX_TILE_BYTES:
            return cached.read_bytes()
        def save(data):
            temporary = folder / (key + "." + str(uuid.uuid4()) + ".writing")
            try:
                temporary.write_bytes(data)
                os.replace(temporary, cached)
            finally:
                temporary.unlink(missing_ok=True)
            return data
        with self._indexed_result(job_id) as (c, info):
            row, geom = "f." + ident(info["rowColumn"]), "f." + ident(info["mapColumn"])
            envelope = "ST_TileEnvelope(" + str(z) + "," + str(x) + "," + str(y) + ")"
            selection = self._selection_clause(job_id, selection_id, info) if selection_id else "false"
            # RTree pruning happens in the WHERE, before clipping/generalization.
            where = "ST_Intersects(" + geom + "," + envelope + ")"
            count = c.execute("SELECT count(*) FROM native_result.features f WHERE " + where).fetchone()[0]
            if not count:
                return save(b"")
            dense = z < DETAIL_MIN_ZOOM or count > 20000
            if not dense:
                # Materialize the RTree-pruned candidates before clipping. Without
                # this boundary DuckDB can merge the clipping predicates into the
                # spatial filter and replace the index scan with a full scan.
                display, display_names = [], []
                for column in self._display_fields(info):
                    name = ident(column["name"])
                    field = "f." + name
                    if column["type"] == "VARCHAR":
                        expression = "CASE WHEN length(" + field + ")<=128 THEN " + field + " ELSE NULL END"
                    elif column["type"] == "BOOLEAN":
                        expression = field
                    else:
                        number = "TRY_CAST(" + field + " AS DOUBLE)"
                        expression = "CASE WHEN isfinite(" + number + ") AND abs(" + number + ")<=9007199254740991 THEN " + number + " ELSE NULL END"
                    display.append(expression + " AS " + name)
                    display_names.append(name)
                extras = ("," + ",".join(display)) if display else ""
                candidates = "SELECT " + row + " AS row_id," + selection + " AS selected," + geom + " AS map_geometry" + extras + " FROM native_result.features f WHERE " + where
                extras = ("," + ",".join(display_names)) if display_names else ""
                query = "WITH candidates AS MATERIALIZED (" + candidates + ") SELECT ST_AsMVT(t,'buildings',4096,'geometry','row_id') FROM (SELECT row_id," + sqlstr(job_id + ":") + "||CAST(row_id AS VARCHAR) AS nativeId,selected" + extras + ",ST_AsMVTGeom(map_geometry,ST_Extent(" + envelope + "),4096,64,true) AS geometry FROM candidates) t WHERE geometry IS NOT NULL AND NOT ST_IsEmpty(geometry)"
                tile = c.execute(query).fetchone()[0] or b""
                if len(tile) <= MAX_TILE_BYTES:
                    return save(tile)
            # Every intersecting record contributes to one cell, including long
            # polygons with centroids outside the viewport. No LIMIT/sampling.
            extent = c.execute("SELECT ST_XMin(" + envelope + "),ST_YMin(" + envelope + "),ST_XMax(" + envelope + "),ST_YMax(" + envelope + ")").fetchone()
            width = (extent[2] - extent[0]) / 16
            px = "least(15,greatest(0,floor((ST_X(ST_Centroid(" + geom + "))-(" + repr(extent[0]) + "))/" + repr(width) + ")))::INTEGER"
            py = "least(15,greatest(0,floor((ST_Y(ST_Centroid(" + geom + "))-(" + repr(extent[1]) + "))/" + repr(width) + ")))::INTEGER"
            group = "SELECT " + px + " AS gx," + py + " AS gy,count(*)::BIGINT AS count,count(*) FILTER (WHERE " + selection + ")::BIGINT AS selectedCount FROM native_result.features f WHERE " + where + " GROUP BY gx,gy"
            geometry = "ST_Point(" + repr(extent[0]) + "::DOUBLE+(gx+0.5)*" + repr(width) + "::DOUBLE," + repr(extent[1]) + "::DOUBLE+(gy+0.5)*" + repr(width) + "::DOUBLE)"
            return save(c.execute("SELECT ST_AsMVT(t,'clusters',4096,'geometry','cell_id') FROM (SELECT (gy*16+gx)::BIGINT AS cell_id,count,selectedCount,ST_AsMVTGeom(" + geometry + ",ST_Extent(" + envelope + "),4096,0,true) AS geometry FROM (" + group + ")) t").fetchone()[0] or b"")

    def result_export(self, job_id, format="geojson", selection_id=None):
        if format not in {"geojson", "csv", "parquet"}:
            raise ValueError("Choose GeoJSON, CSV or GeoParquet for full native export.")
        with self._indexed_result(job_id) as (c, info):
            where = self._selection_clause(job_id, selection_id, info) if selection_id else "true"
            folder = self.workspace / "Cache" / "native-exports"
            folder.mkdir(exist_ok=True)
            suffix = hashlib.sha256((info["sourceSha256"] + (selection_id or "all") + format).encode()).hexdigest()[:24]
            target = folder / ("USBF-" + suffix + "." + format)
            with _lock(target):
                if target.exists():
                    return target
                temporary = Path(str(target) + ".writing")
                fields = ["f." + ident(column["name"]) for column in info["columns"]]
                row = "f." + ident(info["rowColumn"])
                try:
                    if format == "parquet":
                        c.execute("COPY (SELECT " + ",".join([*fields, "f." + ident(GEOM)]) + " FROM native_result.features f WHERE " + where + " ORDER BY " + row + ") TO " + sqlstr(temporary) + " (FORMAT PARQUET,COMPRESSION ZSTD)")
                    else:
                        projection = [row, *fields, "ST_AsGeoJSON(f." + ident(GEOM) + ")"]
                        c.execute("SELECT " + ",".join(projection) + " FROM native_result.features f WHERE " + where + " ORDER BY " + row)
                        with temporary.open("w", encoding="utf-8", newline="") as output:
                            writer = csv.writer(output) if format == "csv" else None
                            if writer:
                                writer.writerow([column["name"] for column in info["columns"]] + ["geometry"])
                            else:
                                output.write('{"type":"FeatureCollection","features":[')
                            first = True
                            while True:
                                record = c.fetchone()
                                if record is None:
                                    break
                                props = self._original_properties(info, record[1:-1])
                                if writer:
                                    writer.writerow([json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list, bool)) else value for value in props.values()] + [record[-1] or ""])
                                else:
                                    if not first:
                                        output.write(",")
                                    output.write(json.dumps({"type": "Feature", "id": f"{job_id}:{record[0]}", "properties": props,
                                                             "geometry": json.loads(record[-1]) if record[-1] else None}, ensure_ascii=False, allow_nan=False))
                                    first = False
                            if not writer:
                                output.write("]}")
                    os.replace(temporary, target)
                finally:
                    temporary.unlink(missing_ok=True)
                return target
