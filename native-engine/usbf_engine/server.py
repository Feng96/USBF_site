"""Small loopback HTTP transport with explicit origin and bearer boundaries."""
from __future__ import annotations

import json
import re
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .engine import VERSION
from .validation import MAX_SPEC_BYTES, json_exact


def serve(engine, port=52763, origins=None):
    allowed = set(origins or ["https://feng96.github.io"])
    if not allowed or any(not re.fullmatch(r"https?://[A-Za-z0-9.\-\[\]:]+", value) for value in allowed):
        raise ValueError("Configure exact trusted browser origins without paths or wildcards.")

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "USBFNative/0.1"

        def log_message(self, *_):
            # Do not log bearer headers, pairing codes, paths or submitted data.
            pass

        def _origin(self):
            origin = self.headers.get("Origin")
            if origin and origin not in allowed:
                raise PermissionError("This browser origin is not paired with the native engine.")
            host = self.headers.get("Host", "")
            if host not in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}:
                raise PermissionError("The native engine only accepts its loopback host.")
            return origin

        def _cors(self):
            origin = self.headers.get("Origin")
            if origin in allowed:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")

        def _json(self, status, value):
            body = json.dumps(json_exact(value), ensure_ascii=False, allow_nan=False).encode()
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _body(self):
            if self.headers.get_content_type() != "application/json":
                raise ValueError("Native requests use application/json.")
            if self.headers.get("Transfer-Encoding"):
                raise ValueError("Chunked native requests are not accepted.")
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise ValueError("The request size is invalid.")
            if not 0 < length <= MAX_SPEC_BYTES:
                raise ValueError("The request exceeds the 16 MiB native input budget.")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("The native request was incomplete.")
            return json.loads(raw)

        def _file(self, file, content_type):
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Disposition", 'attachment; filename="' + file.name + '"')
            self.send_header("Content-Length", str(file.stat().st_size))
            self.end_headers()
            with file.open("rb") as source:
                while True:
                    data = source.read(1024 * 1024)
                    if not data:
                        break
                    self.wfile.write(data)

        def _token(self):
            authorization = self.headers.get("Authorization", "")
            token = authorization[7:] if authorization.startswith("Bearer ") else ""
            if not engine.authorized(token):
                raise PermissionError("Pair this browser in the native program to continue.")

        def do_OPTIONS(self):
            try:
                self._origin()
                requested = {x.strip().lower() for x in self.headers.get("Access-Control-Request-Headers", "").split(",") if x.strip()}
                if requested - {"authorization", "content-type"}:
                    raise PermissionError("This native request header is not allowed.")
                if self.headers.get("Access-Control-Request-Method", "GET") not in {"GET", "POST"}:
                    raise PermissionError("This native request method is not allowed.")
                self.send_response(204)
                self._cors()
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Content-Length", "0")
                self.end_headers()
            except PermissionError as error:
                self._json(403, {"error": str(error)})

        def do_GET(self):
            self._handle("GET")

        def do_POST(self):
            self._handle("POST")

        def _handle(self, method):
            try:
                self._origin()
                url = urllib.parse.urlparse(self.path)
                path = url.path.rstrip("/")
                query = urllib.parse.parse_qs(url.query)
                if path == "/v1/health" and method == "GET":
                    return self._json(200, {"service": "USBF Local Engine", "version": VERSION, "apiVersion": 1, "pairingRequired": True})
                if path == "/v1/pair" and method == "POST":
                    return self._json(200, engine.pair(self._body().get("code")))
                self._token()
                if path == "/v1/status" and method == "GET":
                    return self._json(200, engine.status())
                if path == "/v1/maintenance" and method == "GET":
                    return self._json(200, engine.maintenance.status())
                if path == "/v1/maintenance/settings" and method == "POST":
                    return self._json(200, engine.maintenance.configure(self._body()))
                if path == "/v1/maintenance/cleanup" and method == "POST":
                    return self._json(200, engine.maintenance.cleanup(self._body()))
                if path == "/v1/diagnostics" and method == "GET":
                    return self._json(200, engine.maintenance.diagnostics())
                if path in {"/v1/projects/export", "/v1/projects/import", "/v1/projects/relink"} and method == "POST":
                    from .project_dependencies import export_package, import_package, relink_dependency
                    action = {"/v1/projects/export": export_package, "/v1/projects/import": import_package, "/v1/projects/relink": relink_dependency}[path]
                    return self._json(200, action(engine, self._body()))
                if path == "/v1/projects/package" and method == "GET":
                    from .project_dependencies import package_path
                    return self._file(package_path(engine, query.get("path", [""])[0]), "application/zip")
                if path == "/v1/unpair" and method == "POST":
                    if int(self.headers.get("Content-Length", "0")): self._body()
                    return self._json(200, engine.unpair(self.headers.get("Authorization", "")[7:]))
                if path == "/v1/files" and method == "GET":
                    return self._json(200, engine.files(query.get("path", ["Files"])[0]))
                if path == "/v1/files/stat" and method == "GET":
                    return self._json(200, engine.stat_file(query.get("path", [""])[0]))
                if path == "/v1/files/import" and method == "POST":
                    body = self._body()
                    return self._json(201, engine.import_geojson(body.get("name", "Browser workset.geojson"), body.get("data")))
                if path == "/v1/uninstall-request" and method == "POST":
                    if int(self.headers.get("Content-Length", "0")): self._body()
                    return self._json(202, engine.request_uninstall())
                if path == "/v1/plan" and method == "POST":
                    return self._json(200, engine.plan(self._body()))
                if path == "/v1/jobs":
                    return self._json(201, engine.create_job(self._body())) if method == "POST" else self._json(200, {"jobs": engine.jobs(summaries=True)})
                match = re.fullmatch(r"/v1/jobs/([a-f0-9-]{36})/(map|query|selection|summary|export|features/([0-9]+)|tiles/([0-9]+)/([0-9]+)/([0-9]+)\.pbf)", path)
                if match:
                    job_id, action, row_id, z, x, y = match.groups()
                    if action == "map" and method == "GET":
                        return self._json(200, engine.result_map(job_id))
                    if action == "query" and method == "POST":
                        return self._json(200, engine.result_query(job_id, self._body()))
                    if action == "selection" and method == "POST":
                        return self._json(200, engine.result_selection(job_id, self._body()))
                    if action == "summary" and method == "POST":
                        return self._json(200, engine.result_summary(job_id, self._body()))
                    if row_id is not None and method == "GET":
                        return self._json(200, engine.result_feature(job_id, row_id))
                    if z is not None and method == "GET":
                        data = engine.result_tile(job_id, int(z), int(x), int(y), query.get("selectionId", [None])[0])
                        self.send_response(200)
                        self._cors()
                        self.send_header("Content-Type", "application/vnd.mapbox-vector-tile")
                        self.send_header("Content-Length", str(len(data)))
                        self.end_headers()
                        self.wfile.write(data)
                        return
                    if action == "export" and method == "GET":
                        format = query.get("format", ["geojson"])[0]
                        file = engine.result_export(job_id, format, query.get("selectionId", [None])[0])
                        return self._file(file, {"geojson": "application/geo+json", "csv": "text/csv; charset=utf-8", "parquet": "application/vnd.apache.parquet"}[format])
                match = re.fullmatch(r"/v1/jobs/([a-f0-9-]{36})(?:/(cancel|resume|preview|table|download))?", path)
                if match:
                    job_id, action = match.groups()
                    if action is None and method == "GET":
                        return self._json(200, engine.get_job(job_id))
                    if action in {"cancel", "resume"} and method == "POST":
                        if int(self.headers.get("Content-Length", "0")): self._body()
                        return self._json(200, getattr(engine, action)(job_id))
                    if action == "preview" and method == "GET":
                        return self._json(200, engine.preview(job_id, int(query.get("limit", [2000])[0])))
                    if action == "table" and method == "GET":
                        return self._json(200, engine.table(job_id, offset=int(query.get("offset", [0])[0]), limit=int(query.get("limit", [100])[0])))
                    if action == "download" and method == "GET":
                        format = query.get("format", ["parquet"])[0]
                        if format == "geojson":
                            if (engine.get_job(job_id).get("result") or {}).get("rows", 0) > 2000:
                                raise ValueError("Download GeoParquet for full results larger than 2,000 records; the GeoJSON endpoint is a bounded preview.")
                            return self._json(200, engine.preview(job_id, 2000))
                        file = engine.result_path(job_id, format)
                        self.send_response(200)
                        self._cors()
                        self.send_header("Content-Type", "application/vnd.apache.parquet" if format == "parquet" else "application/json")
                        self.send_header("Content-Disposition", 'attachment; filename="' + file.name + '"')
                        self.send_header("Content-Length", str(file.stat().st_size))
                        self.end_headers()
                        with file.open("rb") as source:
                            while True:
                                data = source.read(1024 * 1024)
                                if not data:
                                    break
                                self.wfile.write(data)
                        return
                self._json(404, {"error": "This native API route does not exist."})
            except PermissionError as error:
                self._json(401 if "Pair this browser" in str(error) else 403, {"error": str(error)})
            except KeyError as error:
                self._json(404, {"error": str(error)})
            except (ValueError, FileNotFoundError, json.JSONDecodeError, RecursionError) as error:
                self._json(400, {"error": str(error)})
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                self._json(500, {"error": "The native request failed. Check the local task or desktop program."})

    class Server(ThreadingHTTPServer):
        daemon_threads = True
        allow_reuse_address = True

        def get_request(self):
            sock, address = super().get_request()
            sock.settimeout(30)
            return sock, address

    return Server(("127.0.0.1", int(port)), Handler)


server_main = serve
