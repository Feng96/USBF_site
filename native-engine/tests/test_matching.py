"""Real geometry, complete-original graphs and durable report workflows."""
import csv
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine import Engine
from usbf_engine.matching import source_identity
from usbf_engine.runtime import sqlstr


def polygon(x=0, y=0, width=1, height=1, holes=()):
    def ring(a, b, w, h):
        return [[a, b], [a+w, b], [a+w, b+h], [a, b+h], [a, b]]
    return {"type": "Polygon", "coordinates": [ring(x, y, width, height), *[ring(*hole) for hole in holes]]}


AREA = {"geometry": polygon(-2, -2, 20, 20), "crs": "EPSG:4326", "label": "Match AOI"}


def feature(geometry, properties=None, fid=None):
    return {"type": "Feature", "geometry": geometry, "properties": properties or {}, **({"id": fid} if fid is not None else {})}


def wait(engine, job, expected="completed"):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        job = engine.get_job(job["id"])
        if job["status"] in {"completed", "partial", "failed", "cancelled", "interrupted"}:
            if job["status"] != expected:
                raise AssertionError(job)
            return job
        time.sleep(.025)
    raise AssertionError("Native matching fixture did not finish")


class MatchingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="matching-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"))

    def tearDown(self):
        self.engine.close()
        self.temp.cleanup()

    def load(self, features, name="Original", release=None):
        imported = self.engine.import_geojson(name + ".geojson", {"type": "FeatureCollection", "features": features})
        return wait(self.engine, self.engine.create_job({"operation": "load", "name": name,
                    "inputs": [{"kind": "file", "path": imported["path"]}], "inputContract": {"version": 1, "loadingArea": AREA}, "release": release}))

    def match(self, left, right, **options):
        job = wait(self.engine, self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]},
                   "studyArea": AREA, "recordMode": "all", **options}))
        return job, self.engine.matching_page(job["id"], {"limit": 500})

    def test_exact_changed_touching_holes_and_unrelated_ids(self):
        left = self.load([feature(polygon(0, 0), {"id": "same-unrelated-id"}), feature(polygon(3, 0)),
                          feature(polygon(6, 0, 2, 2, holes=[(6.5, .5, 1, 1)]))], "Left")
        right = self.load([feature(polygon(0, 0), {"id": "different-id"}), feature(polygon(4, 0)),
                           feature(polygon(6.5, .5, 1, 1), {"id": "same-unrelated-id"})], "Right")
        _, report = self.match(left, right)
        pairs = [r for r in report["rows"] if r["leftId"] and r["rightId"]]
        self.assertEqual(len(pairs), 1)
        self.assertAlmostEqual(pairs[0]["iou"], 1)
        self.assertEqual(pairs[0]["basis"], "spatial-overlap")
        self.assertEqual(report["summary"]["categories"]["unmatched-left"], 2)
        self.assertEqual(report["summary"]["categories"]["unmatched-right"], 2)
        changed = self.load([feature(polygon(.2, 0))], "Changed")
        _, report = self.match(left, changed)
        self.assertAlmostEqual(report["rows"][0]["iou"], 2/3, places=7)
        self.assertAlmostEqual(report["rows"][0]["left_coverage"], .8, places=7)
        self.assertEqual(self.engine.result_feature(left["id"], 0)["properties"]["id"], "same-unrelated-id")

    def test_split_merge_and_ambiguous_graph_are_not_greedy(self):
        left = self.load([feature(polygon(0, 0, 2, 1)), feature(polygon(4, 0)), feature(polygon(5, 0)), feature(polygon(8, 0)), feature(polygon(8, 0))], "Left")
        right = self.load([feature(polygon(0, 0)), feature(polygon(1, 0)), feature(polygon(4, 0, 2, 1)), feature(polygon(8, 0)), feature(polygon(8, 0))], "Right")
        _, report = self.match(left, right)
        self.assertEqual(report["summary"]["pairRows"], 8)
        self.assertEqual(report["summary"]["categories"]["one-to-many"], 2)
        self.assertEqual(report["summary"]["categories"]["many-to-one"], 2)
        self.assertEqual(report["summary"]["categories"]["ambiguous"], 4)
        self.assertEqual(report["summary"]["matchedLeft"], 5)

    def test_compatible_osm_overture_provenance_long_ids_and_duplicates(self):
        long_id = "900719925474099312345678"
        left = self.load([feature(polygon(0, 0), {"osm_type": "way", "osm_id": long_id}),
                          feature(polygon(3, 0), {"osm_type": "relation", "osm_id": long_id})], "OSM")
        right = self.load([feature(polygon(9, 0), {"id": "overture/A", "sources": [{"dataset": "OpenStreetMap", "record_id": "w" + long_id}]}),
                           feature(polygon(11, 0), {"id": "overture/B", "sources": [{"dataset": "OpenStreetMap", "record_id": "way/" + long_id}]}),
                           feature(polygon(13, 0), {"id": long_id, "sources": [{"dataset": "OtherProvider", "record_id": "w" + long_id}]})], "Overture")
        _, report = self.match(left, right)
        pairs = [r for r in report["rows"] if r["leftId"] and r["rightId"]]
        self.assertEqual(len(pairs), 2)
        self.assertTrue(all(r["category"] == "ambiguous" and r["basis"] == "compatible-provenance" and r["iou"] == 0 for r in pairs))
        self.assertEqual(pairs[0]["left_source_ids"]["osm_id"], long_id)
        self.assertEqual(report["summary"]["categories"]["unmatched-left"], 1)
        self.assertEqual(report["summary"]["categories"]["unmatched-right"], 1)
        self.assertEqual(source_identity({"id": "way/42"})[1], [])
        self.assertEqual(source_identity({"@id": "way/42"})[1], ["osm:way:42"])

    def test_real_provider_osm_type_id_and_versioned_overture_record_id(self):
        left = self.load([feature(polygon(0, 0), {"type": "way", "id": 67521490})], "Layercake OSM", release={"providerId": "osm-buildings", "releaseId": "latest"})
        right = self.load([feature(polygon(9, 0), {"id": "overture-uuid", "sources": [{"dataset": "OpenStreetMap", "record_id": "w67521490@4", "provider": "osm"}]})], "Overture")
        _, report = self.match(left, right)
        self.assertEqual(report["summary"]["matchedLeft"], 1)
        row = report["rows"][0]
        self.assertEqual(row["basis"], "compatible-provenance")
        self.assertEqual(row["iou"], 0)
        self.assertEqual(row["right_source_ids"]["sources"][0]["record_id"], "w67521490@4")
        unrelated = self.load([feature(polygon(0, 0), {"type": "way", "id": 67521490})], "Other provider")
        _, report = self.match(unrelated, right)
        self.assertEqual(report["summary"]["matchedLeft"], 0)
        self.assertEqual(source_identity({"type": "way", "id": 67521490})[1], [])

    def test_thresholds_empty_invalid_and_same_area_validation(self):
        left = self.load([feature(polygon(0, 0)), feature({"type": "Polygon", "coordinates": []})], "Left")
        right = self.load([feature(polygon(.8, 0))], "Right")
        _, report = self.match(left, right)
        self.assertEqual(report["summary"]["matchedLeft"], 0)
        self.assertEqual(report["summary"]["categories"]["invalid-left"], 1)
        _, report = self.match(left, right, thresholds={"iou": .1, "coverage": .9})
        self.assertEqual(report["summary"]["matchedLeft"], 1)
        empty_area = {"geometry": polygon(-1.5, -1.5, .1, .1), "label": "Empty"}
        _, report = self.match(left, right, recordMode="area", studyArea=empty_area)
        self.assertEqual(report["rows"], [])
        self.assertEqual(report["summary"]["leftRecords"], 0)
        with self.assertRaisesRegex(ValueError, "same saved area"):
            self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]}, "recordMode": "all", "studyArea": empty_area})
        for invalid in (0, -1, 1.1, float("nan"), True):
            with self.assertRaises(ValueError):
                self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]}, "studyArea": AREA, "thresholds": {"iou": invalid}})

    def test_pagination_selection_exports_changed_inputs_and_durable_reopen(self):
        left = self.load([feature(polygon(i*2, 0), {"raw_name": "源 Name", "height": i, "id": str(i)}) for i in range(4)], "Left")
        right = self.load([feature(polygon(i*2, 0)) for i in range(4)], "Right")
        job, report = self.match(left, right)
        one = self.engine.matching_page(job["id"], {"offset": 1, "limit": 2})
        self.assertEqual([r["pair_id"] for r in one["rows"]], [1, 2])
        self.assertEqual(one["total"], 4)
        selected = self.engine.matching_selection(job["id"], {"side": "left", "pairIds": [2]})
        self.assertEqual(selected["count"], 1)
        table = self.engine.result_query(left["id"], {"selectionId": selected["selectionId"]})
        self.assertEqual(table["total"], 1)
        self.assertEqual(self.engine.result_feature(left["id"], 2)["properties"]["raw_name"], "源 Name")
        original_export = self.engine.result_export(left["id"], "geojson", selected["selectionId"])
        self.assertTrue(original_export.is_file())
        csv_path, mime = self.engine.matching_export(job["id"])
        self.assertIn("text/csv", mime)
        with csv_path.open() as handle:
            self.assertEqual(len(list(csv.DictReader(handle))), 4)
        json_path, _ = self.engine.matching_export(job["id"], "json")
        exported = json.loads(json_path.read_text())["rows"]
        self.assertEqual(len(exported), 4)
        self.assertEqual(exported[2]["leftId"], left["id"] + ":2")
        self.assertEqual(exported[2]["left_source_ids"]["id"], "2")
        with ThreadPoolExecutor(max_workers=2) as executor:
            copies = list(executor.map(lambda _: self.engine.matching_export(job["id"], "json"), range(2)))
        self.assertTrue(all(len(json.loads(path.read_text())["rows"]) == 4 for path, _ in copies))
        self.engine.close()
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"))
        self.assertEqual(self.engine.matching_page(job["id"], {})["summary"], report["summary"])
        source = Path(self.temp.name) / left["result"]["path"]
        with source.open("ab") as output:
            output.write(b"changed fixture")
        with self.assertRaisesRegex(ValueError, "changed"):
            self.engine.matching_page(job["id"], {})

    def test_complete_native_records_beyond_two_thousand_preview(self):
        jobs = []
        for side in ("left", "right"):
            path = Path(self.temp.name) / "Files" / (side + ".parquet")
            with self.engine.runtime.connection() as c:
                c.execute("COPY (SELECT i::BIGINT AS original_id,ST_SetCRS(ST_MakeEnvelope((i%100)*.002,floor(i/100)*.002,(i%100)*.002+.001,floor(i/100)*.002+.001),'EPSG:4326') AS geometry FROM range(2507) t(i)) TO " + sqlstr(path) + " (FORMAT PARQUET)")
            jobs.append(wait(self.engine, self.engine.create_job({"operation": "load", "inputs": [{"kind": "file", "path": "Files/" + side + ".parquet"}], "inputContract": {"loadingArea": AREA}})))
        self.assertEqual(len(self.engine.preview(jobs[0]["id"])["features"]), 2000)
        job, report = self.match(*jobs)
        self.assertEqual(report["summary"]["matchedLeft"], 2507)
        self.assertEqual(report["total"], 2507)
        last = self.engine.matching_page(job["id"], {"offset": 2506, "limit": 1})["rows"][0]
        self.assertTrue(last["leftId"].endswith(":2506"))
        selected = self.engine.matching_selection(job["id"], {"side": "right", "category": "one-to-one"})
        self.assertEqual(selected["count"], 2507)

    def test_cancel_before_execution_and_resume(self):
        left = self.load([feature(polygon(0, 0))], "Left")
        right = self.load([feature(polygon(0, 0))], "Right")
        self.engine.close()
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"), autostart=False)
        pending = self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]}, "studyArea": AREA})
        self.engine.cancel(pending["id"])
        self.engine._execute_matching(self.engine.get_job(pending["id"]))
        self.assertEqual(self.engine.get_job(pending["id"])["status"], "cancelled")
        self.assertFalse((Path(self.temp.name) / "Results" / "building-matches" / pending["id"] / "report.writing.duckdb").exists())
        resumed = self.engine.resume(pending["id"])
        self.engine._execute_matching(resumed)
        self.assertEqual(self.engine.get_job(pending["id"])["status"], "completed")

    def test_exact_selected_rows_and_whole_outlines_in_common_area(self):
        left = self.load([feature(polygon(0, 0)), feature(polygon(3, 0)), feature(polygon(6, 0))], "Left")
        right = self.load([feature(polygon(0, 0)), feature(polygon(3, 0)), feature(polygon(6, 0))], "Right")
        choices = [self.engine.result_selection(source["id"], {"mode": "replace", "ids": [source["id"] + ":2"]}) for source in (left, right)]
        pending = self.engine.create_matching_job({"left": {"jobId": left["id"], "selectionId": choices[0]["selectionId"]}, "right": {"jobId": right["id"], "selectionId": choices[1]["selectionId"]}, "recordMode": "selection", "studyArea": AREA})
        job = wait(self.engine, pending)
        report = self.engine.matching_page(job["id"], {})
        self.assertEqual(report["summary"]["leftRecords"], 1)
        self.assertTrue(report["rows"][0]["leftId"].endswith(":2"))
        tiny = {"geometry": polygon(6.1, .1, .1, .1), "label": "Whole record intersection"}
        _, cropped = self.match(left, right, recordMode="area", studyArea=tiny)
        self.assertEqual(cropped["summary"]["leftRecords"], 1)
        self.assertAlmostEqual(cropped["rows"][0]["left_area"], report["rows"][0]["left_area"], places=5)

    def test_cancel_running_native_candidate_phase(self):
        left = self.load([feature(polygon(0, 0))], "Left")
        right = self.load([feature(polygon(0, 0))], "Right")
        self.engine.close()
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"), autostart=False)
        job = self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]}, "studyArea": AREA})
        original_save = self.engine._save
        def cancel_at_candidates(current):
            original_save(current)
            if current["status"] == "running" and current["phase"] == "matching-candidates":
                self.engine.cancel(current["id"])
        self.engine._save = cancel_at_candidates
        self.engine._execute_matching(job)
        stopped = self.engine.get_job(job["id"])
        self.assertEqual(stopped["status"], "cancelled")
        self.assertIsNone(stopped["result"])
        with self.assertRaisesRegex(ValueError, "no complete"):
            self.engine.matching_page(job["id"], {})

    def test_report_output_symlink_cannot_escape_workspace(self):
        left = self.load([feature(polygon(0, 0))], "Left")
        right = self.load([feature(polygon(0, 0))], "Right")
        with tempfile.TemporaryDirectory(prefix="matching-outside-", dir=os.environ.get("USBF_ENGINE_TEST_DIR")) as outside:
            (Path(self.temp.name) / "Results" / "building-matches").symlink_to(outside, target_is_directory=True)
            job = wait(self.engine, self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]}, "studyArea": AREA}), expected="failed")
            self.assertIn("leaves", job["error"])
            self.assertEqual(list(Path(outside).iterdir()), [])

    def test_unfamiliar_published_report_and_receipt_are_kept(self):
        left = self.load([feature(polygon(0, 0))], "Left")
        right = self.load([feature(polygon(0, 0))], "Right")
        self.engine.close()
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"), autostart=False)
        for with_report, with_receipt in ((True, False), (False, True), (True, True)):
            with self.subTest(report=with_report, receipt=with_receipt):
                job = self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]}, "studyArea": AREA})
                folder = Path(self.temp.name) / "Results" / "building-matches" / job["id"]
                folder.mkdir(parents=True)
                target, metadata = folder / "report.duckdb", folder / "report.json"
                report_bytes, receipt_bytes = b"User-owned preexisting report", b'{"user":"preexisting receipt"}'
                if with_report:
                    target.write_bytes(report_bytes)
                if with_receipt:
                    metadata.write_bytes(receipt_bytes)
                self.engine._execute_matching(job)
                failed = self.engine.get_job(job["id"])
                self.assertEqual(failed["status"], "failed")
                self.assertIn("kept", failed["error"])
                self.assertEqual(target.read_bytes() if target.exists() else None, report_bytes if with_report else None)
                self.assertEqual(metadata.read_bytes() if metadata.exists() else None, receipt_bytes if with_receipt else None)

    def test_complete_report_is_recovered_after_crash_without_rewriting(self):
        left = self.load([feature(polygon(0, 0))], "Left")
        right = self.load([feature(polygon(0, 0))], "Right")
        job, report = self.match(left, right)
        target = Path(self.temp.name) / job["result"]["path"]
        metadata = Path(self.temp.name) / job["result"]["metadataPath"]
        report_bytes, receipt_bytes = target.read_bytes(), metadata.read_bytes()
        self.engine.close()
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"), autostart=False)
        interrupted = self.engine.get_job(job["id"])
        interrupted.update(status="interrupted", result=None)
        self.engine._save(interrupted)
        resumed = self.engine.resume(job["id"])
        self.engine._execute_matching(resumed)
        recovered = self.engine.get_job(job["id"])
        self.assertEqual(recovered["status"], "completed")
        self.assertTrue(recovered["result"]["recovered"])
        self.assertEqual(target.read_bytes(), report_bytes)
        self.assertEqual(metadata.read_bytes(), receipt_bytes)
        self.assertEqual(self.engine.matching_page(job["id"], {})["summary"], report["summary"])
        original_receipt = json.loads(receipt_bytes)
        for invalid in ("requestHash", "sources"):
            with self.subTest(invalid=invalid):
                changed = json.loads(receipt_bytes)
                if invalid == "sources":
                    changed["sources"][0]["sha256"] = "unrelated-source"
                else:
                    changed["requestHash"] = "unrelated-request"
                metadata.write_text(json.dumps(changed), encoding="utf-8")
                changed_bytes = metadata.read_bytes()
                interrupted = self.engine.get_job(job["id"])
                interrupted.update(status="interrupted", result=None)
                self.engine._save(interrupted)
                self.engine._execute_matching(self.engine.resume(job["id"]))
                self.assertEqual(self.engine.get_job(job["id"])["status"], "failed")
                self.assertEqual(target.read_bytes(), report_bytes)
                self.assertEqual(metadata.read_bytes(), changed_bytes)
        self.assertTrue(original_receipt["complete"])
        metadata.write_bytes(receipt_bytes)
        changed_report = report_bytes + b"Changed after publication"
        target.write_bytes(changed_report)
        interrupted = self.engine.get_job(job["id"])
        interrupted.update(status="interrupted", result=None)
        self.engine._save(interrupted)
        self.engine._execute_matching(self.engine.resume(job["id"]))
        failed = self.engine.get_job(job["id"])
        self.assertEqual(failed["status"], "failed")
        self.assertIn("output changed", failed["error"])
        self.assertEqual(target.read_bytes(), changed_report)
        self.assertEqual(metadata.read_bytes(), receipt_bytes)

    def test_report_created_during_computation_is_not_overwritten(self):
        left = self.load([feature(polygon(0, 0))], "Left")
        right = self.load([feature(polygon(0, 0))], "Right")
        self.engine.close()
        self.engine = Engine(self.temp.name, extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"), autostart=False)
        job = self.engine.create_matching_job({"left": {"jobId": left["id"]}, "right": {"jobId": right["id"]}, "studyArea": AREA})
        target = Path(self.temp.name) / "Results" / "building-matches" / job["id"] / "report.duckdb"
        original_hash = self.engine._hash_file
        report_bytes = b"An external report created before native publication"
        def create_before_publish(path, *args, **kwargs):
            checksum = original_hash(path, *args, **kwargs)
            if Path(path).name == "report.writing.duckdb":
                target.write_bytes(report_bytes)
            return checksum
        self.engine._hash_file = create_before_publish
        self.engine._execute_matching(job)
        failed = self.engine.get_job(job["id"])
        self.assertEqual(failed["status"], "failed")
        self.assertIn("cannot be overwritten", failed["error"])
        self.assertEqual(target.read_bytes(), report_bytes)
        self.assertFalse(target.with_name("report.json").exists())


if __name__ == "__main__":
    unittest.main()
