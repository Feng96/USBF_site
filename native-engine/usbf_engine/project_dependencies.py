"""Portable Project packages: stream full dependencies, verify before adoption.

Packages are local files, not uploads. The map renderer and public basemaps can
still require internet. No general ZIP extraction or private path access exists.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import uuid
import zipfile

import duckdb

from .validation import clone, workspace_path

PROJECT_LIMIT = 16 * 1024 * 1024
HEX = re.compile(r"^[a-f0-9]{64}$")


def _json(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()


def _project(value):
    value = clone(value)
    if not isinstance(value, dict) or value.get("format") != "USBF map" or value.get("version") not in (1, 2):
        raise ValueError("Choose a valid USBF Project.")
    layers = value.get("layers")
    if not isinstance(layers, list) or len(layers) > 24 or any(not isinstance(x, dict) for x in layers):
        raise ValueError("A Project supports up to 24 layers.")
    keys = [x.get("key") for x in layers]
    if any(not isinstance(x, str) or not re.fullmatch(r"layer-\d+", x) for x in keys) or len(set(keys)) != len(keys):
        raise ValueError("Project layer keys must be unique.")
    for layer in layers:
        meta = layer.get("meta")
        if meta is not None and not isinstance(meta, dict):
            raise ValueError("Project layer metadata must be an object.")
        ref = (meta or {}).get("nativeSource")
        if ref is not None and not isinstance(ref, dict):
            raise ValueError("A native Project dependency must be an object.")
    if len(_json(value)) > PROJECT_LIMIT:
        raise ValueError("A native Project package supports a Project document up to 16 MiB.")
    return value


def _folder(engine, root, name):
    parent = engine.workspace / root / name
    parent.mkdir(parents=True, exist_ok=True)
    if parent.is_symlink() or not parent.resolve().is_relative_to(engine.workspace / root):
        raise ValueError("The package folder must stay inside the workspace.")
    return parent


def _atomic_document(path, value):
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".writing")
    try:
        with temporary.open("xb") as output:
            output.write(_json(value))
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def export_package(engine, body):
    project = _project(body.get("project"))
    dependencies, sources = [], {}
    for layer in project["layers"]:
        ref = (layer.get("meta") or {}).get("nativeSource")
        if not ref:
            continue
        if ref.get("workspaceId") != engine.workspace_id:
            raise ValueError("Relink native dependencies to this workspace before packaging.")
        file = engine.result_path(ref.get("jobId"))
        relative = file.relative_to(engine.workspace).as_posix()
        if relative != ref.get("path"):
            raise ValueError("The native dependency does not match its completed task.")
        digest = engine._hash_file(file)
        if ref.get("sha256") and ref["sha256"] != digest:
            raise ValueError("A Project dependency changed; the package was not published.")
        entry = "data/" + digest + ".parquet"
        sources[entry] = (file, digest, file.stat().st_size)
        job = engine.get_job(ref["jobId"])
        if job.get("result", {}).get("sha256") != digest:
            raise ValueError("A task result changed; recreate or relink its dependency first.")
        if type(ref.get("recordCount")) is not int or ref["recordCount"] != job["result"]["rows"]:
            raise ValueError("The Project dependency count differs from its full result.")
        dependencies.append({"layerKey": layer["key"], "entry": entry, "sha256": digest,
                             "bytes": file.stat().st_size, "recordCount": job["result"]["rows"],
                             "release": clone(ref.get("release")), "coverage": clone(job.get("coverage", {}))})
        # Internal workspace identity is re-created at import, never trusted.
        layer["meta"]["nativeSource"] = {**ref, "workspaceId": "packaged", "path": "Results/dependencies/" + digest + ".parquet", "sha256": digest}
    document = _json(project)
    manifest = {"format": "USBF Project package", "version": 1,
                "project": {"entry": "project.json", "bytes": len(document), "sha256": hashlib.sha256(document).hexdigest()},
                "dependencies": dependencies,
                "onlineSourcesIncluded": False,
                "note": "Includes complete native results and embedded Project assets. Public catalog data, basemaps and online renderer are separate dependencies."}
    total = sum(value[2] for value in sources.values()) + len(document) + 1024 * 1024
    folder = _folder(engine, "Results", "Packages")
    if shutil.disk_usage(folder).free < total + 64 * 1024 * 1024:
        raise ValueError("There is not enough local disk space for this Project package.")
    target = folder / (str(uuid.uuid4()) + ".usbf.zip")
    temporary = target.with_suffix(".writing")
    try:
        with zipfile.ZipFile(temporary, "x", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            archive.writestr("package.json", _json(manifest))
            archive.writestr("project.json", document)
            for entry, (file, expected, size) in sources.items():
                digest = hashlib.sha256()
                copied = 0
                with file.open("rb") as source, archive.open(entry, "w", force_zip64=True) as destination:
                    while block := source.read(1024 * 1024):
                        destination.write(block)
                        digest.update(block)
                        copied += len(block)
                if digest.hexdigest() != expected or copied != size:
                    raise ValueError("A dependency changed while packaging. The incomplete package was removed.")
        os.replace(temporary, target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return {"path": target.relative_to(engine.workspace).as_posix(), "bytes": target.stat().st_size,
            "sha256": engine._hash_file(target), "dependencies": len(dependencies), "onlineSourcesIncluded": False}


def package_path(engine, value):
    if not isinstance(value, str) or not re.fullmatch(r"Results/Packages/[a-f0-9-]{36}\.usbf\.zip", value):
        raise ValueError("Choose an exported Project package.")
    return workspace_path(engine.workspace, value, roots=("Results",))


def _read_json(archive, entry, limit):
    info = archive.getinfo(entry)
    if info.file_size > limit:
        raise ValueError("The package metadata exceeds its size limit.")
    with archive.open(info) as source:
        data = source.read(limit + 1)
    if len(data) > limit:
        raise ValueError("The package metadata exceeds its size limit.")
    return json.loads(data), data


def import_package(engine, body):
    source = workspace_path(engine.workspace, body.get("path"), roots=("Files",))
    parent = _folder(engine, "Files", "Projects")
    staging = parent / (str(uuid.uuid4()) + "-importing")
    staging.mkdir()
    adopted = False
    try:
        with zipfile.ZipFile(source) as archive:
            infos = archive.infolist()
            names = [item.filename for item in infos]
            if len(names) > 26 or len(names) != len(set(names)):
                raise ValueError("The Project package contains duplicate or too many entries.")
            if any(item.is_dir() or stat.S_ISLNK(item.external_attr >> 16) or item.flag_bits & 1 for item in infos):
                raise ValueError("Project packages cannot contain links, directories or encrypted entries.")
            manifest, _ = _read_json(archive, "package.json", 1024 * 1024)
            if manifest.get("format") != "USBF Project package" or manifest.get("version") != 1:
                raise ValueError("Choose a USBF Project package.")
            dependencies = manifest.get("dependencies")
            if not isinstance(dependencies, list) or len(dependencies) > 24:
                raise ValueError("The package dependency manifest is invalid.")
            expected = manifest.get("project", {})
            if not isinstance(expected, dict):
                raise ValueError("The packaged Project identity is invalid.")
            project, document = _read_json(archive, "project.json", PROJECT_LIMIT)
            if expected.get("entry") != "project.json" or expected.get("bytes") != len(document) or expected.get("sha256") != hashlib.sha256(document).hexdigest():
                raise ValueError("The packaged Project document does not match its SHA256.")
            project = _project(project)
            layers = {layer["key"]: layer for layer in project["layers"]}
            unique = {}
            used = set()
            for dependency in dependencies:
                if not isinstance(dependency, dict):
                    raise ValueError("The package dependency is invalid.")
                digest, key = dependency.get("sha256"), dependency.get("layerKey")
                if not isinstance(digest, str) or not HEX.fullmatch(digest) or key not in layers or key in used:
                    raise ValueError("Package dependency identities are invalid.")
                entry = "data/" + digest + ".parquet"
                if dependency.get("entry") != entry or type(dependency.get("bytes")) is not int or dependency["bytes"] < 1:
                    raise ValueError("The package dependency path or size is invalid.")
                if type(dependency.get("recordCount")) is not int or dependency["recordCount"] < 0:
                    raise ValueError("The packaged dependency record count is invalid.")
                info = archive.getinfo(entry)
                if info.file_size != dependency["bytes"] or info.file_size > max(1, info.compress_size) * 200:
                    raise ValueError("The packaged data size is invalid.")
                ref = (layers[key].get("meta") or {}).get("nativeSource")
                if not ref or ref.get("sha256") != digest or type(ref.get("recordCount")) is not int or ref["recordCount"] != dependency["recordCount"]:
                    raise ValueError("The Project and dependency manifest do not match.")
                used.add(key)
                unique[entry] = dependency
            if set(names) != {"package.json", "project.json", *unique}:
                raise ValueError("The package contains unexpected files.")
            if any((layer.get("meta") or {}).get("nativeSource") and layer["key"] not in used for layer in project["layers"]):
                raise ValueError("A native Project dependency is missing from the package.")
            total = sum(item["bytes"] for item in unique.values())
            if shutil.disk_usage(parent).free < total * 2 + 64 * 1024 * 1024:
                raise ValueError("There is not enough local disk space to restore the complete dependencies.")
            for entry, dependency in unique.items():
                file = staging / (dependency["sha256"] + ".parquet")
                digest = hashlib.sha256()
                written = 0
                with archive.open(entry) as input_file, file.open("xb") as output:
                    while block := input_file.read(1024 * 1024):
                        written += len(block)
                        if written > dependency["bytes"]:
                            raise ValueError("A packaged dependency exceeds its saved size.")
                        digest.update(block)
                        output.write(block)
                if written != dependency["bytes"] or digest.hexdigest() != dependency["sha256"]:
                    raise ValueError("A packaged native dependency failed SHA256 verification.")
        # Validate every dependency and count before any task is enqueued or
        # complete user data is adopted. Parquet count uses its metadata.
        specs = {}
        for dependency in dependencies:
            digest = dependency["sha256"]
            if digest in specs:
                if specs[digest]["inputs"][0]["rows"] != dependency["recordCount"]:
                    raise ValueError("Shared Project dependencies have conflicting record counts.")
                continue
            file = staging / (digest + ".parquet")
            try:
                with engine.runtime.connection() as connection:
                    count = connection.execute("SELECT count(*) FROM read_parquet(?)", [str(file)]).fetchone()[0]
                    schema = connection.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(file)]).fetchall()
                    if not any(column[0] == "__usbf_geometry" and column[1].startswith("GEOMETRY") for column in schema):
                        raise ValueError("A packaged native result has no supported primary geometry.")
            except duckdb.Error as error:
                raise ValueError("A packaged native dependency is not a readable GeoParquet result.") from error
            if count != dependency["recordCount"]:
                raise ValueError("A packaged dependency count differs from its complete Parquet file.")
            spec = {"schema": 1, "operation": "load", "name": "Restore Project dependency",
                    "inputs": [{"kind": "file", "path": file.relative_to(engine.workspace).as_posix(),
                                "sha256": digest, "rows": count, "crs": "EPSG:4326"}],
                    "release": dependency.get("release"),
                    "inputContract": {"packageRestore": True, "originalCoverage": dependency.get("coverage", {}), "recordCount": count}}
            engine.plan(spec)
            specs[digest] = spec
        destination = parent / staging.name.removesuffix("-importing")
        staging.rename(destination)
        adopted = True
        jobs = []
        by_digest = {}
        recovery_path = destination / "restore-receipt.json"
        recovery = {"schema": 1, "format": "USBF Project restore receipt", "state": "queueing",
                    "workspaceId": engine.workspace_id, "projectPath": (destination / "project.usbf.json").relative_to(engine.workspace).as_posix(),
                    "dependencies": dependencies, "jobs": jobs, "dataVerified": True}
        try:
            _atomic_document(destination / "project.usbf.json", project)
            _atomic_document(recovery_path, recovery)
            # Hold the scheduler lock until this package has either queued all
            # dependencies or cancelled its own partially queued set. Other
            # user tasks and existing complete results are unaffected.
            with engine.mutex:
                try:
                    if engine._active_count() + len(specs) > 64:
                        raise ValueError("Finish active native tasks before restoring these dependencies.")
                    for dependency in dependencies:
                        digest = dependency["sha256"]
                        if digest not in by_digest:
                            spec = clone(specs[digest])
                            spec["inputs"][0]["path"] = (destination / (digest + ".parquet")).relative_to(engine.workspace).as_posix()
                            job = engine.create_job(spec)
                            by_digest[digest] = job["id"]
                        jobs.append({"layerKey": dependency["layerKey"], "jobId": by_digest[digest], "recordCount": dependency["recordCount"], "sourceSha256": digest})
                        _atomic_document(recovery_path, recovery)
                    recovery["state"] = "queued"
                    _atomic_document(recovery_path, recovery)
                except Exception:
                    for job_id in by_digest.values():
                        engine.cancel(job_id)
                    raise
        except Exception as error:
            recovery["state"] = "needs-recovery"
            recovery["error"] = str(error)[:2000]
            try:
                _atomic_document(recovery_path, recovery)
            except OSError:
                pass
            raise ValueError("Complete verified dependencies were kept. Project restoration could not finish; recovery details: "
                             + recovery_path.relative_to(engine.workspace).as_posix() + ". " + str(error)) from error
        return {"project": project, "jobs": jobs, "dependenciesVerified": len(dependencies), "onlineSourcesIncluded": False,
                "recoveryPath": recovery_path.relative_to(engine.workspace).as_posix()}
    except (KeyError, zipfile.BadZipFile, UnicodeError) as error:
        raise ValueError("The Project package is invalid or incomplete.") from error
    finally:
        if not adopted:
            shutil.rmtree(staging)


def relink_dependency(engine, body):
    expected = body.get("sha256")
    if not isinstance(expected, str) or not HEX.fullmatch(expected):
        raise ValueError("Relinking needs the saved dependency SHA256.")
    file = workspace_path(engine.workspace, body.get("path"), roots=("Files", "Results"))
    if engine._hash_file(file) != expected:
        raise ValueError("The chosen file does not match the saved dependency SHA256.")
    job = engine.create_job({"schema": 1, "operation": "load", "name": "Relink Project dependency",
                             "inputs": [{"kind": "file", "path": body["path"], "sha256": expected, "crs": "EPSG:4326"}],
                             "release": body.get("release")})
    return {"jobId": job["id"], "sourceSha256": expected}
