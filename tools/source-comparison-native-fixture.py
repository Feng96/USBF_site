"""Local-only full-result fixture service for source-comparison browser checks."""
import argparse
import json
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-engine"))
from usbf_engine import Engine
from usbf_engine.runtime import sqlstr
from usbf_engine.server import serve

parser = argparse.ArgumentParser()
parser.add_argument("workspace")
parser.add_argument("receipt")
args = parser.parse_args()
engine = Engine(args.workspace, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"))
with engine.runtime.connection() as c:
    path = engine.workspace / "Files" / "comparison-buildings.parquet"
    c.execute("COPY (SELECT i AS original_row,CASE WHEN i%4=0 THEN 12 ELSE NULL END::DOUBLE AS height,"
              "ST_SetCRS(ST_MakeEnvelope(-77+(i%100)*.0002,39+floor(i/100)*.0002,"
              "-77+(i%100)*.0002+.0001,39+floor(i/100)*.0002+.0001),'EPSG:4326') AS geometry "
              "FROM range(2507) t(i)) TO " + sqlstr(path) + " (FORMAT PARQUET)")
job = engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": "Files/comparison-buildings.parquet"}]})
while job["status"] not in {"completed", "partial", "failed"}:
    time.sleep(.05)
    job = engine.get_job(job["id"])
if job["status"] != "completed":
    raise RuntimeError(job)
server = serve(engine, port=0, origins=["http://127.0.0.1:52781"])
Path(args.receipt).write_text(json.dumps({"endpoint": "http://127.0.0.1:" + str(server.server_port), "code": engine.pairing_code(), "workspaceId": engine.workspace_id, "job": job}), encoding="utf-8")
try:
    server.serve_forever()
finally:
    server.server_close()
    engine.close()
