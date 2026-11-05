"""Isolated HTTPS acceptance service from copied, completed local fixtures.

No provider planning or acquisition occurs. Original workspaces and evidence
remain untouched; only verified source/result bytes and completed job documents
are copied into the new scratch workspace.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import sqlite3
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-engine"))
from usbf_engine import Engine
from usbf_engine.server import serve
from usbf_engine.validation import workspace_path

parser = argparse.ArgumentParser()
parser.add_argument("workspace", type=Path)
parser.add_argument("receipt", type=Path)
parser.add_argument("--origin", required=True)
parser.add_argument("--chart-receipt", type=Path, required=True)
parser.add_argument("--matching-workspace", type=Path, required=True)
args = parser.parse_args()
if args.origin != "https://feng96.github.io":
    raise ValueError("This acceptance service permits the exact production origin only.")
if args.workspace.exists():
    raise ValueError("Use a fresh isolated production acceptance workspace.")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def completed(workspace, *, job_id=None, name=None, records=None):
    database = workspace / "Engine" / "state" / "jobs.sqlite3"
    with sqlite3.connect("file:" + str(database) + "?mode=ro", uri=True) as connection:
        jobs = [json.loads(row[0]) for row in connection.execute("SELECT document FROM jobs ORDER BY rowid")]
    choices = [job for job in jobs if job["status"] == "completed" and job.get("operation") == "load"
               and (job_id is None or job["id"] == job_id) and (name is None or job["name"] == name)
               and (records is None or job.get("result", {}).get("rows") == records)]
    if not choices:
        raise ValueError("The requested completed local fixture is unavailable.")
    return choices[0]


chart_receipt = json.loads(args.chart_receipt.read_text(encoding="utf-8"))
chart_workspace = Path(chart_receipt["resultPath"]).parent.parent
chart_job = completed(chart_workspace, job_id=chart_receipt["job"]["id"], records=2507)
matching_job = completed(args.matching_workspace, name="原始 Source A", records=2)
engine = Engine(args.workspace, extension_path=os.environ["USBF_SPATIAL_EXTENSION"],
                threads=2, memory_limit="512MB", allow_install=False)
copied = []


def copy_completed(source_workspace, original):
    job = json.loads(json.dumps(original))
    paths = {job["result"]["path"], job["result"]["metadataPath"]}
    paths.update(part["path"] for part in job["parts"] if part.get("kind") == "file")
    for relative in sorted(paths):
        source = workspace_path(source_workspace, relative)
        target = workspace_path(engine.workspace, relative, exists=False)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        checksum = digest(source)
        if digest(target) != checksum:
            raise ValueError("A copied acceptance fixture differs from its original bytes.")
        copied.append({"original": str(source), "copy": str(target), "sha256": checksum, "bytes": source.stat().st_size})
    result = engine.workspace / job["result"]["path"]
    if digest(result) != original["result"]["sha256"]:
        raise ValueError("The completed fixture checksum does not match its published receipt.")
    job["result"].update(bytes=result.stat().st_size, mtimeNs=result.stat().st_mtime_ns)
    engine._save(job)
    return job


try:
    imported_chart = copy_completed(chart_workspace, chart_job)
    imported_matching = copy_completed(args.matching_workspace, matching_job)
    server = serve(engine, port=0, origins=[args.origin])
    args.receipt.write_text(json.dumps({"endpoint": "http://127.0.0.1:" + str(server.server_port),
        "code": engine.pairing_code(), "workspaceId": engine.workspace_id, "workspace": str(engine.workspace),
        "allowedOrigins": [args.origin], "chartJob": imported_chart, "matchingJob": imported_matching,
        "expected": chart_receipt["expected"], "copied": copied, "initialMaintenance": engine.maintenance.status(),
        "reusedCompletedJobs": True, "providerDownloads": 0}, ensure_ascii=False), encoding="utf-8")

    def stop(*_):
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    print("PRODUCTION_ANALYSIS_SERVICE_READY", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
finally:
    engine.close()
