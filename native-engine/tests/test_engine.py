"""Real DuckDB Spatial, durable-task and loopback HTTP acceptance."""
import hashlib
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine import Engine
from usbf_engine.runtime import Runtime, sqlstr
from usbf_engine.server import serve
from usbf_engine.validation import normalize_spec, public_url, workspace_path


def wait(engine, task, states=("completed", "failed", "partial", "cancelled", "interrupted"), timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = engine.get_job(task["id"])
        if result["status"] in states:
            return result
        time.sleep(.04)
    raise AssertionError("Native task did not reach a terminal state: " + str(engine.get_job(task["id"])))


class NativeEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        parent = os.environ.get("USBF_ENGINE_TEST_DIR")
        cls.base = tempfile.TemporaryDirectory(prefix="usbf-engine-tests-", dir=parent)
        cls.extension = os.environ.get("USBF_SPATIAL_EXTENSION")
        if not cls.extension:
            runtime = Runtime(Path(cls.base.name) / "extension-runtime")
            runtime.information()
            cls.extension = str(next(runtime.extension_dir.rglob("spatial.duckdb_extension")))

    @classmethod
    def tearDownClass(cls):
        cls.base.cleanup()

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix="case-", dir=self.base.name)
        self.root = Path(self.folder.name)
        self.engine = Engine(self.root, extension_path=self.extension)

    def tearDown(self):
        self.engine.close()
        self.folder.cleanup()

    def parquet(self, name="input.parquet", count=3, shift=0):
        path = self.root / "Files" / name
        with self.engine.runtime.connection() as c:
            c.execute("COPY (SELECT 9007199254740993123::BIGINT AS big_id,i::BIGINT AS source_row,false AS flag,NULL::DOUBLE AS missing,ST_Point(-77 + ? + i*.0001,39) AS geometry FROM range(?) t(i)) TO " + sqlstr(path) + " (FORMAT PARQUET)", [shift, count])
        return path

    def spec(self, **extra):
        return {"schema": 1, "operation": "load", "inputs": [{"kind": "file", "path": "Files/input.parquet", "crs": "EPSG:4326"}], **extra}

    def test_real_geoparquet_preserves_types_and_rows(self):
        self.parquet()
        task = wait(self.engine, self.engine.create_job(self.spec(inputContract={"mode": "selection", "selectedSourceRows": [2, 3]})))
        self.assertEqual(task["status"], "completed", task["error"])
        self.assertEqual(task["result"]["rows"], 3)
        self.assertTrue(task["coverage"]["requestComplete"])
        preview = self.engine.preview(task["id"])
        self.assertEqual(preview["features"][0]["properties"]["big_id"], "9007199254740993123")
        self.assertIs(preview["features"][0]["properties"]["flag"], False)
        self.assertIsNone(preview["features"][0]["properties"]["missing"])
        with self.engine.runtime.connection() as c:
            self.assertEqual(c.execute("SELECT big_id FROM read_parquet(?) LIMIT 1", [str(self.engine.result_path(task["id"]))]).fetchone()[0], 9007199254740993123)
            self.assertTrue(c.execute("SELECT value FROM parquet_kv_metadata(?) WHERE key='geo'", [str(self.engine.result_path(task["id"]))]).fetchone())
        receipt = json.loads(self.engine.result_path(task["id"], "metadata").read_text())
        self.assertEqual(receipt["inputContract"]["selectedSourceRows"], [2, 3])
        self.assertEqual(receipt["sha256"], task["result"]["sha256"])
        self.assertEqual(self.engine.stat_file(task["result"]["path"])["sha256"], task["result"]["sha256"])

    def test_more_than_browser_budget_with_bounded_preview_and_table(self):
        self.parquet(count=25001)
        task = wait(self.engine, self.engine.create_job(self.spec()))
        self.assertEqual(task["status"], "completed", task["error"])
        self.assertEqual(task["result"]["rows"], 25001)
        preview = self.engine.preview(task["id"], 99999)
        self.assertEqual(len(preview["features"]), 2000)
        self.assertTrue(preview["provenance"]["limited"])
        page = self.engine.table(task["id"], offset=24000, limit=99999)
        self.assertEqual(len(page["rows"]), 1000)
        self.assertEqual(page["rows"][0]["properties"]["source_row"], 24000)

    def test_exact_intersection_retains_complete_geometry(self):
        data = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"id": "whole"}, "geometry": {"type": "Polygon", "coordinates": [[[-77, 39], [-76, 39], [-76, 40], [-77, 40], [-77, 39]]]}}]}
        scope = {"crs": "EPSG:4326", "label": "Corner", "geometry": {"type": "Polygon", "coordinates": [[[-77.1, 38.9], [-76.9, 38.9], [-76.9, 39.1], [-77.1, 39.1], [-77.1, 38.9]]]}}
        task = wait(self.engine, self.engine.create_job({"schema": 1, "operation": "extract-mask", "inputs": [{"kind": "geojson", "data": data}], "scope": scope}))
        self.assertEqual(task["status"], "completed", task["error"])
        self.assertEqual(self.engine.preview(task["id"])["features"][0]["geometry"], data["features"][0]["geometry"])

    def test_partial_resume_retains_successful_parts_after_restart(self):
        first = self.parquet("first.parquet", 4)
        second = self.parquet("second.parquet", 2, .01)
        sources = [first, second]
        calls = []
        failing = {"enabled": True}
        def download(part, destination, job_id):
            index = int(part["url"].split("/")[-1].split(".")[0])
            calls.append(index)
            if index == 1 and failing["enabled"]:
                raise OSError("Simulated source interruption")
            destination.write_bytes(sources[index].read_bytes())
        self.engine.downloader = download
        inputs = [{"kind": "url", "url": "https://data.source.coop/test/" + str(i) + ".parquet", "format": "geoparquet", "sha256": hashlib.sha256(f.read_bytes()).hexdigest(), "bytes": f.stat().st_size, "rows": 4 if i == 0 else 2, "crs": "EPSG:4326"} for i, f in enumerate(sources)]
        task = wait(self.engine, self.engine.create_job({"schema": 1, "operation": "merge", "inputs": inputs}))
        self.assertEqual(task["status"], "partial")
        self.assertEqual(task["progress"]["completedParts"], 1)
        self.assertIsNone(task["result"])
        self.assertFalse(task["coverage"]["requestComplete"])
        first_hash = task["parts"][0]["checkpointSha256"]
        self.engine.close()
        self.engine = Engine(self.root, extension_path=self.extension, downloader=download)
        failing["enabled"] = False
        self.engine.resume(task["id"])
        final = wait(self.engine, task)
        self.assertEqual(final["status"], "completed", final["error"])
        self.assertEqual(final["result"]["rows"], 6)
        self.assertEqual(final["parts"][0]["checkpointSha256"], first_hash)
        self.assertEqual(calls.count(0), 1)
        self.assertEqual(calls.count(1), 2)

    def test_bad_source_checksum_never_publishes_complete_result(self):
        file = self.parquet()
        self.engine.downloader = lambda part, path, job: path.write_bytes(file.read_bytes())
        # Recheck is also required for injected transport implementations.
        task = self.engine.create_job({"schema": 1, "operation": "load", "inputs": [{"kind": "url", "url": "https://data.source.coop/test/a.parquet", "format": "geoparquet", "sha256": "0" * 64, "bytes": file.stat().st_size, "crs": "EPSG:4326"}]})
        task = wait(self.engine, task)
        self.assertEqual(task["status"], "failed")
        self.assertIsNone(task["result"])

    def test_changed_local_source_is_not_silently_used_on_resume(self):
        file = self.parquet()
        self.engine.close()
        self.engine = Engine(self.root, extension_path=self.extension, autostart=False)
        task = self.engine.create_job(self.spec())
        file.write_bytes(b"changed")
        self.engine._execute(self.engine.get_job(task["id"]))
        final = self.engine.get_job(task["id"])
        self.assertEqual(final["status"], "failed")
        self.assertIn("changed", final["parts"][0]["error"])

    def test_buffer_rejects_degrees_and_preserves_source_attributes(self):
        self.parquet(count=1)
        with self.assertRaises(ValueError):
            self.engine.plan(self.spec(operation="buffer", parameters={"distanceMetres": 100, "measurementCRS": "EPSG:4326"}))
        task = wait(self.engine, self.engine.create_job(self.spec(operation="buffer", parameters={"distanceMetres": 100, "measurementCRS": "EPSG:32618"})))
        self.assertEqual(task["status"], "completed", task["error"])
        feature = self.engine.preview(task["id"])["features"][0]
        self.assertEqual(feature["geometry"]["type"], "Polygon")
        self.assertEqual(feature["properties"]["big_id"], "9007199254740993123")

    def test_projected_geoparquet_metadata_is_honored(self):
        path = self.root / "Files" / "projected.parquet"
        with self.engine.runtime.connection() as c:
            c.execute("COPY (SELECT 1 AS id,ST_SetCRS(ST_Transform(ST_Point(-77,39),'EPSG:4326','EPSG:32618',always_xy:=true),'EPSG:32618') AS geometry) TO " + sqlstr(path) + " (FORMAT PARQUET)")
        task = wait(self.engine, self.engine.create_job({"schema": 1, "operation": "load", "inputs": [{"kind": "file", "path": "Files/projected.parquet"}]}))
        self.assertEqual(task["status"], "completed", task["error"])
        point = self.engine.preview(task["id"])["features"][0]["geometry"]["coordinates"]
        self.assertAlmostEqual(point[0], -77, places=6)
        self.assertAlmostEqual(point[1], 39, places=6)

    def test_cancelled_queue_does_not_interrupt_a_different_active_job(self):
        source = self.parquet()
        started = threading.Event()
        release = threading.Event()
        def download(part, destination, job_id):
            started.set()
            while not release.wait(.02):
                self.engine._check(job_id)
            destination.write_bytes(source.read_bytes())
        self.engine.downloader = download
        first = self.engine.create_job({"operation": "load", "inputs": [{"kind": "url", "url": "https://data.source.coop/test/a.parquet", "format": "geoparquet", "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "crs": "EPSG:4326"}]})
        self.assertTrue(started.wait(20))
        second = self.engine.create_job(self.spec())
        self.assertEqual(self.engine.cancel(second["id"])["status"], "cancelled")
        release.set()
        self.assertEqual(wait(self.engine, first)["status"], "completed")
        self.assertEqual(self.engine.get_job(second["id"])["status"], "cancelled")

    def test_active_cancellation_never_publishes_a_partial_result_and_can_resume(self):
        source = self.parquet()
        started = threading.Event()
        def download(part, destination, job_id):
            destination.write_bytes(b"partial bytes")
            started.set()
            while True:
                self.engine._check(job_id)
                time.sleep(.02)
        self.engine.downloader = download
        task = self.engine.create_job({"operation": "load", "inputs": [{"kind": "url", "url": "https://data.source.coop/test/a.parquet", "format": "geoparquet", "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "crs": "EPSG:4326"}]})
        self.assertTrue(started.wait(20))
        self.engine.cancel(task["id"])
        final = wait(self.engine, task)
        self.assertEqual(final["status"], "cancelled")
        self.assertIsNone(final["result"])
        self.assertFalse((self.root / "Results" / (task["id"] + ".parquet")).exists())
        self.engine.downloader = lambda part, destination, job_id: destination.write_bytes(source.read_bytes())
        self.engine.resume(task["id"])
        self.assertEqual(wait(self.engine, task)["status"], "completed")

    def test_receipt_recovers_atomic_output_when_job_database_lagged_publication(self):
        self.parquet()
        original = wait(self.engine, self.engine.create_job(self.spec()))
        self.assertEqual(original["status"], "completed", original["error"])
        checksum = original["result"]["sha256"]
        interrupted = dict(original, status="running", result=None)
        self.engine._save(interrupted)
        self.engine.close()
        self.engine = Engine(self.root, extension_path=self.extension)
        self.assertEqual(self.engine.get_job(original["id"])["status"], "interrupted")
        self.engine.resume(original["id"])
        recovered = wait(self.engine, original)
        self.assertEqual(recovered["status"], "completed", recovered["error"])
        self.assertTrue(recovered["result"]["recovered"])
        self.assertEqual(recovered["result"]["sha256"], checksum)
        self.assertTrue(recovered["coverage"]["requestComplete"])

    def test_inline_geojson_attribute_fidelity(self):
        props = {"id": 9007199254740993123, "flag": False, "missing": None,
                 "nested": {"original": "value", "null": None}, "array": [1, 2, 3], "empty": ""}
        data = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [-77, 39]}}]}
        task = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "inline", "data": data}]}))
        self.assertEqual(task["status"], "completed", task["error"])
        actual = self.engine.preview(task["id"])["features"][0]["properties"]
        for key, value in props.items():
            self.assertEqual(actual[key], str(value) if key == "id" else value, key)

    def test_measure_collision_safe_geodesic_area_and_boundary_length(self):
        data = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"_usbf_area_m2": 17, "_usbf_length_m": 23}, "geometry": {"type": "Polygon", "coordinates": [[[-77,39],[-76.999,39],[-76.999,39.001],[-77,39.001],[-77,39]]]}}]}
        task = wait(self.engine, self.engine.create_job({"operation": "measure", "inputs": [{"kind": "inline", "data": data}]}))
        self.assertEqual(task["status"], "completed", task["error"])
        fields = self.engine.preview(task["id"])["features"][0]["properties"]
        self.assertEqual(fields["_usbf_area_m2"], 17)
        self.assertEqual(fields["_usbf_length_m"], 23)
        self.assertGreater(fields["_usbf_area_m2_2"], 9000)
        self.assertLess(fields["_usbf_area_m2_2"], 10000)
        self.assertGreater(fields["_usbf_length_m_2"], 390)
        self.assertLess(fields["_usbf_length_m_2"], 400)

    def test_empty_fixed_workset_is_complete_without_claiming_provider_coverage(self):
        task = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "inline", "data": {"type": "FeatureCollection", "features": []}}]}))
        self.assertEqual(task["status"], "completed", task["error"])
        self.assertEqual(task["result"]["rows"], 0)
        self.assertTrue(task["coverage"]["requestComplete"])
        self.assertEqual(task["coverage"]["providerCoverage"], "source-defined")

    def test_pinned_manifest_file_list_uses_scope_without_refetching_latest(self):
        source = self.parquet()
        calls = []
        def download(part, destination, job_id):
            calls.append(part["url"])
            destination.write_bytes(source.read_bytes())
        self.engine.downloader = download
        checksum = hashlib.sha256(source.read_bytes()).hexdigest()
        manifest = {"kind": "usbf", "manifestUrl": "https://data.source.coop/mutable-latest-manifest.json", "manifestSha256": "f" * 64, "releaseId": "fixed-release", "files": [
            {"path": "outside.parquet", "url": "https://data.source.coop/test/outside.parquet", "sha256": checksum, "rows": 3, "bytes": source.stat().st_size, "bbox": [-100,35,-99,36]},
            {"path": "inside.parquet", "url": "https://data.source.coop/test/inside.parquet", "sha256": checksum, "rows": 3, "bytes": source.stat().st_size, "bbox": [-77.1,38.9,-76.9,39.1]}]}
        scope = {"crs": "EPSG:4326", "geometry": {"type": "Polygon", "coordinates": [[[-77.1,38.9],[-76.9,38.9],[-76.9,39.1],[-77.1,39.1],[-77.1,38.9]]]}}
        task = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [manifest], "scope": scope}))
        self.assertEqual(task["status"], "completed", task["error"])
        self.assertEqual(calls, ["https://data.source.coop/test/inside.parquet"])
        self.assertEqual(task["result"]["rows"], 3)
        self.assertEqual(task["parts"][0]["sourceRelease"]["manifestSha256"], "f" * 64)

    def test_import_collision_and_workspace_escape_guards(self):
        data = {"type": "FeatureCollection", "features": []}
        a = self.engine.import_geojson("Same.geojson", data)
        b = self.engine.import_geojson("Same.geojson", data)
        self.assertNotEqual(a["path"], b["path"])
        for name in ("../outside.geojson", "CON.geojson", "file:stream.geojson"):
            with self.assertRaises(ValueError): self.engine.import_geojson(name, data)
        with self.assertRaises(ValueError): workspace_path(self.root, "Files/../../outside.parquet")
        if os.name != "nt":
            (self.root / "Files" / "escape").symlink_to(self.root.parent)
            with self.assertRaises(ValueError): workspace_path(self.root, "Files/escape/outside.parquet", exists=False)
        for url in ("http://data.source.coop/a.parquet", "https://127.0.0.1/a.parquet", "https://u:password@data.source.coop/a.parquet", "https://unknown.invalid/a.parquet"):
            with self.assertRaises(ValueError): public_url(url, resolve=False)

    def test_pairing_code_single_use_unpair_and_status(self):
        code = self.engine.pairing_code()
        token = self.engine.pair(code)["token"]
        self.assertTrue(self.engine.authorized(token))
        with self.assertRaises(PermissionError): self.engine.pair(code)
        self.engine.unpair(token)
        self.assertFalse(self.engine.authorized(token))
        status = self.engine.status()
        self.assertGreater(status["hardware"]["memoryBytes"], 0)
        self.assertEqual(status["runtime"]["duckdb"], "2.0.0")
        self.assertFalse(status["capabilities"]["uninstallRequest"])
        events = []
        self.engine.set_uninstall_handler(lambda: events.append("requested"))
        self.engine.request_uninstall()
        self.assertEqual(events, ["requested"])
        self.assertTrue((self.root / "Projects").is_dir())

    def test_http_origin_auth_pair_and_cors(self):
        server = serve(self.engine, port=0, origins=["https://feng96.github.io"])
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        address = "http://127.0.0.1:" + str(server.server_port)
        def request(path, body=None, token=None, origin="https://feng96.github.io", method=None, extra=None):
            headers = {"Origin": origin}
            if token: headers["Authorization"] = "Bearer " + token
            if body is not None: headers["Content-Type"] = "application/json"
            headers.update(extra or {})
            data = json.dumps(body).encode() if body is not None else None
            req = urllib.request.Request(address + path, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=30) as r: return r.status, r.headers, r.read()
            except urllib.error.HTTPError as e: return e.code, e.headers, e.read()
        try:
            self.assertEqual(request("/v1/health")[0], 200)
            self.assertEqual(request("/v1/status")[0], 401)
            self.assertEqual(request("/v1/health", origin="https://evil.example")[0], 403)
            code = self.engine.pairing_code()
            status, headers, body = request("/v1/pair", {"code": code})
            token = json.loads(body)["token"]
            self.assertEqual(status, 200)
            self.assertEqual(headers.get("Access-Control-Allow-Origin"), "https://feng96.github.io")
            self.assertEqual(request("/v1/status", token=token)[0], 200)
            self.assertEqual(request("/v1/health", extra={"Host": "evil.example"})[0], 403)
            status, headers, _ = request("/v1/jobs", method="OPTIONS", extra={"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
            self.assertEqual(status, 204)
            self.assertEqual(headers.get("Access-Control-Allow-Private-Network"), "true")
            self.assertEqual(request("/v1/unpair", {}, token)[0], 200)
            self.assertEqual(request("/v1/status", token=token)[0], 401)
        finally:
            server.shutdown();server.server_close();thread.join(5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
