"""Source comparisons scan complete originals and immutable selected records."""
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine import Engine
from usbf_engine.runtime import sqlstr
from usbf_engine.server import serve


def wait(engine, job):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        job = engine.get_job(job["id"])
        if job["status"] in {"completed", "partial", "failed"}:
            if job["status"] != "completed":
                raise AssertionError(job)
            return job
        time.sleep(.05)
    raise AssertionError("Native fixture did not complete")


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="comparison-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"))

    def tearDown(self):
        self.engine.close()
        self.temp.cleanup()

    def fixture(self, *, height=True):
        path = Path(self.temp.name) / "Files" / "buildings.parquet"
        height_sql = "CASE WHEN i%4=0 THEN 12 WHEN i%4=1 THEN 0 WHEN i%4=2 THEN -999 ELSE NULL END::DOUBLE AS height," if height else ""
        with self.engine.runtime.connection() as c:
            c.execute("COPY (SELECT i::BIGINT AS original_row," + height_sql + "900::DOUBLE AS render_height,"
                      "ST_SetCRS(ST_MakeEnvelope(-77+(i%100)*.0002,39+floor(i/100)*.0002,"
                      "-77+(i%100)*.0002+.0001,39+floor(i/100)*.0002+.0001),'EPSG:4326') AS geometry "
                      "FROM range(2507) t(i)) TO " + sqlstr(path) + " (FORMAT PARQUET)")
        return wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": "Files/buildings.parquet"}]}))

    def test_complete_and_selected_originals_beyond_preview(self):
        job = self.fixture()
        self.assertEqual(len(self.engine.preview(job["id"])["features"]), 2000)
        result = self.engine.result_comparison_summary(job["id"], {})
        self.assertEqual(result["records"], 2507)
        self.assertEqual(result["geometry"]["polygonRecords"], 2507)
        self.assertEqual(result["geometry"]["areaRecords"], 2507)
        self.assertGreater(result["geometry"]["areaM2"], 200000)
        self.assertEqual(result["height"], {"field": "height", "available": 627, "unavailable": 1880,
                         "rule": "Positive finite original supplied height values only; no rendering defaults or floor-based estimates.",
                         "meaning": "Source supplied values may themselves be estimates; field presence does not establish measured height."})
        self.assertEqual(result["provenance"]["sha256"], job["result"]["sha256"])
        chosen = self.engine.result_selection(job["id"], {"ids": [job["id"] + ":2504", job["id"] + ":2506"], "mode": "replace"})
        selected = self.engine.result_comparison_summary(job["id"], {"selectionId": chosen["selectionId"]})
        self.assertEqual(selected["records"], 2)
        self.assertEqual(selected["sourceTotal"], 2507)
        self.assertEqual(selected["height"]["available"], 1)
        self.assertLess(selected["geometry"]["areaM2"], 300)
        empty = self.engine.result_selection(job["id"], {"ids": [], "mode": "replace"})
        summary = self.engine.result_comparison_summary(job["id"], {"selectionId": empty["selectionId"]})
        self.assertEqual(summary["records"], 0)
        self.assertEqual(summary["geometry"]["areaM2"], 0)
        self.assertIsNone(summary["extent"])
        with self.assertRaisesRegex(ValueError, "rendering heights"):
            self.engine.result_comparison_summary(job["id"], {"heightField": "render_height"})
        with self.assertRaises(ValueError):
            self.engine.result_comparison_summary(job["id"], {"selectionId": "bad"})
        with self.assertRaises(ValueError):
            self.engine.result_comparison_summary(job["id"], {"sql": "SELECT 1"})

    def test_no_height_rendering_defaults_and_authenticated_route(self):
        job = self.fixture(height=False)
        result = self.engine.result_comparison_summary(job["id"], {})
        self.assertIsNone(result["height"]["field"])
        self.assertIsNone(result["height"]["available"])
        self.assertEqual(result["height"]["unavailable"], 2507)
        server = serve(self.engine, port=0, origins=["http://localhost"])
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            token = self.engine.pair(self.engine.pairing_code())["token"]
            request = urllib.request.Request("http://127.0.0.1:" + str(server.server_port) + "/v1/jobs/" + job["id"] + "/comparison-summary",
                                             data=b"{}", method="POST", headers={"Content-Type": "application/json", "Origin": "http://localhost", "Authorization": "Bearer " + token})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(json.load(response)["records"], 2507)
            self.assertTrue(self.engine.status()["capabilities"]["resultComparisonSummary"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_wgs84_area_axis_order_matches_independent_geodesic_reference(self):
        # Independently calculated with pyproj.Geod(ellps='WGS84').
        # LA's longitude is outside valid latitude range, exposing accidental
        # axis swaps that a small DC-only fixture might conceal.
        references = [(-77., 39., 9616.805047750473), (-118.25, 34.05, 10241.557032644749)]
        path = Path(self.temp.name) / "Files" / "axis-reference.parquet"
        with self.engine.runtime.connection() as c:
            self.assertTrue(c.execute("SELECT current_setting('geometry_always_xy')").fetchone()[0])
            for lon, lat, expected in references:
                actual = c.execute("SELECT ST_Area_Spheroid(ST_SetCRS(ST_MakeEnvelope(?,?,?,?),'EPSG:4326'))",
                                   [lon, lat, lon + .001, lat + .001]).fetchone()[0]
                self.assertAlmostEqual(actual, expected, places=6)
            c.execute("COPY (SELECT ST_SetCRS(ST_MakeEnvelope(lon,lat,lon+.001,lat+.001),'EPSG:4326') AS geometry "
                      "FROM (VALUES (-77.0,39.0),(-118.25,34.05)) p(lon,lat)) TO " + sqlstr(path) + " (FORMAT PARQUET)")
        job = wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": "Files/axis-reference.parquet"}]}))
        summary = self.engine.result_comparison_summary(job["id"], {})
        self.assertEqual(summary["records"], 2)
        self.assertAlmostEqual(summary["geometry"]["areaM2"], sum(item[2] for item in references), places=5)


if __name__ == "__main__":
    unittest.main()
