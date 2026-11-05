"""Durable, complete-original footprint correspondence reports.

Correspondences are a graph, never a forced assignment. Compatible OSM
provenance and every qualifying exact overlap are retained, including splits,
merges, duplicate provenance, invalid outlines and unmatched original records.
"""
from __future__ import annotations

import csv
import json
import math
import os
from pathlib import Path
import re
import threading
import uuid
from datetime import datetime, timezone

from .results import GEOM, MAX_PAGE_BYTES, _atomic_json, _bounded
from .runtime import ident, sqlstr
from .validation import clone, digest_json, json_exact, scope_geometry, workspace_path

MAX_CANDIDATES = 2_000_000
PAGE_MAX = 500
MAX_IDENTITY_BYTES = 256 * 1024
CATEGORIES = ("one-to-one", "one-to-many", "many-to-one", "ambiguous", "unmatched-left", "unmatched-right", "invalid-left", "invalid-right")
IDENTITY_FIELDS = {"id", "type", "@id", "osm_id", "osm_type", "osmid", "osmtype", "sources", "source", "original_id", "originalid", "record_id"}


def _stamp():
    return datetime.now(timezone.utc).isoformat()


def _decoded(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            pass
    return value


def _osm(value, kind=None, *, versioned=False):
    """A namespace is required: bare IDs from unrelated datasets never agree."""
    if value is None or isinstance(value, (bool, float, dict, list)):
        return None
    text = str(value).strip()
    # Overture retains the OSM object version as w67521490@4. Versions
    # describe snapshots of the same OSM object; keep the raw value in reports.
    if versioned and re.fullmatch(r".+@[0-9]+", text):
        text = text.rsplit("@", 1)[0]
    kind = str(kind or "").lower()
    kind = {"w": "way", "r": "relation", "n": "node"}.get(kind, kind)
    if kind in {"way", "relation", "node"} and re.fullmatch(r"[0-9]+", text):
        return "osm:" + kind + ":" + (text.lstrip("0") or "0")
    match = re.fullmatch(r"(?:https?://(?:www\.)?openstreetmap\.org/)?(way|relation|node)[/:]([0-9]+)", text, re.I)
    if not match:
        match = re.fullmatch(r"([wrn])([0-9]+)", text, re.I)
    if match:
        return _osm(match[2], match[1])
    return None


def source_identity(properties, namespace=None):
    """Return exact original identity fields plus defensible cross-source keys.

    Overture's ``sources`` is accepted only for an explicit OpenStreetMap
    dataset. Its opaque record_id is not compared to another dataset's id.
    """
    values = dict(properties)
    lower = {key.lower(): value for key, value in values.items()}
    keys = set()
    kind = lower.get("osm_type", lower.get("osmtype"))
    for name in ("osm_id", "osmid"):
        key = _osm(lower.get(name), kind)
        if key:
            keys.add(key)
    # Layercake's published OSM schema uses ordinary `type` + `id`.
    # These fields mean OSM identity only when the input's provenance does.
    if namespace == "osm":
        key = _osm(lower.get("id"), lower.get("type"))
        if key:
            keys.add(key)
    # An explicit namespace-bearing @id (or top-level Feature.id) is sufficient.
    for name, value in values.items():
        if name.lower() == "@id" or name.startswith("_usbf_source_feature_id"):
            key = _osm(value)
            if key:
                keys.add(key)
    sources = _decoded(lower.get("sources"))
    if isinstance(sources, list):
        for source in sources:
            if not isinstance(source, dict):
                continue
            dataset = re.sub(r"[^a-z]", "", str(source.get("dataset", "")).lower())
            if dataset not in {"openstreetmap", "osm"}:
                continue
            key = _osm(source.get("record_id"), source.get("osm_type"), versioned=True)
            if key:
                keys.add(key)
    return json_exact(values), sorted(keys)


def identity_namespace(job):
    parts = job.get("parts") or []
    if parts and all(part.get("providerId") == "osm-buildings" for part in parts):
        return "osm"
    release = job.get("release")
    if isinstance(release, dict) and release.get("providerId") == "osm-buildings":
        return "osm"
    return None


class MatchingMixin:
    def create_matching_job(self, value):
        if not isinstance(value, dict) or set(value) - {"left", "right", "recordMode", "studyArea", "thresholds", "inputContract", "name"}:
            raise ValueError("Unsupported building correspondence options.")
        mode = value.get("recordMode", "area")
        if mode not in {"all", "selection", "area"}:
            raise ValueError("Choose all, selected or saved-area records.")
        area = value.get("studyArea")
        boundary = scope_geometry(area)
        if boundary is None:
            raise ValueError("Building correspondence requires one saved study area for both inputs.")
        thresholds = value.get("thresholds", {})
        if not isinstance(thresholds, dict) or set(thresholds) - {"iou", "coverage"}:
            raise ValueError("Choose explicit IoU and coverage thresholds.")
        thresholds = {"iou": thresholds.get("iou", .5), "coverage": thresholds.get("coverage", .8)}
        if any(isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or not 0 < n <= 1 for n in thresholds.values()):
            raise ValueError("IoU and coverage thresholds must be greater than zero and at most one.")
        sources = []
        for side in ("left", "right"):
            source = value.get(side)
            if not isinstance(source, dict) or set(source) - {"jobId", "selectionId", "name"}:
                raise ValueError("Choose two complete original native results.")
            job = self.get_job(source.get("jobId"))
            if job.get("operation") in {"buffer", "building-match"}:
                raise ValueError("Choose original polygon worksets for building correspondence.")
            _, info = self._result_index(job["id"])
            contract = job.get("inputContract") or {}
            # Common workset contracts may wrap an original source contract.
            loading = contract.get("loadingArea") or (contract.get("sourceInputContract") or {}).get("loadingArea") or job.get("scope")
            loading_geometry = loading.get("geometry") if isinstance(loading, dict) else None
            if mode != "area" and loading_geometry != boundary:
                raise ValueError("All or selected records require worksets loaded for this same saved area.")
            if mode == "selection" and not source.get("selectionId"):
                raise ValueError("Selected correspondence inputs require immutable native selections.")
            frozen = {"jobId": job["id"], "name": str(source.get("name") or job["name"]), "sha256": info["sourceSha256"],
                      "sourceTotal": info["recordCount"], "result": clone(job["result"]), "release": clone(job.get("release")),
                      "inputContract": clone(contract), "selectionId": source.get("selectionId"), "identityNamespace": identity_namespace(job)}
            if source.get("selectionId"):
                path, selection = self._selection_file(job["id"], source["selectionId"], info)
                if self._hash_file(path) != selection["sha256"]:
                    raise ValueError("The native selection checksum changed. Select the records again.")
                frozen["selectionSha256"] = selection["sha256"]
            sources.append(frozen)
        if sources[0]["jobId"] == sources[1]["jobId"] and sources[0]["selectionId"] == sources[1]["selectionId"]:
            raise ValueError("Choose two different original polygon worksets.")
        if self._active_count() >= 64:
            raise ValueError("Finish or cancel native tasks before queuing more than 64 jobs.")
        job_id, stamp = str(uuid.uuid4()), _stamp()
        (self.workspace / "Cache" / "native-jobs" / job_id).mkdir(parents=True)
        job = {"id": job_id, "name": str(value.get("name") or "Building correspondence")[:120], "operation": "building-match",
               "status": "queued", "phase": "waiting", "createdAt": stamp, "updatedAt": stamp, "scope": clone(area),
               "release": None, "inputContract": clone(value.get("inputContract")), "parameters": {"recordMode": mode, "thresholds": thresholds, "sources": sources},
               "requestHash": digest_json(value), "parts": [], "progress": {"completedParts": 0, "plannedParts": 2, "failedParts": 0, "actualRows": 0},
               "estimatedBytes": sum(s["result"]["bytes"] for s in sources), "estimatedRows": sum(s["sourceTotal"] for s in sources), "result": None, "error": None,
               "coverage": {"requestComplete": False, "providerCoverage": "source-defined", "missingParts": []},
               "capabilities": {"cancel": True, "resume": True, "preview": False, "table": False, "matchingReport": True}}
        self._save(job)
        self.wake.set()
        return job

    def _match_inputs(self, job, *, selections=False):
        for source in job["parameters"]["sources"]:
            database, info = self._result_index(source["jobId"])
            if info["sourceSha256"] != source["sha256"]:
                raise ValueError("A comparison input changed. Run the comparison again.")
            if selections and source.get("selectionId"):
                path, _ = self._selection_file(source["jobId"], source["selectionId"], info)
                if self._hash_file(path) != source["selectionSha256"]:
                    raise ValueError("A comparison input selection changed. Run the comparison again.")
            yield source, database, info

    def _recover_matching_report(self, job, target, metadata):
        if not target.exists() and not metadata.exists():
            return None
        if not target.is_file() or not metadata.is_file():
            raise ValueError("An unfamiliar existing building correspondence output was kept. It cannot resume this task.")
        try:
            receipt = json.loads(metadata.read_text(encoding="utf-8"))
        except (ValueError, OSError) as error:
            raise ValueError("An unfamiliar building correspondence receipt was kept. It cannot resume this task.") from error
        parameters = job["parameters"]
        result = receipt.get("result") if isinstance(receipt, dict) else None
        if (not isinstance(result, dict) or receipt.get("jobId") != job["id"]
                or receipt.get("requestHash") != job["requestHash"] or receipt.get("complete") is not True
                or receipt.get("sources") != parameters["sources"] or receipt.get("studyArea") != job["scope"]
                or receipt.get("recordMode") != parameters["recordMode"] or receipt.get("thresholds") != parameters["thresholds"]
                or result.get("path") != target.relative_to(self.workspace).as_posix()
                or result.get("metadataPath") != metadata.relative_to(self.workspace).as_posix()
                or result.get("format") != "BuildingMatchReport" or result.get("summary") != receipt.get("summary")):
            raise ValueError("An unfamiliar building correspondence receipt was kept. It cannot resume this task.")
        if self._hash_file(target, job["id"]) != result.get("sha256"):
            raise ValueError("The existing building correspondence output changed. The file and receipt were kept.")
        with self.runtime.connection() as c:
            self.active_connection = c
            try:
                c.execute("ATTACH " + sqlstr(target) + " AS recovered_report (READ_ONLY)")
                count = c.execute("SELECT count(*) FROM recovered_report.pairs").fetchone()[0]
            finally:
                self.active_connection = None
        if count != result.get("rows") or count != receipt.get("summary", {}).get("pairRows"):
            raise ValueError("The recovered correspondence row count differs from its receipt. Existing files were kept.")
        return {**result, "bytes": target.stat().st_size, "mtimeNs": target.stat().st_mtime_ns, "recovered": True}

    @staticmethod
    def _matching_output_available(target, metadata):
        if target.exists() or metadata.exists():
            raise ValueError("An existing building correspondence output or receipt was kept. It cannot be overwritten.")

    def _execute_matching(self, job):
        # Import lazily to avoid the Engine -> MatchingMixin dependency cycle.
        from .engine import Cancelled
        connection, temporary = None, None
        self.active_job_id = job["id"]
        job.update(status="running", phase="reading-originals", error=None, result=None)
        self._save(job)
        try:
            self._check(job["id"])
            prefix = "Results/building-matches/" + job["id"] + "/"
            target = workspace_path(self.workspace, prefix + "report.duckdb", roots=("Results",), exists=False)
            folder = target.parent
            folder.mkdir(parents=True, exist_ok=True)
            metadata = workspace_path(self.workspace, prefix + "report.json", roots=("Results",), exists=False)
            list(self._match_inputs(job))
            recovered = self._recover_matching_report(job, target, metadata)
            if recovered:
                job.update(status="completed", phase="finished", result=recovered, error=None)
                job["progress"].update(completedParts=2, actualRows=recovered["summary"]["leftRecords"] + recovered["summary"]["rightRecords"])
                job["coverage"]["requestComplete"] = True
                job["capabilities"].update(cancel=False, resume=False)
                return
            temporary = workspace_path(self.workspace, prefix + "report.writing.duckdb", roots=("Results",), exists=False)
            temporary.unlink(missing_ok=True)
            Path(str(temporary) + ".wal").unlink(missing_ok=True)
            inputs = list(self._match_inputs(job, selections=True))
            connection = self.runtime.connection()
            self.active_connection = connection
            c = connection
            if not c.execute("SELECT ST_IsValid(ST_GeomFromGeoJSON(?))", [json.dumps(job["scope"]["geometry"])]).fetchone()[0]:
                raise ValueError("The saved study area geometry is invalid.")
            c.execute("ATTACH " + sqlstr(temporary) + " AS report")
            counts = []
            for position, (source, database, info) in enumerate(inputs):
                self._check(job["id"])
                alias, side = "original_" + str(position), ("left", "right")[position]
                c.execute("ATTACH " + sqlstr(database) + " AS " + alias + " (READ_ONLY)")
                where = self._selection_clause(source["jobId"], source["selectionId"], info) if source.get("selectionId") else "true"
                if job["parameters"]["recordMode"] == "area":
                    where += " AND ST_Intersects(f." + ident(GEOM) + ",ST_GeomFromGeoJSON(" + sqlstr(json.dumps(job["scope"]["geometry"])) + "))"
                polygon = "ST_GeometryType(f." + ident(GEOM) + ") IN ('POLYGON','MULTIPOLYGON')"
                valid = "coalesce(" + polygon + " AND ST_IsValid(f." + ident(GEOM) + ") AND NOT ST_IsEmpty(f." + ident(GEOM) + "),false)"
                c.execute("CREATE TABLE report." + side + "_records AS SELECT f." + ident(info["rowColumn"]) + " AS native_row," + valid
                          + " AS valid,CASE WHEN " + valid + " THEN ST_Transform(ST_Force2D(f." + ident(GEOM) + "),'EPSG:4326','EPSG:6933',always_xy:=true) END AS geometry, '{}'::VARCHAR AS source_ids FROM " + alias + ".features f WHERE " + where)
                c.execute("ALTER TABLE report." + side + "_records ADD COLUMN area DOUBLE")
                c.execute("UPDATE report." + side + "_records SET area=CASE WHEN valid THEN ST_Area(geometry) ELSE 0 END")
                c.execute("UPDATE report." + side + "_records SET valid=valid AND isfinite(area) AND area>0")
                c.execute("CREATE INDEX " + side + "_geometry ON report." + side + "_records USING RTREE(geometry)")
                c.execute("CREATE UNIQUE INDEX " + side + "_row ON report." + side + "_records(native_row)")
                c.execute("CREATE TABLE report." + side + "_keys(native_row BIGINT, key VARCHAR)")
                # Only identity/provenance fields cross this bounded Python loop.
                fields = [column["name"] for column in info["columns"] if column["name"].lower() in IDENTITY_FIELDS or column["name"].startswith("_usbf_source_feature_id")]
                last = -1
                while fields:
                    self._check(job["id"])
                    packed = "to_json(struct_pack(" + ",".join(ident(name) + ":=f." + ident(name) for name in fields) + "))"
                    # Cap both individual identities and each Python fetch. Full
                    # original attributes remain available through native export.
                    query = "SELECT native_row,CASE WHEN identity_bytes<=" + str(MAX_IDENTITY_BYTES) + " THEN identity_json ELSE NULL END,identity_bytes FROM (SELECT r.native_row," + packed + " AS identity_json,octet_length(encode(CAST(" + packed + " AS VARCHAR))) AS identity_bytes FROM report." + side + "_records r JOIN " + alias + ".features f ON r.native_row=f." + ident(info["rowColumn"]) + " WHERE r.native_row>? ORDER BY r.native_row LIMIT 64)"
                    rows = c.execute(query, [last]).fetchall()
                    if not rows:
                        break
                    identities, keys = [], []
                    for row in rows:
                        if row[2] > MAX_IDENTITY_BYTES:
                            raise ValueError("One original identity or provenance value exceeds the 256 KiB report budget. Inspect it through full original export.")
                        values, compatible = source_identity(json.loads(row[1]), source.get("identityNamespace"))
                        identities.append((json.dumps(values, ensure_ascii=False, allow_nan=False), row[0]))
                        keys.extend((row[0], key) for key in compatible)
                    c.executemany("UPDATE report." + side + "_records SET source_ids=? WHERE native_row=?", identities)
                    if keys:
                        c.executemany("INSERT INTO report." + side + "_keys VALUES (?,?)", keys)
                    last = rows[-1][0]
                counts.append(c.execute("SELECT count(*) FROM report." + side + "_records").fetchone()[0])
                job["progress"].update(completedParts=position + 1, actualRows=sum(counts))
                self._save(job)
            job.update(phase="matching-candidates")
            self._save(job)
            c.execute("CREATE TABLE report.candidates(left_row BIGINT,right_row BIGINT,provenance BOOLEAN)")
            # Compatible provenance is independent of spatial overlap; changed
            # outlines may be far apart. Duplicate provenance stays ambiguous.
            c.execute("INSERT INTO report.candidates SELECT DISTINCT l.native_row,r.native_row,true FROM report.left_keys l JOIN report.right_keys r USING(key) LIMIT " + str(MAX_CANDIDATES + 1))
            self._match_candidate_budget(c)
            # A spatial join uses bounding boxes internally. Materialized RTree
            # indexes and bounded left batches prevent a browser-style N x M scan.
            last = -1
            while True:
                self._check(job["id"])
                rows = c.execute("SELECT native_row FROM report.left_records WHERE native_row>? ORDER BY native_row LIMIT 256", [last]).fetchall()
                if not rows:
                    break
                high = rows[-1][0]
                remaining = MAX_CANDIDATES + 1 - c.execute("SELECT count(*) FROM report.candidates").fetchone()[0]
                c.execute("INSERT INTO report.candidates SELECT l.native_row,r.native_row,false FROM report.left_records l JOIN report.right_records r ON ST_Intersects(l.geometry,r.geometry) WHERE l.native_row>? AND l.native_row<=? AND l.valid AND r.valid LIMIT " + str(remaining), [last, high])
                self._match_candidate_budget(c)
                last = high
            self._check(job["id"])
            job.update(phase="exact-overlap")
            self._save(job)
            c.execute("CREATE TABLE report.metrics AS WITH pairs AS (SELECT left_row,right_row,bool_or(provenance) AS provenance FROM report.candidates GROUP BY left_row,right_row), measured AS (SELECT p.*,l.area AS left_area,r.area AS right_area,CASE WHEN l.valid AND r.valid THEN ST_Area(ST_Intersection(l.geometry,r.geometry)) END AS intersection_area FROM pairs p JOIN report.left_records l ON l.native_row=p.left_row JOIN report.right_records r ON r.native_row=p.right_row) SELECT *,intersection_area/nullif(left_area+right_area-intersection_area,0) AS iou,intersection_area/nullif(left_area,0) AS left_coverage,intersection_area/nullif(right_area,0) AS right_coverage FROM measured")
            iou, coverage = job["parameters"]["thresholds"]["iou"], job["parameters"]["thresholds"]["coverage"]
            c.execute("CREATE TABLE report.edges AS SELECT * FROM report.metrics WHERE provenance OR (intersection_area>0 AND (iou>=? OR greatest(left_coverage,right_coverage)>=?))", [iou, coverage])
            self._check(job["id"])
            c.execute("CREATE TABLE report.pairs AS WITH degrees AS (SELECT *,count(*) OVER(PARTITION BY left_row) AS left_degree,count(*) OVER(PARTITION BY right_row) AS right_degree FROM report.edges), identity_degrees AS (SELECT *,count(*) FILTER(WHERE provenance) OVER(PARTITION BY left_row) AS left_id_degree,count(*) FILTER(WHERE provenance) OVER(PARTITION BY right_row) AS right_id_degree FROM degrees) SELECT (row_number() OVER(ORDER BY NOT provenance,left_row,right_row)-1)::BIGINT AS pair_id,left_row,right_row,CASE WHEN left_id_degree>1 OR right_id_degree>1 OR (left_degree>1 AND right_degree>1) THEN 'ambiguous' WHEN left_degree>1 THEN 'one-to-many' WHEN right_degree>1 THEN 'many-to-one' ELSE 'one-to-one' END AS category,CASE WHEN left_degree>1 AND right_degree>1 THEN 'many-to-many' WHEN left_degree>1 THEN 'one-to-many' WHEN right_degree>1 THEN 'many-to-one' ELSE 'one-to-one' END AS relation,CASE WHEN provenance THEN 'compatible-provenance' ELSE 'spatial-overlap' END AS basis,provenance,left_degree,right_degree,left_area,right_area,intersection_area,iou,left_coverage,right_coverage FROM identity_degrees")
            next_id = c.execute("SELECT count(*) FROM report.pairs").fetchone()[0]
            for side in ("left", "right"):
                column = side + "_row"
                c.execute("INSERT INTO report.pairs SELECT ?+(row_number() OVER(ORDER BY r.native_row)-1)," + ("r.native_row,NULL" if side == "left" else "NULL,r.native_row") + ",CASE WHEN r.valid THEN 'unmatched-" + side + "' ELSE 'invalid-" + side + "' END,NULL,NULL,false,0,0," + ("r.area,NULL" if side == "left" else "NULL,r.area") + ",NULL,NULL,NULL,NULL FROM report." + side + "_records r WHERE NOT EXISTS(SELECT 1 FROM report.edges e WHERE e." + column + "=r.native_row)", [next_id])
                next_id = c.execute("SELECT count(*) FROM report.pairs").fetchone()[0]
            categories = dict(c.execute("SELECT category,count(*) FROM report.pairs GROUP BY category").fetchall())
            summary = {"leftRecords": counts[0], "rightRecords": counts[1], "pairRows": next_id, "categories": {key: categories.get(key, 0) for key in CATEGORIES},
                       "matchedLeft": c.execute("SELECT count(DISTINCT left_row) FROM report.edges").fetchone()[0], "matchedRight": c.execute("SELECT count(DISTINCT right_row) FROM report.edges").fetchone()[0],
                       "candidatePairs": c.execute("SELECT count(*) FROM report.metrics").fetchone()[0]}
            # Intermediate geometry is disposable; original attributes remain in
            # their checksummed result files. Keep scoped row sets for reports.
            for side in ("left", "right"):
                c.execute("DROP INDEX report." + side + "_geometry")
                c.execute("DROP INDEX report." + side + "_row")
                c.execute("ALTER TABLE report." + side + "_records DROP COLUMN geometry")
                c.execute("DROP TABLE report." + side + "_keys")
            for table in ("candidates", "metrics", "edges"):
                c.execute("DROP TABLE report." + table)
            self._check(job["id"])
            # A source replaced while the graph was computing cannot silently
            # acquire a report for another generation of the original data.
            list(self._match_inputs(job, selections=True))
            c.execute("DETACH report")
            c.close()
            connection = None
            self.active_connection = None
            output_hash = self._hash_file(temporary, job["id"])
            # A result or receipt created during the computation still belongs
            # to its owner. Retry never replaces unfamiliar published bytes.
            self._matching_output_available(target, metadata)
            os.replace(temporary, target)
            result = {"path": target.relative_to(self.workspace).as_posix(), "metadataPath": metadata.relative_to(self.workspace).as_posix(), "format": "BuildingMatchReport", "rows": next_id,
                      "bytes": target.stat().st_size, "mtimeNs": target.stat().st_mtime_ns, "sha256": output_hash, "summary": summary}
            receipt = {"version": 1, "jobId": job["id"], "requestHash": job["requestHash"], "complete": True, "createdAt": _stamp(), "recordMode": job["parameters"]["recordMode"], "summary": summary, "thresholds": job["parameters"]["thresholds"], "studyArea": job["scope"], "sources": job["parameters"]["sources"],
                       "measurement": "Exact polygon intersections in EPSG:6933 equal-area projection, square metres", "candidateRule": "Bounding-box spatial join and compatible OSM provenance; exact positive intersection then IoU OR either-side coverage threshold.",
                       "identityRule": "Only explicit compatible OSM type + ID or namespaced OSM provenance; unrelated dataset IDs are never equated.", "interpretation": "Correspondence candidates retain splits, merges and ambiguities. Agreement is not independent validation or an accuracy score.", "inputContract": job.get("inputContract"), "result": result}
            if metadata.exists():
                raise ValueError("An existing building correspondence receipt was kept. It cannot be overwritten.")
            _atomic_json(metadata, receipt)
            job.update(status="completed", phase="finished", result=result, error=None)
            job["coverage"]["requestComplete"] = True
            job["capabilities"].update(cancel=False, resume=False)
        except Exception as error:
            cancelled = isinstance(error, Cancelled) or self.stop.is_set() or self.cancel_flags.setdefault(job["id"], threading.Event()).is_set()
            job.update(status=("interrupted" if self.stop.is_set() else "cancelled") if cancelled else "failed", phase="stopped" if cancelled else "failed", error=str(error)[:1000])
        finally:
            self.active_connection = None
            self.active_job_id = None
            if connection:
                connection.close()
            if temporary:
                temporary.unlink(missing_ok=True)
                Path(str(temporary) + ".wal").unlink(missing_ok=True)
            self._save(job)

    @staticmethod
    def _match_candidate_budget(connection):
        if connection.execute("SELECT count(*) FROM report.candidates").fetchone()[0] > MAX_CANDIDATES:
            raise ValueError("Building correspondence exceeds the 2,000,000 candidate budget. Use a smaller saved study area or explicit selections.")

    def _matching_report(self, job_id):
        job = self.get_job(job_id)
        if job.get("operation") != "building-match" or job["status"] != "completed" or not job.get("result"):
            raise ValueError("This task has no complete building correspondence report yet.")
        list(self._match_inputs(job))
        result = job["result"]
        path = workspace_path(self.workspace, result["path"], roots=("Results",))
        if path.stat().st_size != result["bytes"] or path.stat().st_mtime_ns != result["mtimeNs"]:
            raise ValueError("The building correspondence report changed. Run the comparison again.")
        receipt = json.loads(workspace_path(self.workspace, result["metadataPath"], roots=("Results",)).read_text(encoding="utf-8"))
        return job, path, receipt

    @staticmethod
    def _matching_where(value):
        clauses, parameters = [], []
        if value.get("category"):
            if value["category"] not in CATEGORIES:
                raise ValueError("Choose a building correspondence category.")
            clauses.append("p.category=?")
            parameters.append(value["category"])
        if "pairIds" in value:
            ids = value["pairIds"]
            if not isinstance(ids, list) or len(ids) > 10000 or any(isinstance(i, bool) or not isinstance(i, int) or i < 0 for i in ids):
                raise ValueError("Choose at most 10,000 report pair identities.")
            clauses.append("p.pair_id IN (SELECT unnest(?::BIGINT[]))")
            parameters.append(ids)
        return " AND ".join(clauses) or "true", parameters

    def matching_page(self, job_id, value):
        if not isinstance(value, dict) or set(value) - {"offset", "limit", "category"}:
            raise ValueError("Unsupported building correspondence page options.")
        offset, limit = value.get("offset", 0), value.get("limit", 100)
        if any(isinstance(n, bool) or not isinstance(n, int) for n in (offset, limit)) or offset < 0 or not 1 <= limit <= PAGE_MAX:
            raise ValueError("Choose a nonnegative report offset and a page size from 1 to 500.")
        job, path, receipt = self._matching_report(job_id)
        where, parameters = self._matching_where(value)
        with self.runtime.connection() as c:
            c.execute("ATTACH " + sqlstr(path) + " AS report (READ_ONLY)")
            total = c.execute("SELECT count(*) FROM report.pairs p WHERE " + where, parameters).fetchone()[0]
            query = "SELECT p.*,l.source_ids AS left_source_ids,r.source_ids AS right_source_ids FROM report.pairs p LEFT JOIN report.left_records l ON l.native_row=p.left_row LEFT JOIN report.right_records r ON r.native_row=p.right_row WHERE " + where + " ORDER BY p.pair_id LIMIT ? OFFSET ?"
            cursor = c.execute(query, parameters + [limit, offset])
            names = [column[0] for column in cursor.description]
            rows = []
            response_bytes = len(json.dumps(receipt, ensure_ascii=False, allow_nan=False).encode())
            while True:
                values = cursor.fetchone()
                if values is None:
                    break
                row = dict(zip(names, values))
                row["leftId"] = job["parameters"]["sources"][0]["jobId"] + ":" + str(row["left_row"]) if row["left_row"] is not None else None
                row["rightId"] = job["parameters"]["sources"][1]["jobId"] + ":" + str(row["right_row"]) if row["right_row"] is not None else None
                for field in ("left_source_ids", "right_source_ids"):
                    row[field] = json.loads(row[field]) if row[field] else None
                row = json_exact(row)
                response_bytes += len(json.dumps(row, ensure_ascii=False, allow_nan=False).encode()) + 1
                if response_bytes > MAX_PAGE_BYTES - 1024:
                    raise ValueError("This native response exceeds 16 MiB. Request a smaller page or export the full original values.")
                rows.append(row)
        return _bounded({**receipt, "rows": rows, "total": total, "offset": offset, "limit": limit, "execution": "native-full-result"})

    def matching_selection(self, job_id, value):
        if not isinstance(value, dict) or set(value) - {"side", "category", "pairIds"} or value.get("side") not in {"left", "right"}:
            raise ValueError("Choose one original source side and report category or pair identities.")
        job, path, _ = self._matching_report(job_id)
        where, parameters = self._matching_where(value)
        side = value["side"]
        source = job["parameters"]["sources"][0 if side == "left" else 1]
        source_id = source["jobId"]
        with self._indexed_result(source_id) as (c, info):
            c.execute("ATTACH " + sqlstr(path) + " AS report (READ_ONLY)")
            selection_id = str(uuid.uuid4())
            folder = self.workspace / "Cache" / "native-results" / source_id / "selections"
            folder.mkdir(exist_ok=True)
            target = folder / (selection_id + ".parquet")
            c.execute("COPY (SELECT DISTINCT p." + side + "_row AS native_row FROM report.pairs p WHERE " + where + " AND p." + side + "_row IS NOT NULL ORDER BY native_row) TO " + sqlstr(target) + " (FORMAT PARQUET,COMPRESSION ZSTD)", parameters)
            count = c.execute("SELECT count(*) FROM read_parquet(?)", [str(target)]).fetchone()[0]
            bounds = c.execute("SELECT min(ST_XMin(f." + ident(GEOM) + ")),min(ST_YMin(f." + ident(GEOM) + ")),max(ST_XMax(f." + ident(GEOM) + ")),max(ST_YMax(f." + ident(GEOM) + ")) FROM native_result.features f JOIN read_parquet(?) s ON s.native_row=f." + ident(info["rowColumn"]), [str(target)]).fetchone()
            receipt = {"jobId": source_id, "selectionId": selection_id, "count": count, "sourceSha256": info["sourceSha256"], "bytes": target.stat().st_size, "mtimeNs": target.stat().st_mtime_ns, "sha256": self._hash_file(target), "bounds": list(bounds) if all(x is not None and math.isfinite(x) for x in bounds) else None}
            _atomic_json(target.with_suffix(".json"), receipt)
            return {key: receipt[key] for key in ("jobId", "selectionId", "count", "bounds")}

    def matching_export(self, job_id, format="csv"):
        if format not in {"csv", "json"}:
            raise ValueError("Choose CSV or JSON for the complete correspondence report.")
        job, path, receipt = self._matching_report(job_id)
        target = path.with_name("pairs." + format)
        temporary = Path(str(target) + "." + str(uuid.uuid4()) + ".writing")
        with self.runtime.connection() as c:
            c.execute("ATTACH " + sqlstr(path) + " AS report (READ_ONLY)")
            cursor = c.execute("SELECT p.*,l.source_ids AS left_source_ids,r.source_ids AS right_source_ids," + sqlstr(job["parameters"]["sources"][0]["jobId"]) + " AS left_job_id," + sqlstr(job["parameters"]["sources"][1]["jobId"]) + " AS right_job_id FROM report.pairs p LEFT JOIN report.left_records l ON l.native_row=p.left_row LEFT JOIN report.right_records r ON r.native_row=p.right_row ORDER BY pair_id")
            columns = [column[0] for column in cursor.description]
            try:
                with temporary.open("w", encoding="utf-8", newline="") as output:
                    if format == "csv":
                        writer = csv.writer(output)
                        writer.writerow(columns + ["leftId", "rightId"])
                    else:
                        header = {key: value for key, value in receipt.items() if key != "result"}
                        output.write(json.dumps(header, ensure_ascii=False, allow_nan=False)[:-1] + ',"rows":[')
                    first = True
                    while True:
                        rows = cursor.fetchmany(32)
                        if not rows:
                            break
                        for row in rows:
                            record = dict(zip(columns, row))
                            left_id = record["left_job_id"] + ":" + str(record["left_row"]) if record["left_row"] is not None else None
                            right_id = record["right_job_id"] + ":" + str(record["right_row"]) if record["right_row"] is not None else None
                            if format == "csv":
                                writer.writerow([*row, left_id, right_id])
                            else:
                                for field in ("left_source_ids", "right_source_ids"):
                                    record[field] = json.loads(record[field]) if record[field] else None
                                record.update(leftId=left_id, rightId=right_id)
                                output.write(("" if first else ",") + json.dumps(json_exact(record), ensure_ascii=False, allow_nan=False))
                            first = False
                    if format == "json":
                        output.write("]}")
                os.replace(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)
        return target, "text/csv; charset=utf-8" if format == "csv" else "application/json"
