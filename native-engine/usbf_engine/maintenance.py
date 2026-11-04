"""Owned native caches, resource preferences and factual local diagnostics.

Only verified disposable bytes are removable. Results, source files, Projects,
task records and every unfinished task checkpoint are outside this lifecycle.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import threading
import time
import uuid

import psutil

MIB = 1024 * 1024
DEFAULTS = {"threads": 2, "memoryMiB": 1024, "cacheQuotaMiB": 10240}


def _write(path, value):
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".writing")
    try:
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class EngineMaintenance:
    def __init__(self, engine):
        self.engine = engine
        self.lock = threading.RLock()
        self.root = engine.workspace / "Cache" / "native-sources-v1"
        self.preferences = engine.workspace / "Engine" / "resource-settings.json"
        memory = re.fullmatch(r"\s*([0-9.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)\s*", str(engine.runtime.memory_limit), re.IGNORECASE)
        factor = {"b": 1, "kb": 1000, "mb": 1000**2, "gb": 1000**3, "tb": 1000**4,
                  "kib": 1024, "mib": 1024**2, "gib": 1024**3, "tib": 1024**4}
        memory_mib = math.ceil(float(memory[1]) * factor[memory[2].lower()] / MIB) if memory else DEFAULTS["memoryMiB"]
        self.settings = dict(DEFAULTS, threads=engine.runtime.threads, memoryMiB=memory_mib)
        if self.preferences.exists():
            value = json.loads(self.preferences.read_text(encoding="utf-8"))
            if value.get("schema") != 1:
                raise ValueError("The native resource settings are not recognized.")
            self.settings = self._validate(value["settings"])
            self._apply()

    def _validate(self, values):
        if not isinstance(values, dict) or set(values) - set(DEFAULTS):
            raise ValueError("Choose threads, memoryMiB and cacheQuotaMiB only.")
        result = {**self.settings, **values}
        limits = {"threads": (1, os.cpu_count() or 1), "memoryMiB": (256, max(256, int(psutil.virtual_memory().total // MIB * .9))),
                  "cacheQuotaMiB": (0, 1024 * 1024)}
        for key, (low, high) in limits.items():
            if type(result[key]) is not int or not low <= result[key] <= high:
                raise ValueError(f"{key} must be a whole number between {low} and {high}.")
        return result

    def _apply(self):
        self.engine.runtime.threads = self.settings["threads"]
        self.engine.runtime.memory_limit = str(self.settings["memoryMiB"]) + "MiB"
        self.engine._runtime_info = None

    def configure(self, values):
        with self.lock, self.engine.mutex:
            if self.engine._active_count():
                raise ValueError("Finish or cancel active native tasks before changing resources.")
            settings = self._validate(values)
            if self.preferences.is_symlink():
                raise ValueError("Resource settings must remain inside Engine.")
            _write(self.preferences, {"schema": 1, "settings": settings})
            self.settings = settings
            self._apply()
            return self.status()

    def _index(self, create=False):
        if self.root.is_symlink():
            raise ValueError("The native source cache must be a real workspace folder.")
        if not self.root.exists():
            if not create:
                return {"schema": 1, "workspaceId": self.engine.workspace_id, "entries": {}}
            self.root.mkdir()
        index = self.root / "index.json"
        if index.is_symlink():
            raise ValueError("The native source cache index must be a real file.")
        if index.exists():
            if index.stat().st_size > 16 * MIB:
                raise ValueError("The native source cache index exceeds its budget.")
            value = json.loads(index.read_text(encoding="utf-8"))
            if value.get("schema") != 1 or value.get("workspaceId") != self.engine.workspace_id or not isinstance(value.get("entries"), dict):
                raise ValueError("The native source cache ownership is not recognized. Its files were kept.")
            return value
        if any(self.root.iterdir()):
            raise ValueError("The native source cache contains unrecognized files. They were kept.")
        value = {"schema": 1, "workspaceId": self.engine.workspace_id, "entries": {}}
        if create:
            _write(index, value)
        return value

    def _owned(self, digest):
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise ValueError("The native cache checksum is invalid.")
        target = self.root / (digest + ".source")
        if target.is_symlink() or not target.resolve().is_relative_to(self.root.resolve()):
            raise ValueError("A native cache file leaves its managed folder. It was kept.")
        return target

    def source_hit(self, part, job_id):
        digest = str(part.get("sha256") or "").lower()
        if not re.fullmatch(r"[a-f0-9]{64}", digest):
            return None
        with self.lock:
            index = self._index()
            item = index["entries"].get(digest)
            if not item:
                return None
            target = self._owned(digest)
            if not target.is_file() or target.stat().st_size != item.get("bytes"):
                return None
            if part.get("bytes") is not None and target.stat().st_size != part["bytes"]:
                return None
            if self.engine._hash_file(target, job_id) != digest:
                return None
            item["lastUsed"] = time.time()
            item["hits"] = int(item.get("hits", 0)) + 1
            _write(self.root / "index.json", index)
            return target

    def source_store(self, part, source, job_id):
        digest = str(part.get("sha256") or "").lower()
        if not re.fullmatch(r"[a-f0-9]{64}", digest) or self.settings["cacheQuotaMiB"] == 0:
            return source
        with self.lock:
            index = self._index(create=True)
            target = self._owned(digest)
            if target.exists():
                if self.engine._hash_file(target, job_id) != digest:
                    # Unknown/changed bytes are never silently replaced or deleted.
                    return source
                source.unlink(missing_ok=True)
            else:
                if self.engine._hash_file(source, job_id) != digest:
                    raise ValueError("The source changed before entering the verified cache.")
                os.replace(source, target)
            index["entries"][digest] = {"bytes": target.stat().st_size, "lastUsed": time.time(),
                                          "hits": int(index["entries"].get(digest, {}).get("hits", 0))}
            _write(self.root / "index.json", index)
            return target

    def _jobs(self):
        with self.engine.mutex, self.engine._database() as connection:
            return [json.loads(row[0]) for row in connection.execute("SELECT document FROM jobs")]

    def _inventory(self):
        index = self._index()
        jobs = self._jobs()
        protected = {str(p.get("sha256", "")).lower() for j in jobs if j.get("status") != "completed" for p in j.get("parts", [])}
        entries, skipped = [], 0
        for digest, value in index["entries"].items():
            try:
                target = self._owned(digest)
                if not target.is_file() or target.stat().st_size != value.get("bytes"):
                    skipped += 1
                    continue
                entries.append({"sha256": digest, "path": str(target.relative_to(self.engine.workspace)),
                                "bytes": target.stat().st_size, "lastUsed": value.get("lastUsed", 0),
                                "hits": value.get("hits", 0), "protected": digest in protected})
            except (ValueError, OSError):
                skipped += 1
        return index, entries, jobs, skipped

    def status(self):
        with self.lock:
            _, entries, jobs, skipped = self._inventory()
            size = sum(x["bytes"] for x in entries)
            limit = self.settings["cacheQuotaMiB"] * MIB
            return {"schema": 1, "settings": dict(self.settings), "cache": {
                "bytes": size, "files": len(entries), "quotaBytes": limit, "overQuota": size > limit,
                "protectedBytes": sum(x["bytes"] for x in entries if x["protected"]),
                "deduplicatedHits": sum(x["hits"] for x in entries), "unrecognizedEntries": skipped,
                "cleanupPolicy": "Verified source cache and completed-task intermediates only; unfinished tasks and all user data are kept.",
                "quotaPolicy": "Soft target; explicit cleanup is required. Active and resumable data can exceed it."},
                "activeJobs": self.engine._active_count(), "execution": "local", "automaticDeletion": False}

    def cleanup(self, options=None):
        options = options or {}
        if not isinstance(options, dict) or set(options) - {"dryRun", "allUnused"} or any(type(x) is not bool for x in options.values()):
            raise ValueError("Choose dryRun and allUnused as boolean values.")
        dry = options.get("dryRun", True)
        with self.lock, self.engine.mutex:
            if self.engine._active_count():
                raise ValueError("Finish or cancel active native tasks before cleaning native caches.")
            index, entries, jobs, skipped = self._inventory()
            total = sum(e["bytes"] for e in entries)
            target_size = 0 if options.get("allUnused") else self.settings["cacheQuotaMiB"] * MIB
            removable = []
            for entry in sorted(entries, key=lambda x: x["lastUsed"]):
                if entry["protected"] or total <= target_size:
                    continue
                file = self._owned(entry["sha256"])
                if self.engine._hash_file(file) != entry["sha256"]:
                    skipped += 1
                    continue
                removable.append((file, entry["sha256"], entry["bytes"]))
                total -= entry["bytes"]
            # Checkpoint files are disposable only after their published result
            # and receipt still match. Unknown files and incomplete jobs stay.
            for job in jobs:
                if job.get("status") != "completed" or not job.get("result"):
                    continue
                result = job["result"]
                try:
                    file = self.engine.result_path(job["id"])
                    if self.engine._hash_file(file) != result.get("sha256"):
                        skipped += 1
                        continue
                    receipt = self.engine.result_path(job["id"], "metadata")
                    metadata = json.loads(receipt.read_text(encoding="utf-8"))
                    if metadata.get("sha256") != result.get("sha256") or metadata.get("jobId") != job["id"]:
                        skipped += 1
                        continue
                    directory = self.engine.workspace / "Cache" / "native-jobs" / str(uuid.UUID(job["id"]))
                    if directory.is_symlink() or not directory.resolve().is_relative_to((self.engine.workspace / "Cache" / "native-jobs").resolve()):
                        skipped += 1
                        continue
                    for part in job.get("parts", []):
                        candidates = [(str(part["id"]) + ".parquet", part.get("checkpointSha256")),
                                      (str(part["id"]) + ".source." + part["format"], part.get("sha256"))]
                        if part.get("kind") == "frozen":
                            frozen = self.engine.workspace / part.get("frozenPath", "")
                            if frozen.parent == directory:
                                candidates.append((frozen.name, part.get("sha256")))
                        for name, digest in candidates:
                            path = directory / name
                            if path.parent != directory or path.is_symlink() or not path.is_file() or not digest:
                                continue
                            if self.engine._hash_file(path) != digest:
                                skipped += 1
                                continue
                            removable.append((path, None, path.stat().st_size))
                except (ValueError, OSError, KeyError):
                    skipped += 1
            removed_bytes = sum(item[2] for item in removable)
            if not dry:
                for file, digest, _ in removable:
                    file.unlink()
                    if digest:
                        index["entries"].pop(digest, None)
                if self.root.exists():
                    _write(self.root / "index.json", index)
            return {"dryRun": dry, "files": len(removable), "bytes": removed_bytes,
                    "skipped": skipped, "userDataKept": True, "unfinishedTasksKept": True,
                    "paths": [str(p.relative_to(self.engine.workspace)) for p, _, _ in removable][:500],
                    "status": self.status()}

    def diagnostics(self):
        started = time.monotonic()
        checks = []
        try:
            info = self.engine.runtime.information()
            checks.append({"name": "DuckDB Spatial", "passed": True, "detail": info})
        except Exception as error:
            checks.append({"name": "DuckDB Spatial", "passed": False, "detail": str(error)[:1000]})
        disk = shutil.disk_usage(self.engine.workspace)
        checks.append({"name": "Workspace disk", "passed": disk.free >= 256 * MIB, "freeBytes": disk.free})
        try:
            state = self.status()
            checks.append({"name": "Managed cache ownership", "passed": True, "detail": state["cache"]})
        except Exception as error:
            checks.append({"name": "Managed cache ownership", "passed": False, "detail": str(error)[:1000]})
        return {"schema": 1, "execution": "local", "passed": all(x["passed"] for x in checks),
                "durationMs": round((time.monotonic() - started) * 1000), "checks": checks,
                "networkTested": False, "publisherSignature": self.engine.build_info.get("signed") is True}
