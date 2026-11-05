"""Isolated real-provider HTTP service for browser acceptance; never seeds results."""
import argparse
import json
import os
from pathlib import Path
import signal
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-engine"))
from usbf_engine import Engine
from usbf_engine.server import serve

parser = argparse.ArgumentParser()
parser.add_argument("workspace")
parser.add_argument("receipt")
parser.add_argument("--origin", default="http://127.0.0.1:52787")
args = parser.parse_args()
engine = Engine(args.workspace, extension_path=os.environ["USBF_SPATIAL_EXTENSION"],
                threads=1, memory_limit="512MB", allow_install=False)
server = serve(engine, port=0, origins=[args.origin])
Path(args.receipt).write_text(json.dumps({
    "endpoint": "http://127.0.0.1:" + str(server.server_port),
    "code": engine.pairing_code(), "workspaceId": engine.workspace_id,
}), encoding="utf-8")

def stop(*_):
    threading.Thread(target=server.shutdown, daemon=True).start()

signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
print("ISOLATED_PROVIDER_SERVICE_READY", flush=True)
try:
    server.serve_forever()
finally:
    server.server_close()
    engine.close()
