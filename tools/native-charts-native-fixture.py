"""Real local Engine fixture; chart aggregates are never replaced by test responses."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-engine"))
from usbf_engine import Engine
from usbf_engine.runtime import sqlstr
from usbf_engine.server import serve

parser = argparse.ArgumentParser()
parser.add_argument("workspace")
parser.add_argument("receipt")
parser.add_argument("--origin", required=True)
args = parser.parse_args()
receipt = Path(args.receipt)
control = receipt.with_name(receipt.stem + "-control.json")
gate = receipt.with_name(receipt.stem + "-gate.json")


def write_json(target, value):
    temporary = target.with_suffix(target.suffix + ".tmp")
    temporary.write_text(json.dumps(value), encoding="utf-8")
    temporary.replace(target)


class FixtureEngine(Engine):
    def controls(self):
        try:
            return json.loads(control.read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def status(self):
        value = super().status()
        if self.controls().get("legacy"):
            value["capabilities"].pop("resultCharts", None)
        return value

    def result_chart(self, job_id, value):
        # A gate gives the browser time to cancel a genuine outstanding request.
        # The real cancel registry and result_chart still decide its outcome.
        delay = self.controls().get("delaySeconds", 0)
        if delay and value.get("kind") != "schema":
            write_json(gate, {"jobId": job_id, "requestId": value.get("requestId"), "waiting": True})
            until = time.monotonic() + min(float(delay), 30)
            while time.monotonic() < until:
                with self.mutex:
                    stopped = (job_id, value.get("requestId")) in getattr(self, "_chart_cancelled", {})
                if stopped:
                    break
                time.sleep(.02)
            write_json(gate, {"jobId": job_id, "requestId": value.get("requestId"), "waiting": False})
        return super().result_chart(job_id, value)


engine = FixtureEngine(args.workspace, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"))
source = engine.workspace / "Files" / "chart-buildings.parquet"
with engine.runtime.connection() as connection:
    connection.execute("COPY (SELECT i AS original_row,9007199254740993123::BIGINT+i AS original_id,"
                       "CASE WHEN i%5=0 THEN NULL ELSE (i%100)-3 END::DOUBLE AS height,"
                       "CASE i%5 WHEN 0 THEN '0' WHEN 1 THEN 'false' WHEN 2 THEN NULL WHEN 3 THEN '' ELSE 'Office' END AS \"Category raw\","
                       "0::INTEGER AS zero,false AS flag,NULL::VARCHAR AS missing,''::VARCHAR AS empty,"
                       "ST_SetCRS(ST_MakeEnvelope(-77+(i%100)*.0002,39+floor(i/100)*.0002,"
                       "-77+(i%100)*.0002+.0001,39+floor(i/100)*.0002+.0001),'EPSG:4326') AS geometry "
                       "FROM range(2507) t(i)) TO " + sqlstr(source) + " (FORMAT PARQUET)")
job = engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": "Files/chart-buildings.parquet"}]})
while job["status"] not in {"completed", "partial", "failed"}:
    time.sleep(.05)
    job = engine.get_job(job["id"])
if job["status"] != "completed":
    raise RuntimeError(job)


def expected(indices):
    groups = {}
    for i in indices:
        label = ["0", "false", None, "", "Office"][i % 5]
        height = None if i % 5 == 0 else i % 100 - 3
        group = groups.setdefault(label, {"value": label, "observations": 0, "values": []})
        group["observations"] += 1
        if height is not None:
            group["values"].append(height)
    return {"records": len(indices), "valid": sum(len(g["values"]) for g in groups.values()),
            "groups": [{"value": g["value"], "observations": g["observations"], "valid": len(g["values"]),
                        "mean": sum(g["values"]) / len(g["values"]) if g["values"] else None} for g in groups.values()]}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


server = serve(engine, port=0, origins=[args.origin])
result = engine.workspace / job["result"]["path"]
write_json(receipt, {"endpoint": "http://127.0.0.1:" + str(server.server_port), "code": engine.pairing_code(),
                              "workspaceId": engine.workspace_id, "job": job, "control": str(control), "gate": str(gate),
                              "sourcePath": str(source), "sourceSha256": sha(source), "resultPath": str(result), "resultSha256": sha(result),
                              "expected": {"all": expected(list(range(2507))), "selection": expected([2499, 2506]),
                                           "area": expected(list(range(2500, 2507))),
                                           "areaBounds": [-77.00001, 39.0049999, -76.99869, 39.00511],
                                           "lastOriginalId": str(9007199254740993123 + 2506)}})


def stop(*_):
    raise KeyboardInterrupt


signal.signal(signal.SIGTERM, stop)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
    engine.close()
