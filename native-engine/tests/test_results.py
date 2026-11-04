"""Full-result fidelity, indexed map completeness and immutable selection tests."""
import csv
import io
import json
import math
import os
import struct
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine import Engine
from usbf_engine.runtime import Runtime, sqlstr
from usbf_engine.server import serve


def wait(engine, job):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        job = engine.get_job(job["id"])
        if job["status"] in {"completed", "failed", "partial", "cancelled", "interrupted"}:
            if job["status"] != "completed":
                raise AssertionError(job)
            return job
        time.sleep(.03)
    raise AssertionError("Native job timed out")


def protobuf(data):
    """Small independent protobuf reader for the public MVT contract."""
    position = 0
    def varint():
        nonlocal position
        value, shift = 0, 0
        while True:
            byte = data[position]
            position += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
            shift += 7
    while position < len(data):
        key = varint()
        field, wire = key >> 3, key & 7
        if wire == 0:
            value = varint()
        elif wire == 2:
            length = varint()
            value = data[position:position + length]
            position += length
        elif wire == 1:
            value = struct.unpack("<d", data[position:position + 8])[0]
            position += 8
        elif wire == 5:
            value = struct.unpack("<f", data[position:position + 4])[0]
            position += 4
        else:
            raise AssertionError("Unexpected protobuf wire type")
        yield field, wire, value


def vector_tile(data):
    layers = {}
    for field, _, raw_layer in protobuf(data):
        if field != 3:
            continue
        records = list(protobuf(raw_layer))
        name = next(value.decode() for key, _, value in records if key == 1)
        keys = [value.decode() for key, _, value in records if key == 3]
        values = []
        for key, _, value in records:
            if key == 4:
                item = next(iter(protobuf(value)))[2]
                values.append(item.decode() if isinstance(item, bytes) else item)
        features = []
        for key, _, value in records:
            if key != 2:
                continue
            item = {"properties": {}}
            for feature_key, _, feature_value in protobuf(value):
                if feature_key == 1:
                    item["id"] = feature_value
                elif feature_key == 2:
                    # packed uint32 tags: wrapping each integer as a field-1
                    # varint lets the same independent primitive decode it.
                    tags, position = [], 0
                    while position < len(feature_value):
                        number, shift = 0, 0
                        while True:
                            byte = feature_value[position]
                            position += 1
                            number |= (byte & 127) << shift
                            if byte < 128:
                                break
                            shift += 7
                        tags.append(number)
                    item["properties"] = {keys[tags[i]]: values[tags[i + 1]] for i in range(0, len(tags), 2)}
            features.append(item)
        layers[name] = features
    return layers


def xyz(lon, lat, zoom):
    n = 2**zoom
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


class CompleteResultTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parent = tempfile.TemporaryDirectory(prefix="usbf-complete-results-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        cls.extension = os.environ.get("USBF_SPATIAL_EXTENSION")
        if not cls.extension:
            runtime = Runtime(Path(cls.parent.name) / "extension")
            runtime.information()
            cls.extension = str(next(runtime.extension_dir.rglob("spatial.duckdb_extension")))

    @classmethod
    def tearDownClass(cls):
        cls.parent.cleanup()

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(dir=self.parent.name)
        self.root = Path(self.folder.name)
        self.engine = Engine(self.root, extension_path=self.extension)

    def tearDown(self):
        self.engine.close()
        self.folder.cleanup()

    def fixture(self, count=2501):
        path = self.root / "Files" / "buildings.parquet"
        with self.engine.runtime.connection() as c:
            c.execute("COPY (SELECT i::BIGINT AS source_row,9007199254740993123::BIGINT AS original_id,false AS flag,0::INTEGER AS zero,CASE WHEN i%3=0 THEN NULL ELSE i*.5 END AS height,'Building '||i AS name,ST_SetCRS(ST_MakeEnvelope(-77+(i%100)*.0002,39+floor(i/100)*.0002,-77+(i%100)*.0002+.0001,39+floor(i/100)*.0002+.0001),'EPSG:4326') AS geometry FROM range(?) t(i)) TO " + sqlstr(path) + " (FORMAT PARQUET)", [count])
        self.job = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": "Files/buildings.parquet"}]}))
        self.job_id = self.job["id"]
        return self.job

    def test_complete_map_and_feature_outside_bounded_preview(self):
        self.fixture()
        self.assertEqual(len(self.engine.preview(self.job_id)["features"]), 2000)
        info = self.engine.result_map(self.job_id)
        self.assertEqual(info["recordCount"], 2501)
        original = self.engine.result_feature(self.job_id, 2500)
        self.assertEqual(original["properties"]["source_row"], 2500)
        self.assertEqual(original["properties"]["original_id"], "9007199254740993123")
        self.assertIs(original["properties"]["flag"], False)
        self.assertEqual(original["properties"]["zero"], 0)
        low = vector_tile(self.engine.result_tile(self.job_id, 0, 0, 0))
        self.assertEqual(sum(feature["properties"]["count"] for feature in low["clusters"]), 2501)
        x, y = xyz(-77.0, 39.005, 18)
        high = vector_tile(self.engine.result_tile(self.job_id, 18, x, y))
        self.assertTrue(any(feature["properties"].get("nativeId") == self.job_id + ":2500" for feature in high["buildings"]))
        self.assertIn("height", info["displayFields"])
        last = next(feature for feature in high["buildings"] if feature["properties"].get("nativeId") == self.job_id + ":2500")
        self.assertEqual(last["properties"]["height"], 1250)

    def test_style_fields_are_bounded_without_changing_original_attributes(self):
        properties = {"height_m": 27.5, "bf_source": "OSM", "SOURCE": "x" * 129, "modified": True, "original_id": "9007199254740993123", "unrelated": "not included in tiles"}
        data = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": properties, "geometry": {"type": "Point", "coordinates": [-77, 39]}}]}
        job = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "geojson", "data": data}]}))
        x, y = xyz(-77, 39, 18)
        tile = vector_tile(self.engine.result_tile(job["id"], 18, x, y))
        rendered = tile["buildings"][0]["properties"]
        self.assertEqual(rendered["height_m"], 27.5)
        self.assertEqual(rendered["bf_source"], "OSM")
        self.assertTrue(rendered["modified"])
        self.assertNotIn("SOURCE", rendered)
        self.assertNotIn("original_id", rendered)
        self.assertNotIn("unrelated", rendered)
        self.assertEqual(self.engine.result_feature(job["id"], 0)["properties"], properties)

    def test_attribute_query_search_sort_and_selection_highlight(self):
        self.fixture()
        selected = self.engine.result_selection(self.job_id, {"query": {"filters": [{"field": "source_row", "op": "gte", "value": 2490}]}})
        page = self.engine.result_query(self.job_id, {"offset": 0, "limit": 2, "sort": {"field": "source_row", "direction": "desc"}, "highlightSelectionId": selected["selectionId"]})
        self.assertEqual(page["total"], 2501)
        self.assertEqual(page["rows"][0]["properties"]["source_row"], 2500)
        self.assertIs(page["rows"][0]["selected"], True)
        page = self.engine.result_query(self.job_id, {"selectionId": selected["selectionId"], "search": "Building 2499"})
        self.assertEqual(page["total"], 1)
        self.assertEqual(page["rows"][0]["id"], self.job_id + ":2499")
        exact = self.engine.result_query(self.job_id, {"filters": [{"field": "original_id", "op": "eq", "value": "9007199254740993123"}]})
        self.assertEqual(exact["total"], 2501)
        with self.assertRaises(ValueError):
            self.engine.result_query(self.job_id, {"filters": [{"field": "name;DROP TABLE features", "op": "eq", "value": "x"}]})
        injection = self.engine.result_query(self.job_id, {"filters": [{"field": "name", "op": "eq", "value": "' OR true --"}]})
        self.assertEqual(injection["total"], 0)

    def test_immutable_selection_set_operations_and_full_processing(self):
        self.fixture()
        base = self.engine.result_selection(self.job_id, {"ids": [self.job_id + ":2499", self.job_id + ":2500"]})
        added = self.engine.result_selection(self.job_id, {"mode": "add", "baseSelectionId": base["selectionId"], "ids": [self.job_id + ":0"]})
        self.assertEqual(added["count"], 3)
        self.assertEqual(self.engine.result_query(self.job_id, {"selectionId": base["selectionId"]})["total"], 2)
        removed = self.engine.result_selection(self.job_id, {"mode": "remove", "baseSelectionId": added["selectionId"], "ids": [self.job_id + ":0"]})
        self.assertEqual(removed["count"], 2)
        intersect = self.engine.result_selection(self.job_id, {"mode": "intersect", "baseSelectionId": added["selectionId"], "ids": [self.job_id + ":0", self.job_id + ":2500"]})
        self.assertEqual(intersect["count"], 2)
        inverse = self.engine.result_selection(self.job_id, {"mode": "invert", "baseSelectionId": base["selectionId"]})
        self.assertEqual(inverse["count"], 2499)
        job = wait(self.engine, self.engine.create_job({"operation": "measure", "inputs": [{"kind": "native-selection", "jobId": self.job_id, "selectionId": base["selectionId"]}]}))
        self.assertEqual(job["result"]["rows"], 2)
        self.assertEqual([feature["properties"]["source_row"] for feature in self.engine.preview(job["id"])["features"]], [2499, 2500])
        self.assertEqual(self.engine.result_selection(self.job_id, {"mode": "clear"})["count"], 0)

    def test_spatial_selection_includes_touching_and_crossing_whole_geometry(self):
        data = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"id": "crosses"}, "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]}}, {"type": "Feature", "properties": {"id": "touches"}, "geometry": {"type": "Point", "coordinates": [2.1, 2.1]}}]}
        job = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "geojson", "data": data}]}))
        scope = {"crs": "EPSG:4326", "geometry": {"type": "Polygon", "coordinates": [[[1.9, 1.9], [2.1, 1.9], [2.1, 2.1], [1.9, 2.1], [1.9, 1.9]]]}}
        selected = self.engine.result_selection(job["id"], {"scope": scope})
        self.assertEqual(selected["count"], 2)
        self.assertEqual(self.engine.result_feature(job["id"], 0)["geometry"], data["features"][0]["geometry"])

    def test_select_matching_records_cannot_escape_fixed_area_snapshot(self):
        self.fixture()
        scope = {"crs": "EPSG:4326", "geometry": {"type": "Polygon", "coordinates": [[[-77.0001, 38.9999], [-76.99959, 38.9999], [-76.99959, 39.00011], [-77.0001, 39.00011], [-77.0001, 38.9999]]]}}
        area = self.engine.result_selection(self.job_id, {"scope": scope})
        self.assertEqual(area["count"], 3)
        matches = self.engine.result_selection(self.job_id, {"query": {"selectionId": area["selectionId"], "filters": [{"field": "source_row", "op": "gte", "value": 1}]}})
        self.assertEqual(matches["count"], 2)
        page = self.engine.result_query(self.job_id, {"selectionId": matches["selectionId"]})
        self.assertEqual([row["properties"]["source_row"] for row in page["rows"]], [1, 2])

    def test_full_exports_exact_values_and_selection(self):
        self.fixture()
        selected = self.engine.result_selection(self.job_id, {"query": {"filters": [{"field": "source_row", "op": "gte", "value": 2490}]}})
        exported = json.loads(self.engine.result_export(self.job_id, "geojson", selected["selectionId"]).read_text())
        self.assertEqual(len(exported["features"]), 11)
        self.assertEqual(exported["features"][-1]["properties"]["original_id"], "9007199254740993123")
        rows = list(csv.DictReader(io.StringIO(self.engine.result_export(self.job_id, "csv").read_text())))
        self.assertEqual(len(rows), 2501)
        self.assertEqual(rows[-1]["original_id"], "9007199254740993123")
        self.assertEqual(rows[-1]["flag"], "false")
        path = self.engine.result_export(self.job_id, "parquet", selected["selectionId"])
        with self.engine.runtime.connection() as c:
            self.assertEqual(c.execute("SELECT count(*) FROM read_parquet(?)", [str(path)]).fetchone()[0], 11)

    def test_summary_uses_complete_records_and_missing_counts(self):
        self.fixture()
        summary = self.engine.result_summary(self.job_id, {"field": "height"})
        self.assertEqual(summary["records"], 2501)
        self.assertEqual(summary["missing"], 834)
        self.assertEqual(float(summary["max"]), 1250)
        selected = self.engine.result_selection(self.job_id, {"ids": [self.job_id + ":0", self.job_id + ":2500"]})
        summary = self.engine.result_summary(self.job_id, {"field": "height", "selectionId": selected["selectionId"]})
        self.assertEqual(summary["records"], 2)
        self.assertEqual(summary["missing"], 1)

    def test_positive_height_summary_retains_original_nonpositive_values(self):
        data = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"height": height}, "geometry": {"type": "Point", "coordinates": [-77, 39]}} for height in [-999, 0, None, 10]]}
        job = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "geojson", "data": data}]}))
        summary = self.engine.result_summary(job["id"], {"field": "height", "positiveOnly": True})
        self.assertEqual(summary["records"], 4)
        self.assertEqual(summary["valid"], 1)
        self.assertEqual(summary["missing"], 3)
        self.assertEqual(float(summary["mean"]), 10)
        self.assertEqual(summary["valueRule"], "positive-finite-values")
        generic = self.engine.result_summary(job["id"], {"field": "height"})
        self.assertEqual(generic["valid"], 3)
        self.assertEqual(generic["min"], -999)
        self.assertEqual(self.engine.result_feature(job["id"], 0)["properties"]["height"], -999)

    def test_empty_complete_result_has_index_and_table_without_preview_rows(self):
        self.fixture(count=1)
        scope = {"crs": "EPSG:4326", "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}}
        empty = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": self.job["result"]["path"]}], "scope": scope}))
        self.assertEqual(empty["result"]["rows"], 0)
        self.assertTrue(empty["coverage"]["requestComplete"])
        self.assertEqual(self.engine.preview(empty["id"])["features"], [])
        self.assertEqual(self.engine.result_map(empty["id"])["recordCount"], 0)
        self.assertIsNone(self.engine.result_map(empty["id"])["bounds"])
        page = self.engine.result_query(empty["id"], {})
        self.assertEqual(page["total"], 0)
        self.assertEqual(page["rows"], [])
        self.assertEqual(self.engine.result_tile(empty["id"], 0, 0, 0), b"")
        summary = self.engine.result_summary(empty["id"], {"field": "source_row"})
        self.assertEqual(summary["records"], 0)
        self.assertEqual(summary["valid"], 0)
        self.assertIsNone(summary["mean"])
        self.assertEqual(json.loads(self.engine.result_export(empty["id"], "geojson").read_text())["features"], [])
        self.assertEqual(list(csv.DictReader(io.StringIO(self.engine.result_export(empty["id"], "csv").read_text()))), [])
        exported = self.engine.result_export(empty["id"], "parquet")
        with self.engine.runtime.connection() as connection:
            metadata = json.loads(connection.execute("SELECT value FROM parquet_kv_metadata(?) WHERE key='geo'", [str(exported)]).fetchone()[0])
            self.assertEqual(metadata["primary_column"], "__usbf_geometry")
            self.assertEqual(metadata["columns"]["__usbf_geometry"]["geometry_types"], [])
            self.assertEqual(metadata["columns"]["__usbf_geometry"]["crs"]["id"], {"authority": "EPSG", "code": 4326})
            self.assertEqual(connection.execute("SELECT count(*) FROM read_parquet(?)", [str(exported)]).fetchone()[0], 0)
            self.assertTrue(str(connection.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(exported)]).fetchall()[-1][1]).startswith("GEOMETRY"))
        measured = wait(self.engine, self.engine.create_job({"operation": "measure", "inputs": [{"kind": "file", "path": empty["result"]["path"]}]}))
        self.assertEqual(measured["result"]["rows"], 0)

    def test_source_field_names_do_not_conflict_with_internal_helpers(self):
        data = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"file_row_number": 99, "__usbf_row": "source", "__usbf_map_geometry": 17, "__usbf_feature_json": "raw", "native_json": "kept"}, "geometry": {"type": "Point", "coordinates": [-77, 39]}}]}
        job = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "geojson", "data": data}]}))
        self.assertEqual(self.engine.result_feature(job["id"], 0)["properties"], data["features"][0]["properties"])

    def test_changed_result_rejected_even_when_index_and_tile_cached(self):
        self.fixture()
        self.engine.result_tile(self.job_id, 0, 0, 0)
        path = self.engine.result_path(self.job_id)
        with path.open("ab") as output:
            output.write(b"changed")
        with self.assertRaisesRegex(ValueError, "changed"):
            self.engine.result_tile(self.job_id, 0, 0, 0)

    def test_changed_selection_cache_cannot_silently_change_analysis(self):
        self.fixture()
        selected = self.engine.result_selection(self.job_id, {"ids": [self.job_id + ":2500"]})
        path = self.root / "Cache" / "native-results" / self.job_id / "selections" / (selected["selectionId"] + ".parquet")
        with path.open("ab") as output:
            output.write(b"changed")
        with self.assertRaisesRegex(ValueError, "changed"):
            self.engine.selection_input({"jobId": self.job_id, "selectionId": selected["selectionId"]})

    def test_certified_geometry_index_selects_cross_shard_candidates(self):
        scope = {"crs": "EPSG:4326", "geometry": {"type": "Polygon", "coordinates": [[[2.5, 2.5], [2.6, 2.5], [2.6, 2.6], [2.5, 2.6], [2.5, 2.5]]]}}
        tile = {"url": "https://data.source.coop/test/a.parquet", "path": "a.parquet", "sha256": "1" * 64, "bytes": 100, "rows": 1, "bbox": [0, 0, 1, 1], "geometry_bbox": [-2, -1, 3, 4], "geometry_bounds_complete": True}
        source = {"kind": "usbf", "files": [tile], "geometryBoundsGuaranteed": True}
        spec = {"operation": "load", "scope": scope, "inputs": [source]}
        with mock.patch("usbf_engine.engine.public_url", side_effect=lambda value: value):
            plan = self.engine.plan(spec)
            self.assertEqual(plan["partCount"], 1)
            self.assertEqual(plan["parts"][0]["sourceCandidateIndex"], "full-geometry-bbox")
            self.assertTrue(plan["parts"][0]["geometryBoundsGuaranteed"])
            tile["geometry_bounds_complete"] = False
            with self.assertRaisesRegex(ValueError, "incomplete"):
                self.engine.plan(spec)

    def test_http_auth_cors_binary_tiles_and_full_result_query(self):
        self.fixture()
        server = serve(self.engine, 0, origins=["http://localhost:8765"])
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = "http://127.0.0.1:" + str(server.server_port)
        def request(path, body=None, token=None, origin="http://localhost:8765"):
            headers = {"Origin": origin}
            if token:
                headers["Authorization"] = "Bearer " + token
            if body is not None:
                headers["Content-Type"] = "application/json"
            return urllib.request.urlopen(urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers), timeout=30)
        try:
            token = json.load(request("/v1/pair", {"code": self.engine.pairing_code()}))["token"]
            with self.assertRaises(urllib.error.HTTPError) as caught:
                request("/v1/jobs/" + self.job_id + "/tiles/0/0/0.pbf")
            self.assertEqual(caught.exception.code, 401)
            with self.assertRaises(urllib.error.HTTPError) as caught:
                request("/v1/jobs/" + self.job_id + "/map", token=token, origin="http://evil.example")
            self.assertEqual(caught.exception.code, 403)
            response = request("/v1/jobs/" + self.job_id + "/tiles/0/0/0.pbf", token=token)
            self.assertEqual(response.headers["Content-Type"], "application/vnd.mapbox-vector-tile")
            self.assertEqual(sum(row["properties"]["count"] for row in vector_tile(response.read())["clusters"]), 2501)
            page = json.load(request("/v1/jobs/" + self.job_id + "/query", {"offset": 2500}, token))
            self.assertEqual(page["rows"][0]["properties"]["source_row"], 2500)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(5)


if __name__ == "__main__":
    unittest.main()
