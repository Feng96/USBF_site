"""The desktop launcher uses the same Engine/serve API as this local CLI."""
import argparse
import signal
import threading
from pathlib import Path

from .engine import Engine
from .server import serve


def main():
    parser = argparse.ArgumentParser(description="USBF local native engine")
    parser.add_argument("--workspace", default=str(Path.home() / "Documents" / "USBF"))
    parser.add_argument("--port", type=int, default=52763)
    parser.add_argument("--allow-origin", action="append", default=[])
    parser.add_argument("--extension")
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--memory-limit", default="1GB")
    parser.add_argument("--no-extension-install", action="store_true")
    args = parser.parse_args()
    engine = Engine(args.workspace, extension_path=args.extension, threads=args.threads,
                    memory_limit=args.memory_limit, allow_install=not args.no_extension_install)
    server = serve(engine, args.port, ["https://feng96.github.io", *args.allow_origin])
    # This code is local-only output, never returned by an HTTP endpoint.
    print("USBF local engine: http://127.0.0.1:" + str(server.server_port), flush=True)
    print("Pairing code (expires after 3 minutes): " + engine.pairing_code(), flush=True)
    def stop(*_):
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        engine.close()


if __name__ == "__main__":
    main()
