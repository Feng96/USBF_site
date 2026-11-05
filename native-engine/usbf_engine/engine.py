"""Durable, scoped native tasks with resumable source-part checkpoints."""
from __future__ import annotations

import hashlib
import json
import math
import os
import platform
import queue
import re
import secrets
import shutil
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse
import uuid
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager

import duckdb
import psutil

from .runtime import Runtime, ident, sqlstr
from .results import ResultsMixin
from .providers import ProvidersMixin, PROVIDER_IDS
from .comparison import ComparisonMixin
from .matching import MatchingMixin
from .charts import ChartsMixin
from .maintenance import EngineMaintenance
from .geometry_metadata import preserve_empty_geoparquet
from .security import https_context
from .validation import (FOLDERS, FORMATS, OPERATIONS, MAX_SPEC_BYTES, bounds, clone, digest_json,
                         intersects, json_exact, normalize_spec, public_url,
                         safe_name, scope_geometry, workspace_path)

VERSION = "0.4.0"
GEOM = "__usbf_geometry"
TERMINAL = {"completed", "partial", "failed", "cancelled", "interrupted"}
PREVIEW_MAX_BYTES = 8 * 1024 * 1024
TABLE_MAX_BYTES = 16 * 1024 * 1024


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path, value):
    temporary = Path(str(path) + ".writing")
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


class Cancelled(Exception):
    pass


class CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Engine(ProvidersMixin, ResultsMixin, ComparisonMixin, MatchingMixin, ChartsMixin):
    def __init__(self, workspace, *, extension_path=None, threads=2, memory_limit="1GB",
                 allow_install=True, autostart=True, downloader=None):
        self.workspace = Path(workspace).expanduser().resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)
        for name in FOLDERS:
            folder = self.workspace / name
            folder.mkdir(exist_ok=True)
            if folder.is_symlink() or not folder.resolve().is_relative_to(self.workspace):
                raise ValueError("Workspace folders must remain inside the selected parent.")
        self.state_dir = self.workspace / "Engine" / "state"
        self.state_dir.mkdir(exist_ok=True)
        self._lock_file = (self.state_dir / "service.lock").open("a+b")
        self._lock_file.seek(0)
        if os.name == "nt":
            import msvcrt
            if self._lock_file.tell() == 0:
                self._lock_file.write(b"0")
                self._lock_file.flush()
            self._lock_file.seek(0)
            try:
                msvcrt.locking(self._lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                self._lock_file.close()
                raise RuntimeError("A native engine is already using this workspace.")
        else:
            import fcntl
            try:
                fcntl.flock(self._lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                self._lock_file.close()
                raise RuntimeError("A native engine is already using this workspace.")
        marker = self.workspace / "Engine" / "workspace-id.json"
        if marker.exists():
            info = json.loads(marker.read_text())
            self.workspace_id = str(uuid.UUID(info["id"]))
        else:
            self.workspace_id = str(uuid.uuid4())
            atomic_json(marker, {"version": 1, "id": self.workspace_id})
        self.db = self.state_dir / "jobs.sqlite3"
        self.mutex = threading.RLock()
        self.wake = threading.Event()
        self.stop = threading.Event()
        self.cancel_flags = {}
        self.active_connection = None
        self.active_job_id = None
        self.active_response = None
        self.uninstall_handler = None
        self.build_info = {"packageVersion": VERSION, "revision": None, "platform": platform.system(), "signed": False}
        self.runtime = Runtime(self.workspace, extension_path=extension_path, threads=threads,
                               memory_limit=memory_limit, allow_install=allow_install)
        self.downloader = downloader or self._download
        self._runtime_info = None
        self._pair_code = ""
        self._pair_until = 0
        self._pair_attempts = []
        with self._database() as c:
            c.execute("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, document TEXT NOT NULL)")
            c.execute("CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY, created TEXT NOT NULL)")
            c.execute("PRAGMA journal_mode=DELETE")
            for row in c.execute("SELECT id,document FROM jobs").fetchall():
                job = json.loads(row[1])
                if job["status"] in {"queued", "running", "cancelling"}:
                    job.update(status="interrupted", error="The engine stopped before this task finished.", updatedAt=now())
                    c.execute("UPDATE jobs SET document=? WHERE id=?", (json.dumps(job), row[0]))
        self.maintenance = EngineMaintenance(self)
        self.worker = threading.Thread(target=self._worker, name="usbf-native-worker", daemon=True)
        if autostart:
            self.worker.start()

    @contextmanager
    def _database(self):
        connection = sqlite3.connect(str(self.db), timeout=30)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _save(self, job):
        job["updatedAt"] = now()
        with self.mutex, self._database() as c:
            c.execute("INSERT OR REPLACE INTO jobs(id,document) VALUES(?,?)", (job["id"], json.dumps(job, allow_nan=False)))

    def get_job(self, job_id):
        with self.mutex, self._database() as c:
            row = c.execute("SELECT document FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise KeyError("The native task does not exist.")
        return json.loads(row[0])

    def jobs(self, summaries=False):
        with self.mutex, self._database() as c:
            values = [json.loads(r[0]) for r in c.execute("SELECT document FROM jobs ORDER BY rowid DESC LIMIT 500")]
        if summaries:
            for job in values:
                job.pop("parts", None)
                job.pop("inputContract", None)
                if job.get("scope"):
                    scope = job["scope"]
                    job["scope"] = {"label": scope.get("label"), "crs": "EPSG:4326", "bounds": bounds(scope_geometry(scope))}
                coverage = job.get("coverage", {})
                missing = coverage.pop("missingParts", [])
                coverage["missingPartCount"] = len(missing)
        return values

    def _active_count(self):
        with self.mutex, self._database() as c:
            return c.execute("SELECT count(*) FROM jobs WHERE json_extract(document,'$.status') IN ('queued','running','cancelling')").fetchone()[0]

    def pairing_code(self):
        self._pair_code = "".join(str(secrets.randbelow(10)) for _ in range(8))
        self._pair_until = time.monotonic() + 180
        self._pair_attempts = []
        return self._pair_code

    def pair(self, code):
        stamp = time.monotonic()
        self._pair_attempts = [x for x in self._pair_attempts if stamp - x < 60]
        if len(self._pair_attempts) >= 5:
            raise PermissionError("Too many pairing attempts. Generate a fresh code in the native program.")
        self._pair_attempts.append(stamp)
        if not self._pair_code or stamp > self._pair_until or not isinstance(code, str) or not secrets.compare_digest(code, self._pair_code):
            raise PermissionError("The pairing code is invalid or expired.")
        self._pair_code = ""
        token = secrets.token_urlsafe(32)
        with self.mutex, self._database() as c:
            c.execute("INSERT INTO tokens(hash,created) VALUES(?,?)", (hashlib.sha256(token.encode()).hexdigest(), now()))
        return {"token": token, "workspaceId": self.workspace_id, "version": VERSION}

    def authorized(self, token):
        if not isinstance(token, str) or len(token) > 200:
            return False
        with self.mutex, self._database() as c:
            return c.execute("SELECT 1 FROM tokens WHERE hash=?", (hashlib.sha256(token.encode()).hexdigest(),)).fetchone() is not None

    def revoke(self):
        with self.mutex, self._database() as c:
            c.execute("DELETE FROM tokens")
        self._pair_code = ""

    def unpair(self, token):
        with self.mutex, self._database() as c:
            c.execute("DELETE FROM tokens WHERE hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
        return {"unpaired": True, "jobsKept": True}

    def set_uninstall_handler(self, callback):
        self.uninstall_handler = callback

    def set_build_info(self, value):
        if not isinstance(value, dict) or len(json.dumps(value)) > 8192:
            raise ValueError("Invalid native build information.")
        self.build_info = clone(value)

    def request_uninstall(self):
        if not self.uninstall_handler:
            raise ValueError("This installation has no desktop uninstall controller.")
        if self._active_count():
            raise ValueError("Cancel or finish active native tasks before uninstalling the runtime.")
        self.uninstall_handler()
        return {"requested": True, "confirmation": "Confirm removal in the native desktop program."}

    def status(self):
        if self._runtime_info is None:
            self._runtime_info = self.runtime.information()
        memory = psutil.virtual_memory()
        disk = shutil.disk_usage(self.workspace)
        return {"service": "USBF Local Engine", "version": VERSION, "apiVersion": 1,
                "workspace": {"id": self.workspace_id, "name": self.workspace.name, "path": str(self.workspace), "folders": list(FOLDERS)},
                "runtime": self._runtime_info, "build": clone(self.build_info),
                "hardware": {"platform": platform.system(), "architecture": platform.machine(), "cpuThreads": os.cpu_count(),
                             "memoryBytes": memory.total, "availableMemoryBytes": memory.available,
                             "diskFreeBytes": disk.free, "diskTotalBytes": disk.total},
                "capabilities": {"operations": sorted(OPERATIONS), "resume": True, "table": True, "preview": True,
                                 "resultMap": True, "resultQuery": True, "resultSelection": True, "resultExport": True,
                                 "projectPackages": True, "maintenance": True, "resultSummary": True,
                                 "originalDataProviders": list(PROVIDER_IDS),
                                 "resultComparisonSummary": True, "resultMatching": True, "resultCharts": True,
                                 "uninstallRequest": bool(self.uninstall_handler), "uninstall": False},
                "activeJobs": self._active_count()}

    def import_geojson(self, name, data):
        safe_name(name)
        if not name.lower().endswith((".geojson", ".json")):
            name += ".geojson"
        if not isinstance(data, dict) or data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
            raise ValueError("Choose a GeoJSON FeatureCollection.")
        encoded = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
        if len(encoded) > MAX_SPEC_BYTES:
            raise ValueError("Use a workspace file for GeoJSON larger than 16 MiB.")
        stem, suffix = Path(name).stem, Path(name).suffix
        with self.mutex:
            for index in range(1000):
                target = self.workspace / "Files" / (name if not index else f"{stem} ({index+1}){suffix}")
                try:
                    with target.open("xb") as f:
                        f.write(encoded)
                    break
                except FileExistsError:
                    continue
            else:
                raise ValueError("Too many local files have that name.")
        return {"path": target.relative_to(self.workspace).as_posix(), "bytes": len(encoded), "format": "GeoJSON"}

    def files(self, path="Files"):
        if path not in FOLDERS and not any(path.startswith(root + "/") for root in FOLDERS):
            raise ValueError("Choose a workspace folder.")
        if any(p.startswith(".") or p in {"", ".."} for p in path.split("/")) or "\\" in path:
            raise ValueError("Use a relative workspace folder.")
        folder = (self.workspace / path).resolve()
        if not folder.is_relative_to(self.workspace) or not folder.is_dir():
            raise ValueError("Choose a workspace folder.")
        entries = []
        for item in sorted(folder.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
            if item.is_symlink() or not item.resolve().is_relative_to(self.workspace):
                continue
            if len(entries) == 500:
                return {"path": path, "entries": entries, "limited": True}
            stat = item.stat()
            entries.append({"name": item.name, "kind": "directory" if item.is_dir() else "file", "size": stat.st_size if item.is_file() else None,
                            "lastModified": int(stat.st_mtime * 1000), "path": item.relative_to(self.workspace).as_posix()})
        return {"path": path, "entries": entries, "limited": False}

    def stat_file(self, path):
        try:
            file = workspace_path(self.workspace, path, roots=("Files", "Results", "Cache"))
        except FileNotFoundError:
            return {"exists": False, "path": path}
        stat = file.stat()
        with self.mutex, self._database() as c:
            row = c.execute("SELECT json_extract(document,'$.result') FROM jobs WHERE json_extract(document,'$.result.path')=? LIMIT 1", (path,)).fetchone()
        known = json.loads(row[0]) if row and row[0] else None
        matches = bool(known and known.get("bytes") == stat.st_size and known.get("mtimeNs") == stat.st_mtime_ns)
        return {"exists": True, "path": path, "size": stat.st_size, "lastModified": int(stat.st_mtime * 1000),
                "mtimeNs": stat.st_mtime_ns, "sha256": known.get("sha256") if matches else None,
                "fingerprintMatches": matches, "checksumCached": matches}

    def _hash_file(self, path, job_id=None):
        checksum = hashlib.sha256()
        with Path(path).open("rb") as stream:
            while True:
                if job_id:
                    self._check(job_id)
                block = stream.read(1024 * 1024)
                if not block:
                    break
                checksum.update(block)
        return checksum.hexdigest()

    def _read_manifest(self, source):
        url = public_url(source["manifestUrl"])
        opener = urllib.request.build_opener(CheckedRedirect(), urllib.request.HTTPSHandler(context=https_context()))
        with opener.open(urllib.request.Request(url, headers={"User-Agent": "USBF-Local-Engine/0.1"}), timeout=30) as response:
            raw = response.read(16 * 1024 * 1024 + 1)
        if len(raw) > 16 * 1024 * 1024:
            raise ValueError("The source manifest is too large.")
        digest = hashlib.sha256(raw).hexdigest()
        expected = source.get("manifestSha256") or source.get("release", {}).get("manifestSha256")
        if expected and digest != expected:
            raise ValueError("The source manifest changed. Choose its pinned file list or publication version.")
        data = json.loads(raw)
        if data.get("crs") != "EPSG:4326" or not isinstance(data.get("files"), list):
            raise ValueError("This native source manifest is unsupported.")
        return {**source, "files": data["files"], "manifestSha256": digest,
                "baseUrl": source.get("baseUrl", url.rsplit("/", 1)[0] + "/"),
                "releaseId": source.get("releaseId", data.get("release")), "updated": data.get("updated_utc")}

    def plan(self, value):
        spec = normalize_spec(value)
        geom = scope_geometry(spec.get("scope"))
        box = bounds(geom) if geom else None
        parts = []
        for number, original in enumerate(spec["inputs"]):
            source = clone(original)
            if source.get("kind") == "native-selection":
                source = self.selection_input(source)
            kind = source.get("kind")
            if kind == "file":
                file = workspace_path(self.workspace, source.get("path"))
                fmt = source.get("format", file.suffix.lstrip(".").lower())
                if fmt not in FORMATS:
                    raise ValueError("This native file format is not supported.")
                stat = file.stat()
                parts.append({"id": str(number), "kind": "file", "path": source["path"], "format": fmt,
                              "name": file.name, "bytes": stat.st_size, "mtimeNs": stat.st_mtime_ns,
                              "sha256": source.get("sha256"), "rows": source.get("rows"), "crs": source.get("crs", "EPSG:4326"), "crsExplicit": "crs" in source})
            elif kind in {"geojson", "inline"}:
                data = source.get("data")
                if not isinstance(data, dict) or data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
                    raise ValueError("Native inline input needs a FeatureCollection.")
                size = len(json.dumps(data, allow_nan=False).encode())
                if size > MAX_SPEC_BYTES:
                    raise ValueError("Use a workspace file for larger native input.")
                parts.append({"id": str(number), "kind": "geojson", "data": data, "format": "geojson", "name": source.get("name", "Browser workset"), "bytes": size, "rows": len(data["features"]), "crs": "EPSG:4326"})
            elif kind == "url":
                url = public_url(source.get("url"))
                fmt = source.get("format", url.split("?", 1)[0].rsplit(".", 1)[-1]).lower()
                if fmt not in FORMATS:
                    raise ValueError("Choose a native vector source file format.")
                parsed_url = urlparse(url)
                if parsed_url.hostname.lower() == "data.cityofnewyork.us" or re.search(r"/(?:FeatureServer|MapServer)(?:/|$)", parsed_url.path, re.I):
                    raise ValueError("Use the browser provider adapter for paginated API sources.")
                parts.append({"id": str(number), "kind": "url", "url": url, "format": fmt, "name": source.get("name", url.rsplit("/", 1)[-1]),
                              "bytes": source.get("bytes"), "rows": source.get("rows"), "sha256": source.get("sha256"), "crs": source.get("crs", "EPSG:4326"), "crsExplicit": "crs" in source})
            elif kind == "provider":
                parts.extend(self._provider_plan(source, spec.get("scope"), number))
            elif kind in {"usbf", "usbf-manifest", "manifest-files"}:
                if not isinstance(source.get("files"), list):
                    source = self._read_manifest(source)
                if len(source["files"]) > 100000:
                    raise ValueError("This source manifest contains too many files.")
                certified_bounds = source.get("geometryBoundsGuaranteed") is True
                for index, tile in enumerate(source["files"]):
                    geometry_box = tile.get("geometry_bbox")
                    has_geometry_box = (tile.get("geometry_bounds_complete") is True
                                        and isinstance(geometry_box, list) and len(geometry_box) == 4
                                        and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in geometry_box)
                                        and -180 <= geometry_box[0] <= geometry_box[2] <= 180
                                        and -90 <= geometry_box[1] <= geometry_box[3] <= 90)
                    if certified_bounds and not has_geometry_box:
                        raise ValueError("The certified source geometry index is incomplete or invalid.")
                    tilebox = geometry_box if has_geometry_box else tile.get("bbox") or tile.get("tile_bbox")
                    if box and (not isinstance(tilebox, list) or len(tilebox) != 4):
                        raise ValueError("The manifest has no usable file bounds.")
                    if box and not intersects(tilebox, box):
                        continue
                    url = tile.get("url")
                    if not url:
                        from urllib.parse import urljoin
                        url = urljoin(source.get("baseUrl", ""), tile.get("path", ""))
                    public_url(url)
                    checksum = tile.get("sha256")
                    if not isinstance(checksum, str) or len(checksum) != 64 or any(c not in "0123456789abcdefABCDEF" for c in checksum):
                        raise ValueError("Pinned native manifest parts need SHA256 checksums.")
                    parts.append({"id": f"{number}.{index}", "kind": "url", "url": url, "format": "geoparquet", "name": tile.get("path", url.rsplit("/", 1)[-1]),
                                  "bytes": tile.get("bytes"), "rows": tile.get("rows"), "sha256": checksum.lower(), "crs": source.get("crs", "EPSG:4326"), "crsExplicit": True,
                                  "sourceCandidateIndex": "full-geometry-bbox" if has_geometry_box else "published-file-bbox",
                                  "geometryBoundsGuaranteed": certified_bounds,
                                  "sourceRelease": {k: source.get(k) for k in ("releaseId", "manifestSha256", "manifestUrl", "releaseRef", "updated", "licenses", "rights") if source.get(k) is not None}})
            else:
                raise ValueError("Choose a workspace file, fixed workset or pinned source manifest.")
        if not parts:
            raise ValueError("The selected source has no published files intersecting this task boundary.")
        if len(parts) > 100000:
            raise ValueError("The native task contains too many parts.")
        for part in parts:
            for key in ("bytes", "rows"):
                if part.get(key) is not None and (not isinstance(part[key], int) or isinstance(part[key], bool) or part[key] < 0):
                    raise ValueError("The source counts or sizes are invalid.")
            crs = part.get("crs")
            if not isinstance(crs, str) or len(crs) > 100 or not re.fullmatch(r"EPSG:\d{4,6}", crs):
                raise ValueError("Native source CRS must be an explicit EPSG identifier.")
        known_bytes = sum(p.get("bytes") or 0 for p in parts)
        unknown = sum(p.get("bytes") is None for p in parts)
        unknown_rows = sum(p.get("rows") is None for p in parts)
        known_rows = sum(p.get("rows") or 0 for p in parts)
        free = shutil.disk_usage(self.workspace).free
        return {"schema": 1, "parts": parts, "partCount": len(parts), "estimatedBytes": known_bytes,
                "estimatedRows": known_rows, "knownSourceBytes": known_bytes, "knownSourceRows": known_rows,
                "unknownSizeParts": unknown, "unknownRowParts": unknown_rows,
                "estimatedBytesComplete": unknown == 0, "estimatedRowsComplete": unknown_rows == 0,
                "estimateKind": "Whole source-file upper bounds; exact in-range rows are known after reading.",
                "diskFreeBytes": free, "minimumDiskBytes": known_bytes * 3,
                "fitsDiskEstimate": unknown == 0 and known_bytes * 3 < free,
                "scope": spec.get("scope"), "release": spec.get("release"), "providerCoverage": "source-defined"}

    def create_job(self, value):
        spec = normalize_spec(value)
        with self.mutex, self._database() as c:
            active = c.execute("SELECT count(*) FROM jobs WHERE json_extract(document,'$.status') IN ('queued','running','cancelling')").fetchone()[0]
        if active >= 64:
            raise ValueError("Finish or cancel native tasks before queuing more than 64 jobs.")
        plan = self.plan(spec)
        if plan["estimatedBytes"] * 3 > plan["diskFreeBytes"]:
            raise ValueError("The estimated native input/output space exceeds available workspace storage.")
        job_id = str(uuid.uuid4())
        folder = self.workspace / "Cache" / "native-jobs" / job_id
        folder.mkdir(parents=True)
        frozen_parts = []
        for part in plan["parts"]:
            if part["kind"] == "geojson":
                path = folder / (part["id"] + ".geojson")
                atomic_json(path, part.pop("data"))
                part.update(kind="frozen", frozenPath=path.relative_to(self.workspace).as_posix(), sha256=hashlib.sha256(path.read_bytes()).hexdigest(), crsExplicit=True)
            frozen_parts.append({**part, "status": "pending", "attempts": 0, "rowsWritten": 0, "error": None})
        stamp = now()
        job = {"id": job_id, "operation": spec["operation"], "name": str(spec.get("name") or spec["operation"])[:120],
               "status": "queued", "phase": "waiting", "createdAt": stamp, "updatedAt": stamp,
               "scope": spec.get("scope"), "release": spec.get("release"), "inputContract": spec.get("inputContract"),
               "parameters": spec.get("parameters", {}), "requestHash": digest_json(spec), "parts": frozen_parts,
               "progress": {"completedParts": 0, "plannedParts": len(frozen_parts), "failedParts": 0, "actualRows": 0},
               "estimatedBytes": plan["estimatedBytes"], "estimatedRows": plan["estimatedRows"], "result": None, "error": None,
               "coverage": {"requestComplete": False, "providerCoverage": "source-defined", "missingParts": []},
               "capabilities": {"cancel": True, "resume": True, "preview": False, "table": False}}
        self._save(job)
        self.wake.set()
        return job

    def cancel(self, job_id):
        job = self.get_job(job_id)
        if job["status"] in TERMINAL:
            return job
        self.cancel_flags.setdefault(job_id, threading.Event()).set()
        job["status"] = "cancelling" if job["status"] == "running" else "cancelled"
        self._save(job)
        if self.active_job_id == job_id:
            if self.active_connection: self.active_connection.interrupt()
            if self.active_response: self.active_response.close()
        return job

    def resume(self, job_id):
        job = self.get_job(job_id)
        if job["status"] not in {"failed", "partial", "cancelled", "interrupted"}:
            raise ValueError("Only an interrupted, failed, partial or cancelled task can resume.")
        self.cancel_flags[job_id] = threading.Event()
        for part in job["parts"]:
            if part["status"] != "completed":
                part.update(status="pending", error=None)
        job.update(status="queued", phase="resuming", error=None)
        job["coverage"]["requestComplete"] = False
        self._save(job)
        self.wake.set()
        return job

    def _check(self, job_id):
        if self.stop.is_set() or self.cancel_flags.setdefault(job_id, threading.Event()).is_set():
            raise Cancelled("The native task was cancelled. Completed source parts were retained.")

    def _download(self, part, destination, job_id):
        public_url(part["url"])
        opener = urllib.request.build_opener(CheckedRedirect(), urllib.request.HTTPSHandler(context=https_context()))
        request = urllib.request.Request(part["url"], headers={"User-Agent": "USBF-Local-Engine/0.1"})
        with opener.open(request, timeout=20) as response, destination.open("wb") as output:
            self.active_response = response
            checksum = hashlib.sha256()
            written = 0
            try:
                while True:
                    self._check(job_id)
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    if shutil.disk_usage(destination.parent).free < len(chunk) + 64 * 1024 * 1024:
                        raise ValueError("The native workspace disk is full.")
                    output.write(chunk)
                    checksum.update(chunk)
                    written += len(chunk)
                    if part.get("bytes") is not None and written > part["bytes"]:
                        raise ValueError("The source exceeds its pinned file size.")
            finally:
                self.active_response = None
        if part.get("bytes") is not None and written != part["bytes"]:
            raise ValueError("The downloaded source does not match its pinned file size.")
        if part.get("sha256") and checksum.hexdigest() != part["sha256"].lower():
            raise ValueError("The downloaded source does not match its pinned SHA256.")

    def _source_file(self, part, directory, job_id):
        if part["kind"] in {"provider-parquet", "provider-api"}:
            return self._provider_materialize(part, directory, job_id)
        if part["kind"] == "file":
            path = workspace_path(self.workspace, part["path"])
            stat = path.stat()
            if stat.st_size != part["bytes"] or stat.st_mtime_ns != part["mtimeNs"]:
                raise ValueError("The workspace input changed after this native task was planned.")
            if part.get("sha256") and self._hash_file(path, job_id) != part["sha256"].lower():
                raise ValueError("The workspace input does not match its pinned SHA256.")
            return path
        if part["kind"] == "frozen":
            path = workspace_path(self.workspace, part["frozenPath"], roots=("Cache",))
            if not path.resolve().is_relative_to(directory.resolve()):
                raise ValueError("The frozen task input is invalid.")
            if self._hash_file(path, job_id) != part.get("sha256"):
                raise ValueError("The frozen browser input changed after task creation.")
            return path
        cached = self.maintenance.source_hit(part, job_id)
        if cached:
            return cached
        destination = directory / (part["id"] + ".source." + part["format"])
        if destination.exists():
            if part.get("sha256") and self._hash_file(destination, job_id) == part["sha256"].lower():
                return destination
            destination.unlink()
        temporary = Path(str(destination) + ".download")
        try:
            self.downloader(part, temporary, job_id)
            self._check(job_id)
            # The ingest boundary verifies its transport, including injected desktop
            # transports; an adapter may never bypass immutable source identity.
            if part.get("bytes") is not None and temporary.stat().st_size != part["bytes"]:
                raise ValueError("The downloaded source does not match its pinned file size.")
            if part.get("sha256") and self._hash_file(temporary, job_id) != part["sha256"].lower():
                raise ValueError("The downloaded source does not match its pinned SHA256.")
            os.replace(temporary, destination)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        return self.maintenance.source_store(part, destination, job_id)

    def _source_crs(self, part, source, geometry, connection):
        if part["kind"] == "provider-api":
            return "EPSG:4326"
        if part["kind"] == "frozen":
            return "EPSG:4326"
        detected = None
        if part["format"] in {"parquet", "geoparquet"}:
            rows = connection.execute("SELECT value FROM parquet_kv_metadata(?) WHERE key='geo'", [str(source)]).fetchall()
            if rows:
                metadata = json.loads(rows[0][0])
                field = metadata.get("columns", {}).get(geometry, {})
                if "crs" not in field:
                    detected = "EPSG:4326"  # GeoParquet's specified CRS84 default.
                elif field["crs"]:
                    identity = field["crs"].get("id", {})
                    if identity.get("authority") == "EPSG":
                        detected = "EPSG:" + str(identity["code"])
                if not detected and not part.get("crsExplicit"):
                    raise ValueError("This GeoParquet has no supported identified CRS. Supply its actual EPSG source CRS.")
            elif not part.get("crsExplicit"):
                raise ValueError("This Parquet file has no GeoParquet CRS metadata. Supply its actual source CRS.")
        else:
            meta = connection.execute("SELECT layers FROM ST_Read_Meta(?)", [str(source)]).fetchone()[0]
            if len(meta) != 1:
                raise ValueError("Choose a single-layer native source file.")
            fields = meta[0].get("geometry_fields", [])
            info = next((f.get("crs") for f in fields if f.get("name") == geometry), None) or (fields[0].get("crs") if fields else None)
            if info and info.get("auth_name") == "EPSG" and info.get("auth_code"):
                detected = "EPSG:" + str(info["auth_code"])
            elif not part.get("crsExplicit"):
                raise ValueError("This native source has no identified CRS. Supply its actual source EPSG code.")
        if detected and part.get("crsExplicit") and detected != part["crs"]:
            raise ValueError("The declared source CRS disagrees with its file metadata.")
        return detected or part["crs"]

    def _chunk(self, job, part, source, destination, connection):
        self._check(job["id"])
        if part["format"] in {"parquet", "geoparquet"}:
            query = "SELECT * FROM read_parquet(" + sqlstr(source) + ")"
        elif part["format"] in {"json", "geojson"} and (part["kind"] == "frozen" or source.stat().st_size <= MAX_SPEC_BYTES):
            query = self._inline_query(source, connection)
        else:
            query = "SELECT * FROM ST_Read(" + sqlstr(source) + ")"
            layer_metadata = connection.execute("SELECT layers FROM ST_Read_Meta(?)", [str(source)]).fetchone()[0]
            if len(layer_metadata) != 1:
                raise ValueError("Choose a single-layer native source file.")
            json_fields = [field["name"] for field in layer_metadata[0].get("fields", []) if field.get("subtype") == "JSON"]
            if json_fields:
                # GDAL exposes rich GeoJSON values as String/JSON. Preserve the
                # logical JSON type in Parquet and decode it in browser pages.
                replacements = ",".join(ident(name) + "::JSON AS " + ident(name) for name in json_fields)
                query = "SELECT * REPLACE (" + replacements + ") FROM (" + query + ")"
        description = connection.execute("DESCRIBE (" + query + ")").fetchall()
        if part.get("rows") is not None:
            source_count = connection.execute("SELECT count(*) FROM (" + query + ")").fetchone()[0]
            if source_count != part["rows"]:
                raise ValueError("The source row count does not match its pinned manifest.")
        geometry = next((row[0] for row in description if str(row[1]).startswith("GEOMETRY")), None)
        expression = ident(geometry) if geometry else None
        if part.get("providerGeometryColumn"):
            geometry = part["providerGeometryColumn"]
            expression = "CASE WHEN " + ident(geometry) + " IS NULL THEN NULL::GEOMETRY ELSE ST_GeomFromGeoJSON(" + ident(geometry) + ") END"
        if geometry is None:
            geometry = next((row[0] for row in description if row[0].lower() in {"geometry", "geom", "wkb_geometry"} and row[1] == "BLOB"), None)
            if geometry:
                expression = "ST_GeomFromWKB(" + ident(geometry) + ")"
        if geometry is None:
            raise ValueError("The native source has no supported geometry column.")
        properties = [row[0] for row in description if row[0] != geometry]
        if GEOM in properties:
            raise ValueError("A source attribute conflicts with the native geometry column.")
        source_crs = self._source_crs(part, source, geometry, connection)
        part["detectedCRS"] = source_crs
        if source_crs != "EPSG:4326":
            expression = "ST_Transform(" + expression + "," + sqlstr(source_crs) + ",'EPSG:4326',always_xy:=true)"
        expression = "ST_SetCRS(" + expression + ",'EPSG:4326')"
        columns = ",".join(ident(name) for name in properties)
        projection = (columns + "," if columns else "") + expression + " AS " + ident(GEOM)
        selected = "SELECT " + projection + " FROM (" + query + ")"
        if part.get("regionFilter"):
            selected = "SELECT * FROM (" + selected + ") WHERE " + ident("region") + "=" + sqlstr(part["regionFilter"])
        geom = scope_geometry(job.get("scope"))
        if geom:
            boundary = "ST_GeomFromGeoJSON(" + sqlstr(json.dumps(geom, allow_nan=False)) + ")"
            valid = connection.execute("SELECT ST_IsValid(" + boundary + ")").fetchone()[0]
            if not valid:
                raise ValueError("The task boundary geometry is invalid.")
            selected = "SELECT * FROM (" + selected + ") WHERE ST_Intersects(" + ident(GEOM) + "," + boundary + ")"
        temporary = Path(str(destination) + ".writing")
        try:
            connection.execute("COPY (" + selected + ") TO " + sqlstr(temporary) + " (FORMAT PARQUET, COMPRESSION ZSTD)")
            preserve_empty_geoparquet(connection, temporary, GEOM)
            self._check(job["id"])
            count = connection.execute("SELECT count(*) FROM read_parquet(" + sqlstr(temporary) + ")").fetchone()[0]
            os.replace(temporary, destination)
            return count
        except Exception:
            temporary.unlink(missing_ok=True)
            raise

    def _inline_query(self, source, connection):
        """Preserve JSON properties that GDAL otherwise serializes to strings.

        Browser worksets are bounded to 16 MiB. Typed scalar columns stay typed;
        nested or heterogeneous values use Parquet's JSON logical type and are
        decoded back into values by the bounded JSON result endpoints.
        """
        collection = json.loads(source.read_text(encoding="utf-8"))
        if collection.get("type") != "FeatureCollection" or not isinstance(collection.get("features"), list):
            raise ValueError("Choose a GeoJSON FeatureCollection.")
        kinds, integers, folded = {}, {}, {}
        for feature in collection["features"]:
            self._check(self.active_job_id)
            if not isinstance(feature, dict) or feature.get("type") != "Feature":
                raise ValueError("A GeoJSON input feature is invalid.")
            props = feature.get("properties") or {}
            if not isinstance(props, dict):
                raise ValueError("GeoJSON feature properties must be an object or null.")
            for name, value in props.items():
                if name.lower() in folded and folded[name.lower()] != name:
                    raise ValueError("GeoJSON attribute names differ only by letter case; rename them before native processing.")
                folded[name.lower()] = name
                if name.lower() == GEOM:
                    raise ValueError("A source attribute conflicts with the native geometry column.")
                kind = "null" if value is None else "bool" if isinstance(value, bool) else "int" if isinstance(value, int) else "float" if isinstance(value, float) else "str" if isinstance(value, str) else "json"
                kinds.setdefault(name, set()).add(kind)
                if kind == "int": integers.setdefault(name, []).append(value)
        lines = self.workspace / "Cache" / "native-jobs" / self.active_job_id / "inline.rows.jsonl"
        with lines.open("w", encoding="utf-8") as output:
            for feature in collection["features"]:
                self._check(self.active_job_id)
                output.write(json.dumps(feature, ensure_ascii=False, allow_nan=False) + "\n")
        # The JSON scanner reads the bounded workset in bulk, avoiding one SQL
        # INSERT per feature. Empty collections still have a known geometry type.
        if collection["features"]:
            connection.execute("CREATE OR REPLACE TEMP VIEW __usbf_inline AS SELECT json AS raw FROM read_json_objects(" + sqlstr(lines) + ",format='newline_delimited',maximum_object_size=16777216)")
        else:
            connection.execute("CREATE OR REPLACE TEMP VIEW __usbf_inline AS SELECT NULL::JSON AS raw WHERE false")
        columns = []
        for name, types in kinds.items():
            types.discard("null")
            kind = next(iter(types)) if len(types) == 1 else "json"
            path = '$."properties".' + json.dumps(name, ensure_ascii=False)
            extract = "json_extract(raw," + sqlstr(path) + ")"
            if kind == "str": expression = "json_extract_string(raw," + sqlstr(path) + ")"
            elif kind in {"bool", "float"}: expression = extract + "::" + ("BOOLEAN" if kind == "bool" else "DOUBLE")
            elif kind == "int":
                values = integers[name]
                low, high = min(values), max(values)
                integer_type = "BIGINT" if -(2**63) <= low <= high < 2**63 else "UBIGINT" if 0 <= low <= high < 2**64 else "DECIMAL(38,0)" if max(len(str(abs(low))), len(str(abs(high)))) <= 38 else None
                if not integer_type:
                    raise ValueError("A GeoJSON integer exceeds the exact native numeric range. Store this identifier as a string.")
                expression = extract + "::" + integer_type
            else: expression = extract
            columns.append(expression + " AS " + ident(name))
        # Keep a top-level Feature.id, including strings and exact large IDs.
        if any("id" in feature for feature in collection["features"]):
            fid = "_usbf_source_feature_id"
            while fid in kinds: fid += "_"
            columns.append("json_extract(raw,'$.id') AS " + ident(fid))
        columns.append("CASE WHEN json_extract(raw,'$.geometry') IS NULL OR json_extract(raw,'$.geometry')='null'::JSON THEN NULL::GEOMETRY ELSE ST_GeomFromGeoJSON(json_extract(raw,'$.geometry')) END AS " + ident(GEOM))
        return "SELECT " + ",".join(columns) + " FROM __usbf_inline"

    def _progress(self, job):
        good = [p for p in job["parts"] if p["status"] == "completed"]
        failed = [p for p in job["parts"] if p["status"] == "failed"]
        job["progress"] = {"completedParts": len(good), "plannedParts": len(job["parts"]), "failedParts": len(failed),
                           "actualRows": sum(p.get("rowsWritten", 0) for p in good)}
        indexes = {p.get("sourceCandidateIndex", "full-input") for p in job["parts"]}
        guaranteed = all(p.get("geometryBoundsGuaranteed", p.get("sourceCandidateIndex") is None) is True for p in job["parts"])
        job["coverage"] = {"requestComplete": len(good) == len(job["parts"]), "providerCoverage": "source-defined",
                           "spatialRule": "whole-geometry-intersects-v1", "candidateIndex": next(iter(indexes)) if len(indexes) == 1 else "mixed",
                           "geometryBoundsGuaranteed": True if guaranteed else None, "providerCompleteness": None,
                           "sourceReleases": list({digest_json(p["sourceRelease"]): p["sourceRelease"] for p in job["parts"] if p.get("sourceRelease")}.values()),
                           "snapshotIsolation": False if any(p.get("providerId") in {"dc-government", "nyc-government", "gba-usa"} for p in job["parts"]) else None,
                           "missingParts": [{"id": p["id"], "name": p["name"], "status": p["status"], "error": p.get("error")} for p in job["parts"] if p["status"] != "completed"]}

    def _finish(self, job, directory, connection):
        self._check(job["id"])
        files = [directory / (p["id"] + ".parquet") for p in job["parts"] if p["status"] == "completed"]
        # Do not silently cast conflicting source attribute types during Merge.
        schemas = {}
        for file in files:
            for name, kind, *_ in connection.execute("DESCRIBE SELECT * FROM read_parquet(" + sqlstr(file) + ")").fetchall():
                if name in schemas and schemas[name] != kind:
                    raise ValueError("Merge attribute types conflict for " + name + ". Convert that field explicitly before merging.")
                schemas[name] = kind
        source = "read_parquet([" + ",".join(sqlstr(f) for f in files) + "],union_by_name=true)"
        query = "SELECT * FROM " + source
        derived = []
        if job["operation"] == "measure":
            name = "_usbf_area_m2"
            n = 1
            while name in schemas:
                n += 1
                name = "_usbf_area_m2_" + str(n)
            derived.append(name)
            length_name = "_usbf_length_m"
            n = 1
            while length_name in schemas:
                n += 1
                length_name = "_usbf_length_m_" + str(n)
            derived.append(length_name)
            query = ("SELECT *,CASE WHEN ST_GeometryType(" + ident(GEOM) + ") IN ('POLYGON','MULTIPOLYGON') THEN ST_Area_Spheroid(" + ident(GEOM) + ") ELSE NULL END AS " + ident(name)
                     + ",CASE WHEN ST_GeometryType(" + ident(GEOM) + ") IN ('POLYGON','MULTIPOLYGON') THEN ST_Perimeter_Spheroid(" + ident(GEOM) + ") WHEN ST_GeometryType(" + ident(GEOM) + ") IN ('LINESTRING','MULTILINESTRING') THEN ST_Length_Spheroid(" + ident(GEOM) + ") ELSE NULL END AS " + ident(length_name) + " FROM " + source)
        if job["operation"] == "buffer":
            crs = job["parameters"]["measurementCRS"]
            distance = float(job["parameters"]["distanceMetres"])
            props = ",".join(ident(k) for k in schemas if k != GEOM)
            expression = "ST_Transform(ST_Buffer(ST_Transform(" + ident(GEOM) + ",'EPSG:4326'," + sqlstr(crs) + ",always_xy:=true)," + str(distance) + ")," + sqlstr(crs) + ",'EPSG:4326',always_xy:=true)"
            query = "SELECT " + (props + "," if props else "") + "ST_SetCRS(" + expression + ",'EPSG:4326') AS " + ident(GEOM) + " FROM " + source
        target = self.workspace / "Results" / (job["id"] + ".parquet")
        temporary = directory / "result.writing.parquet"
        temporary.unlink(missing_ok=True)
        connection.execute("COPY (" + query + ") TO " + sqlstr(temporary) + " (FORMAT PARQUET, COMPRESSION ZSTD)")
        preserve_empty_geoparquet(connection, temporary, GEOM)
        self._check(job["id"])
        rows = connection.execute("SELECT count(*) FROM read_parquet(" + sqlstr(temporary) + ")").fetchone()[0]
        if rows != job["progress"]["actualRows"]:
            raise RuntimeError("The native result row count differs from its completed source-part counts.")
        output_hash = self._hash_file(temporary, job["id"])
        output_fields = [{"name": name, "type": kind} for name, kind, *_ in connection.execute("DESCRIBE SELECT * FROM read_parquet(" + sqlstr(temporary) + ")").fetchall()]
        receipt = {"schema": 1, "engineVersion": VERSION, "jobId": job["id"], "operation": job["operation"], "createdAt": job["createdAt"],
                   "finishedAt": now(), "scope": job["scope"], "release": job["release"], "inputContract": job["inputContract"],
                   "parameters": job["parameters"], "requestHash": job["requestHash"], "parts": job["parts"], "coverage": job["coverage"],
                   "recordCount": rows, "sha256": output_hash, "geometryColumn": GEOM, "crs": "EPSG:4326", "format": "GeoParquet", "derivedFields": derived,
                   "sourceFields": [{"name": name, "type": kind} for name, kind in schemas.items() if name != GEOM], "outputFields": output_fields,
                   "geometryBehavior": "Full intersecting source geometries; only Buffer changes outlines.",
                   "numericEncoding": "Parquet retains original numeric types; decimals and integers beyond JavaScript safe range use decimal strings in JSON.",
                   "providerCoverageNote": "All planned files completed. This is not a claim that the provider maps every real building."}
        receipt_path = target.with_suffix(".metadata.json")
        if target.exists():
            raise FileExistsError("A native result already exists. It will not be overwritten.")
        if receipt_path.exists():
            previous = json.loads(receipt_path.read_text())
            if previous.get("jobId") != job["id"] or previous.get("requestHash") != job["requestHash"]:
                raise FileExistsError("An unfamiliar result receipt already exists. It was kept.")
        self._check(job["id"])
        # Write the receipt first. After a crash, its expected hash can recover
        # the complete temporary output or verify a published output before the
        # durable job state is marked completed. No incomplete result is served.
        atomic_json(receipt_path, receipt)
        os.replace(temporary, target)
        return {"path": target.relative_to(self.workspace).as_posix(), "metadataPath": receipt_path.relative_to(self.workspace).as_posix(),
                "format": "GeoParquet", "rows": rows, "geometryColumn": GEOM, "bytes": target.stat().st_size,
                "mtimeNs": target.stat().st_mtime_ns, "sha256": output_hash}

    def _recover_result(self, job, directory, connection):
        target = self.workspace / "Results" / (job["id"] + ".parquet")
        metadata = target.with_suffix(".metadata.json")
        if not metadata.exists():
            return None
        receipt = json.loads(metadata.read_text())
        if receipt.get("jobId") != job["id"] or receipt.get("requestHash") != job["requestHash"] or not receipt.get("coverage", {}).get("requestComplete"):
            raise ValueError("An unfamiliar native result receipt was kept. It cannot resume this task.")
        candidate = target if target.exists() else directory / "result.writing.parquet"
        if not candidate.exists():
            return None
        if self._hash_file(candidate, job["id"]) != receipt.get("sha256"):
            raise ValueError("The native output changed after writing. The file was kept.")
        count = connection.execute("SELECT count(*) FROM read_parquet(" + sqlstr(candidate) + ")").fetchone()[0]
        if count != receipt.get("recordCount"):
            raise ValueError("The recovered output record count differs from its receipt.")
        if candidate != target:
            os.replace(candidate, target)
        return {"path": target.relative_to(self.workspace).as_posix(), "metadataPath": metadata.relative_to(self.workspace).as_posix(),
                "format": "GeoParquet", "rows": count, "geometryColumn": GEOM, "bytes": target.stat().st_size,
                "mtimeNs": target.stat().st_mtime_ns, "sha256": receipt["sha256"], "recovered": True}

    def _execute(self, job):
        if job.get("operation") == "building-match":
            return self._execute_matching(job)
        directory = self.workspace / "Cache" / "native-jobs" / job["id"]
        job.update(status="running", phase="reading", error=None)
        self._save(job)
        connection = None
        self.active_job_id = job["id"]
        try:
            connection = self.runtime.connection()
            self.active_connection = connection
            recovered = self._recover_result(job, directory, connection)
            if recovered:
                self._progress(job)
                job.update(status="completed", phase="finished", result=recovered, error=None)
                job["capabilities"].update(cancel=False, resume=False, preview=True, table=True)
                return
            self._provider_prefetch(job["parts"], job["id"])
            for part in job["parts"]:
                self._check(job["id"])
                checkpoint = directory / (part["id"] + ".parquet")
                if part["status"] == "completed" and checkpoint.exists() and self._hash_file(checkpoint, job["id"]) == part.get("checkpointSha256"):
                    continue
                part.update(status="running", attempts=part.get("attempts", 0) + 1, error=None)
                self._save(job)
                try:
                    source = self._source_file(part, directory, job["id"])
                    count = self._chunk(job, part, source, checkpoint, connection)
                    part.update(status="completed", rowsWritten=count, checkpointSha256=self._hash_file(checkpoint, job["id"]))
                except Cancelled:
                    part.update(status="cancelled", error="Cancelled before this source part completed.")
                    raise
                except Exception as error:
                    self._check(job["id"])
                    part.update(status="failed", error=str(error)[:1000])
                self._progress(job)
                self._save(job)
            self._check(job["id"])
            self._progress(job)
            if job["progress"]["failedParts"]:
                job.update(status="partial" if job["progress"]["completedParts"] else "failed", phase="needs-retry",
                           error="Some source parts failed. Completed checkpoints are retained; resume retries only missing parts.")
            else:
                job["phase"] = "writing"
                self._save(job)
                job["result"] = self._finish(job, directory, connection)
                job.update(status="completed", phase="finished", error=None)
                job["capabilities"].update(cancel=False, resume=False, preview=True, table=True)
        except Cancelled as error:
            self._progress(job)
            job.update(status="interrupted" if self.stop.is_set() else "cancelled", phase="stopped", error=str(error))
        except Exception as error:
            self._progress(job)
            job.update(status="failed", phase="failed", error=str(error)[:1000])
        finally:
            self._provider_prefetch_cleanup(job["id"])
            self.active_connection = None
            self.active_job_id = None
            if connection:
                connection.close()
            self._save(job)

    def _worker(self):
        while not self.stop.is_set():
            with self.mutex, self._database() as c:
                row = c.execute("SELECT document FROM jobs WHERE json_extract(document,'$.status')='queued' ORDER BY rowid LIMIT 1").fetchone()
            job = json.loads(row[0]) if row else None
            if job:
                self._execute(job)
            else:
                self.wake.wait(.25)
                self.wake.clear()

    def result_path(self, job_id, format="parquet"):
        job = self.get_job(job_id)
        if job["status"] != "completed" or not job.get("result"):
            raise ValueError("This task has no complete published result yet.")
        if format not in {"parquet", "metadata"}:
            raise ValueError("Choose parquet or metadata; GeoJSON is available as a bounded preview.")
        return workspace_path(self.workspace, job["result"]["path" if format == "parquet" else "metadataPath"], roots=("Results",))

    @contextmanager
    def _page_rows(self, job_id, *, offset, limit, row_byte_limit):
        """Fetch one bounded row at a time; large values remain inside DuckDB.

        The SQL-side size guard prevents huge individual strings/geometries from
        being transferred into Python merely to discover that they exceed the
        browser budget. DuckDB retains its configured native memory limit.
        """
        path = self.result_path(job_id)
        with self.runtime.connection() as c:
            c.execute("SET threads=1")
            description = c.execute("DESCRIBE SELECT * FROM read_parquet(" + sqlstr(path) + ")").fetchall()
            columns = [{"name": r[0], "type": r[1]} for r in description if r[0] != GEOM]
            names = {str(r[0]).lower() for r in description}
            def alias(stem):
                while stem.lower() in names: stem += "_"
                names.add(stem.lower())
                return ident(stem)
            geo_alias, size_alias = alias("__usbf_preview_json"), alias("__usbf_preview_bytes")
            packed = "to_json(struct_pack(" + ",".join(ident(field["name"]) + ":=" + ident(field["name"]) for field in columns) + "))" if columns else "'{}'"
            limited = "SELECT * FROM read_parquet(" + sqlstr(path) + ") LIMIT ? OFFSET ?"
            serialized = "SELECT *,ST_AsGeoJSON(" + ident(GEOM) + ") AS " + geo_alias + " FROM (" + limited + ")"
            measured = "SELECT *,octet_length(encode(CAST(" + packed + " AS VARCHAR)))+coalesce(octet_length(encode(" + geo_alias + ")),4)+512 AS " + size_alias + " FROM (" + serialized + ")"
            guard = size_alias + "<=" + str(int(row_byte_limit))
            fields = ["CASE WHEN " + guard + " THEN " + ident(field["name"]) + " ELSE NULL END" for field in columns]
            fields.extend(["CASE WHEN " + guard + " THEN " + geo_alias + " ELSE NULL END", size_alias])
            c.execute("SELECT " + ",".join(fields) + " FROM (" + measured + ")", [limit, offset])
            def stream():
                index = offset
                while True:
                    row = c.fetchone()
                    if row is None: break
                    position = index
                    index += 1
                    if row[-1] > row_byte_limit:
                        yield None, position
                        continue
                    properties = json_exact({field["name"]: json.loads(value) if field["type"] == "JSON" and value is not None else value for field, value in zip(columns, row[:-2])})
                    yield {"id": f"{job_id}:{position}", "properties": properties, "geometry": json.loads(row[-2]) if row[-2] else None}, position
            yield columns, stream()

    def table(self, job_id, *, offset=0, limit=100):
        limit = max(1, min(int(limit), 1000))
        offset = max(0, int(offset))
        rows = []
        with self._page_rows(job_id, offset=offset, limit=limit, row_byte_limit=TABLE_MAX_BYTES) as (columns, stream):
            result = {"columns": columns, "rows": rows, "total": self.get_job(job_id)["result"]["rows"], "offset": offset, "limit": limit,
                      "maximumBytes": TABLE_MAX_BYTES,
                      "numericEncoding": "Decimals and integers outside JavaScript safe range are decimal strings; original Parquet types are unchanged."}
            used = len(json.dumps(result, ensure_ascii=False).encode()) + 4096
            if used > TABLE_MAX_BYTES:
                raise ValueError("This native table schema exceeds the 16 MiB page budget. Download the full GeoParquet file to inspect its original fields.")
            for row, position in stream:
                if row is None:
                    raise ValueError("Native table row " + str(position) + " exceeds the 16 MiB page budget. Choose another or smaller page, or download the full GeoParquet file. Original values were kept.")
                used += len(json.dumps(row, ensure_ascii=False, allow_nan=False).encode()) + 2
                if used > TABLE_MAX_BYTES:
                    raise ValueError("This native table page exceeds 16 MiB. Request a smaller page or download the full GeoParquet file. No attribute values were truncated.")
                rows.append(row)
        return result

    def preview(self, job_id, limit=2000):
        limit = max(1, min(int(limit), 2000))
        job = self.get_job(job_id)
        self.result_path(job_id)
        scope = job["scope"]
        summary = {"label": str(scope.get("label") or "")[:256], "crs": "EPSG:4326", "bounds": bounds(scope_geometry(scope))} if scope else None
        release = job["release"]
        metadata_limited = len(json.dumps(release, ensure_ascii=False).encode()) > 65536
        if metadata_limited:
            release = {key: str(release.get(key))[:4096] for key in ("releaseId", "manifestSha256", "policy", "sourceId") if isinstance(release, dict) and release.get(key) is not None}
        output = {"type": "FeatureCollection", "name": job["name"] + " · native preview", "features": [],
                  "provenance": {"role": "native-result-preview", "jobId": job_id, "nativeSource": job["result"]["path"],
                                 "displayOnly": True, "limited": True, "recordCount": job["result"]["rows"], "previewCount": 0,
                                 "maximumFeatures": limit, "maximumBytes": PREVIEW_MAX_BYTES,
                                 "omittedOversizedFeatures": 0, "omittedForByteBudget": 0, "scannedFeatures": 0,
                                 "scope": summary, "release": release, "metadataLimited": metadata_limited,
                                 "fullMetadataPath": job["result"]["metadataPath"], "coverage": job["coverage"],
                                 "numericEncoding": "Decimals and integers outside JavaScript safe range are decimal strings; original Parquet types are unchanged."}}
        used = len(json.dumps(output, ensure_ascii=False).encode()) + 4096
        with self._page_rows(job_id, offset=0, limit=limit, row_byte_limit=PREVIEW_MAX_BYTES) as (_, stream):
            for row, _ in stream:
                output["provenance"]["scannedFeatures"] += 1
                if row is None:
                    output["provenance"]["omittedOversizedFeatures"] += 1
                    continue
                feature = {"type": "Feature", **row}
                size = len(json.dumps(feature, ensure_ascii=False, allow_nan=False).encode()) + 2
                if size > PREVIEW_MAX_BYTES:
                    output["provenance"]["omittedOversizedFeatures"] += 1
                    continue
                if size + used > PREVIEW_MAX_BYTES:
                    output["provenance"]["omittedForByteBudget"] += 1
                    continue
                output["features"].append(feature)
                used += size
        meta = output["provenance"]
        meta["previewCount"] = len(output["features"])
        meta["limited"] = job["result"]["rows"] > len(output["features"])
        if meta["omittedOversizedFeatures"] or meta["omittedForByteBudget"]:
            meta["warning"] = "Display sample limited to 8 MiB. Oversized features were omitted without changing their geometry or attributes. Use the full native result for analysis."
        return output

    def close(self, revoke=True):
        self.stop.set()
        self.wake.set()
        if self.active_connection:
            self.active_connection.interrupt()
        if self.active_response:
            self.active_response.close()
        if self.worker.is_alive():
            self.worker.join(35)
            if self.worker.is_alive():
                raise RuntimeError("A native input read is still stopping; the workspace lock was kept.")
        if revoke:
            self.revoke()
        if not self._lock_file.closed:
            if os.name != "nt":
                import fcntl
                fcntl.flock(self._lock_file.fileno(), fcntl.LOCK_UN)
            self._lock_file.close()
