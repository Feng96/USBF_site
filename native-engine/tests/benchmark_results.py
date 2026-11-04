"""Opt-in actual 100k/1m full-result benchmark; all artifacts stay in scratch.

Run with --root pointing at a large local/scratch filesystem, never HOME/NFS.
Timings are measurements on the executing hardware, not product promises.
"""
import argparse
import json
import os
import sys
import tempfile
import threading
import time
from pathlib import Path

import psutil

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from usbf_engine import Engine
from usbf_engine.runtime import sqlstr
from test_results import vector_tile, xyz


def run(parent, count, extension):
    folder = Path(tempfile.mkdtemp(prefix="results-" + str(count) + "-", dir=parent))
    process = psutil.Process()
    peak = {"rss": process.memory_info().rss}
    stop = threading.Event()
    def sample():
        while not stop.wait(.05):
            peak["rss"] = max(peak["rss"], process.memory_info().rss)
    thread = threading.Thread(target=sample, daemon=True)
    thread.start()
    engine = Engine(folder, extension_path=extension, memory_limit="512MB")
    engine.maintenance.configure({"memoryMiB": 512})
    times = {}
    try:
        path = folder / "Files" / "buildings.parquet"
        stamp = time.perf_counter()
        with engine.runtime.connection() as c:
            c.execute("COPY (SELECT i::BIGINT AS source_row,9007199254740993123::BIGINT AS original_id,(i%100)::DOUBLE AS height,ST_SetCRS(ST_MakeEnvelope(-77+(i%1000)*.0002,39+floor(i/1000)*.0002,-77+(i%1000)*.0002+.0001,39+floor(i/1000)*.0002+.0001),'EPSG:4326') AS geometry FROM range(?) t(i)) TO " + sqlstr(path) + " (FORMAT PARQUET,COMPRESSION ZSTD)", [count])
        times["fixtureSeconds"] = time.perf_counter() - stamp
        stamp = time.perf_counter()
        job = engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": "Files/buildings.parquet"}]})
        while True:
            job = engine.get_job(job["id"])
            if job["status"] in {"completed", "failed", "partial", "cancelled", "interrupted"}:
                break
            time.sleep(.025)
        if job["status"] != "completed" or job["result"]["rows"] != count:
            raise AssertionError(job)
        times["nativeLoadSeconds"] = time.perf_counter() - stamp
        stamp = time.perf_counter()
        info = engine.result_map(job["id"])
        assert info["recordCount"] == count
        times["coldIndexSeconds"] = time.perf_counter() - stamp
        stamp = time.perf_counter()
        low = engine.result_tile(job["id"], 0, 0, 0)
        cluster_sum = sum(item["properties"]["count"] for item in vector_tile(low)["clusters"])
        assert cluster_sum == count, (cluster_sum, count)
        times["lowZoomColdSeconds"] = time.perf_counter() - stamp
        stamp = time.perf_counter()
        assert engine.result_tile(job["id"], 0, 0, 0) == low
        times["lowZoomCachedSeconds"] = time.perf_counter() - stamp
        longitude, latitude = -77 + ((count - 1) % 1000) * .0002 + .00005, 39 + ((count - 1) // 1000) * .0002 + .00005
        x, y = xyz(longitude, latitude, 18)
        stamp = time.perf_counter()
        detail = engine.result_tile(job["id"], 18, x, y)
        assert any(item["properties"]["nativeId"] == job["id"] + ":" + str(count - 1) for item in vector_tile(detail)["buildings"])
        times["detailTileSeconds"] = time.perf_counter() - stamp
        stamp = time.perf_counter()
        queried = engine.result_query(job["id"], {"filters": [{"field": "source_row", "op": "gte", "value": count - 10000}], "sort": {"field": "source_row", "direction": "desc"}, "limit": 100})
        assert queried["total"] == 10000
        assert queried["rows"][0]["properties"]["source_row"] == count - 1
        times["fullQuerySortSeconds"] = time.perf_counter() - stamp
        stamp = time.perf_counter()
        selected = engine.result_selection(job["id"], {"query": {"filters": [{"field": "source_row", "op": "gte", "value": count - 10000}]}})
        assert selected["count"] == 10000
        times["selectTenThousandSeconds"] = time.perf_counter() - stamp
        stamp = time.perf_counter()
        full = engine.result_feature(job["id"], count - 1)
        assert full["properties"]["original_id"] == "9007199254740993123"
        times["fullFeatureSeconds"] = time.perf_counter() - stamp
        return {"records": count, "workspace": str(folder), "timings": times,
                "allRecordsInClusterCounts": cluster_sum, "detailLastRowFound": True,
                "selectionCount": selected["count"], "sourceBytes": path.stat().st_size,
                "indexBytes": sum(file.stat().st_size for file in (folder / "Cache" / "native-results").rglob("*") if file.is_file()),
                "lowTileBytes": len(low), "detailTileBytes": len(detail), "peakProcessRSSBytes": peak["rss"],
                "duckdbMemoryLimit": engine.runtime.memory_limit, "threads": engine.runtime.threads}
    finally:
        engine.close()
        stop.set()
        thread.join(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--rows", type=int, nargs="+", default=[100000, 1000000])
    args = parser.parse_args()
    root = Path(args.root)
    root.mkdir(parents=True, exist_ok=True)
    results = []
    for count in args.rows:
        if count < 2501 or count > 10000000:
            raise ValueError("Choose benchmark counts between 2,501 and 10 million")
        results.append(run(root, count, os.environ.get("USBF_SPATIAL_EXTENSION")))
        Path(args.output).write_text(json.dumps({"results": results}, indent=2), encoding="utf-8")
        print(json.dumps(results[-1]), flush=True)
