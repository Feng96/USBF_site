#!/usr/bin/env python3
"""Measure actual original-provider cold/warm reuse and exact record parity.

Use a fresh scratch output directory. GBA's first scan intentionally validates
and reads every manifest file's whole-geometry footer, with bounded concurrency.
No nominal tile or centroid index can replace that scan.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sqlite3
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-engine"))
import pyarrow.parquet as pq
from usbf_engine import Engine, providers


class CountingResponse:
    def __init__(self, response, record):
        self.response, self.record = response, record
        self.status, self.headers = response.status, response.headers
    def __enter__(self):
        self.response.__enter__()
        return self
    def __exit__(self, *args):
        return self.response.__exit__(*args)
    def read(self, size=-1):
        raw = self.response.read(size)
        self.record["bytes"] += len(raw)
        return raw


def baseline_job(root, provider):
    with sqlite3.connect("file:" + str(root / provider / "Engine/state/jobs.sqlite3") + "?mode=ro", uri=True) as connection:
        return json.loads(connection.execute("SELECT document FROM jobs WHERE json_extract(document,'$.status')='completed' LIMIT 1").fetchone()[0])


def run(args, provider):
    previous = baseline_job(args.baseline, provider)
    baseline = pq.read_table(args.baseline / provider / previous["result"]["path"])
    workspace = args.output / provider
    if workspace.exists():
        raise ValueError("Cold-cache measurement requires a fresh output folder: " + str(workspace))
    requests, original = [], providers.provider_open
    def counted(url, *, headers=None):
        response = original(url, headers=headers)
        record = {"range": (headers or {}).get("Range"), "bytes": 0, "status": response.status}
        requests.append(record)
        return CountingResponse(response, record)
    providers.provider_open = counted
    engine = Engine(workspace, extension_path=args.extension, autostart=False)
    receipt = {"provider": provider, "scope": previous["scope"], "baselineRows": baseline.num_rows, "runs": []}
    cold_table = None
    try:
        for stage in ("cold", "warm"):
            requests.clear()
            start = time.monotonic()
            job = engine.create_job({"schema": 1, "operation": "load", "inputs": [{"kind": "provider", "providerId": provider}], "scope": previous["scope"]})
            plan_seconds = time.monotonic() - start
            engine._execute(job)
            seconds = time.monotonic() - start
            job = engine.get_job(job["id"])
            if job["status"] != "completed":
                raise RuntimeError(json.dumps(job, ensure_ascii=False))
            table = pq.read_table(engine.result_path(job["id"]))
            exact_baseline = table.equals(baseline, check_metadata=False)
            exact_cold = cold_table is None or table.equals(cold_table, check_metadata=False)
            if cold_table is None:
                cold_table = table
            transports = [part.get("transport", {}) for part in job["parts"]]
            run = {"stage": stage, "seconds": round(seconds, 3), "planSeconds": round(plan_seconds, 3),
                "status": job["status"], "rows": table.num_rows, "columns": table.num_columns,
                "exactBaselineRecordsetAndTypes": exact_baseline, "exactColdRecordsetAndTypes": exact_cold,
                "requestComplete": job["coverage"]["requestComplete"], "networkRequests": len(requests),
                "networkBytes": sum(item["bytes"] for item in requests),
                "freshIdentityRequests": sum(item["range"] == "bytes=0-7" for item in requests),
                "materializationCacheHits": sum(bool(item.get("materializationCacheHit")) for item in transports),
                "footerCacheHits": sum(item.get("footerCacheHits", 0) for item in transports),
                "parts": len(transports), "cache": engine.maintenance.status()["cache"],
                "result": job["result"], "sourceIdentities": [part.get("sourceIdentity") for part in job["parts"]]}
            receipt["runs"].append(run)
            (args.output / (provider + "-cache-smoke.json")).write_text(json.dumps(receipt, indent=2))
            print(json.dumps({key: value for key, value in run.items() if key not in {"sourceIdentities", "cache", "result"}}, ensure_ascii=False), flush=True)
            if not exact_baseline or not exact_cold:
                raise AssertionError("Original provider record set or source column types changed.")
    finally:
        engine.close()
        providers.provider_open = original
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--extension", type=Path, required=True)
    parser.add_argument("--provider", choices=("osm-buildings", "gba-usa", "all"), default="all")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for provider in (("osm-buildings", "gba-usa") if args.provider == "all" else (args.provider,)):
        run(args, provider)


if __name__ == "__main__":
    main()
