"""Full dependency portability and hostile ZIP regression checks."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine import Engine
from usbf_engine.project_dependencies import export_package, import_package, package_path, relink_dependency
from usbf_engine.runtime import sqlstr


def wait(engine, job):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        row = engine.get_job(job["id"])
        if row["status"] in {"completed", "failed", "partial", "cancelled"}:
            if row["status"] != "completed":
                raise AssertionError(row)
            return row
        time.sleep(.02)
    raise AssertionError("Project restoration did not complete")


class ProjectPackagesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="usbf-packages-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        self.a = Engine(Path(self.temp.name) / "author", extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"))
        self.b = Engine(Path(self.temp.name) / "recipient", extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"))
        file = self.a.workspace / "Files" / "source.parquet"
        with self.a.runtime.connection() as connection:
            connection.execute("COPY (SELECT i::BIGINT AS source_row, 9007199254740993123::BIGINT AS original_id, false AS flag, 0 AS zero, NULL::DOUBLE AS missing, ST_Point(-77+i*.00001,39) AS geometry FROM range(3001) t(i)) TO " + sqlstr(file) + " (FORMAT PARQUET)")
        self.job = wait(self.a, self.a.create_job({"schema": 1, "operation": "load", "inputs": [{"kind": "file", "path": "Files/source.parquet", "crs": "EPSG:4326"}]}))
        ref = {"version": 1, "workspaceId": self.a.workspace_id, "jobId": self.job["id"], "path": self.job["result"]["path"], "format": "GeoParquet", "recordCount": 3001, "sha256": self.job["result"]["sha256"]}
        self.project = {"format": "USBF map", "version": 2, "layers": [{"key": "layer-1", "name": "Layers", "meta": {"nativeSource": ref}, "data": self.a.preview(self.job["id"])}]}

    def tearDown(self):
        self.a.close()
        self.b.close()
        self.temp.cleanup()

    def package(self):
        package = export_package(self.a, {"project": self.project})
        source = package_path(self.a, package["path"])
        target = self.b.workspace / "Files" / "map.usbf.zip"
        shutil.copyfile(source, target)
        return package, target

    def rewrite(self, file, change):
        with zipfile.ZipFile(file) as archive:
            entries = {name: archive.read(name) for name in archive.namelist()}
        change(entries)
        with zipfile.ZipFile(file, "w") as archive:
            for name, data in entries.items():
                archive.writestr(name, data)

    def test_full_file_cross_workspace_and_exact_attributes(self):
        package, file = self.package()
        self.assertFalse(package["onlineSourcesIncluded"])
        self.assertNotEqual(self.a.workspace_id, self.b.workspace_id)
        restored = import_package(self.b, {"path": "Files/map.usbf.zip"})
        job = wait(self.b, {"id": restored["jobs"][0]["jobId"]})
        self.assertEqual(job["result"]["rows"], 3001)
        with self.b.runtime.connection() as connection:
            rows = connection.execute("SELECT count(*), min(original_id), bool_and(flag=false), min(zero), count(missing) FROM read_parquet(?)", [str(self.b.result_path(job["id"]))]).fetchone()
        self.assertEqual(rows, (3001, 9007199254740993123, True, 0, 0))
        self.assertEqual(restored["project"]["layers"][0]["name"], "Layers")
        self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(), package["sha256"])

    def test_duplicate_layers_share_one_complete_dependency(self):
        self.project["layers"].append({**self.project["layers"][0], "key": "layer-2"})
        _, file = self.package()
        with zipfile.ZipFile(file) as archive:
            self.assertEqual(len([name for name in archive.namelist() if name.endswith(".parquet")]), 1)
        restored = import_package(self.b, {"path": "Files/map.usbf.zip"})
        self.assertEqual(restored["jobs"][0]["jobId"], restored["jobs"][1]["jobId"])

    def test_changed_dependency_fails_before_any_adoption(self):
        _, file = self.package()
        def change(entries):
            name = next(name for name in entries if name.endswith(".parquet"))
            entries[name] = b"X" + entries[name][1:]
        self.rewrite(file, change)
        with self.assertRaisesRegex(ValueError, "SHA256"):
            import_package(self.b, {"path": "Files/map.usbf.zip"})
        self.assertEqual(self.b.jobs(), [])
        self.assertEqual(list((self.b.workspace / "Files" / "Projects").iterdir()), [])

    def test_unexpected_traversal_entry_rejected(self):
        _, file = self.package()
        self.rewrite(file, lambda entries: entries.update({"../Engine/state/jobs.sqlite3": b"do not extract"}))
        with self.assertRaisesRegex(ValueError, "unexpected"):
            import_package(self.b, {"path": "Files/map.usbf.zip"})
        self.assertEqual(self.b.jobs(), [])

    def test_project_document_hash_is_verified(self):
        _, file = self.package()
        self.rewrite(file, lambda entries: entries.update({"project.json": entries["project.json"].replace(b'"Layers"', b'"Other!"')}))
        with self.assertRaisesRegex(ValueError, "SHA256"):
            import_package(self.b, {"path": "Files/map.usbf.zip"})

    def test_relink_requires_saved_full_checksum(self):
        file = self.a.result_path(self.job["id"])
        shutil.copyfile(file, self.b.workspace / "Files" / "moved.parquet")
        with self.assertRaisesRegex(ValueError, "SHA256"):
            relink_dependency(self.b, {"path": "Files/moved.parquet", "sha256": "0" * 64})
        result = relink_dependency(self.b, {"path": "Files/moved.parquet", "sha256": self.job["result"]["sha256"]})
        self.assertEqual(wait(self.b, {"id": result["jobId"]})["result"]["rows"], 3001)

    def test_export_rejects_other_workspace_and_keeps_results(self):
        self.project["layers"][0]["meta"]["nativeSource"]["workspaceId"] = self.b.workspace_id
        with self.assertRaisesRegex(ValueError, "Relink"):
            export_package(self.a, {"project": self.project})
        self.assertTrue(self.a.result_path(self.job["id"]).is_file())
        with self.assertRaises(ValueError):
            package_path(self.a, "Results/Packages/../../Engine/state/jobs.sqlite3")


if __name__ == "__main__":
    unittest.main()
