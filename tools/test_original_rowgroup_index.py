"""Real Parquet physical groups, geometry crossings and no-omission guards."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("original_rowgroups", Path(__file__).with_name("build-original-rowgroup-index.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class RowGroupIndexTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="usbf-rowgroups-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        cls.root = Path(cls.temp.name)
        cls.runtime = builder.Runtime(cls.root / "runtime", extension_path=os.environ.get("USBF_SPATIAL_EXTENSION"), allow_install=not bool(os.environ.get("USBF_SPATIAL_EXTENSION")))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def fixture(self, count=6001):
        self.file = self.root / "USBF_x+00000_y+00000.parquet"
        self.file.unlink(missing_ok=True)
        with self.runtime.connection() as c:
            c.execute("COPY (SELECT i AS original_row,ST_SetCRS(CASE WHEN i=0 THEN ST_GeomFromText('POLYGON ((-80 -10, 40 -10, 40 20, -80 20, -80 -10), (0 0, 0 1, 1 1, 1 0, 0 0))') ELSE ST_Point((i%100)-50,floor(i/100)*.5) END,'EPSG:4326') AS geometry FROM range(?) t(i)) TO " + builder.sqlstr(self.file) + " (FORMAT PARQUET,ROW_GROUP_SIZE 2048)", [count])
            box = list(c.execute("SELECT min(ST_XMin(geometry)),min(ST_YMin(geometry)),max(ST_XMax(geometry)),max(ST_YMax(geometry)) FROM read_parquet(?)", [str(self.file)]).fetchone())
        item = {"path": self.file.name, "rows": count, "bytes": self.file.stat().st_size, "sha256": hashlib.sha256(self.file.read_bytes()).hexdigest(), "bbox": [-.1, -.1, .1, .1], "tile_bbox": [0, 0, .5, .5]}
        raw = json.dumps({"release": "USBF_v1", "crs": "EPSG:4326", "tiles": 1, "files": [item]}).encode()
        index = {"schema": 1, "crs": "EPSG:4326", "sourceManifestSha256": hashlib.sha256(raw).hexdigest(), "geometryBoundsGuaranteed": True, "topologyValidated": False, "files": [{"path": item["path"], "rows": count, "sha256": item["sha256"], "geometry_bbox": box, "geometry_bounds_complete": True}]}
        return raw, json.dumps(index).encode(), item, index["files"][0]

    def test_physical_variable_length_partition_and_crossing_polygon_hole(self):
        raw, geometry, item, certified = self.fixture()
        value = builder.build(raw, geometry, self.root, self.runtime, small_threshold=0)
        groups = value["files"][0]["rowGroups"]
        with self.runtime.connection() as c:
            actual = builder.physical_groups(c, self.file, item["rows"])
            for group in groups:
                box = c.execute("SELECT min(ST_XMin(geometry)),min(ST_YMin(geometry)),max(ST_XMax(geometry)),max(ST_YMax(geometry)) FROM read_parquet(?,file_row_number=true) WHERE file_row_number>=? AND file_row_number<?", [str(self.file), group["rowStart"], group["rowEnd"]]).fetchone()
                self.assertEqual(group["geometry_bbox"], list(box))
        self.assertGreater(len(groups), 1)
        self.assertEqual([(g["rowStart"], g["rowEnd"]) for g in groups], actual)
        self.assertNotEqual(actual[-1][1] - actual[-1][0], actual[0][1] - actual[0][0])
        self.assertEqual(groups[0]["geometry_bbox"][0], -80)
        self.assertTrue(value["rowGroupsComplete"])
        self.assertFalse(value["topologyValidated"])

    def test_small_shard_reuses_certified_whole_geometry_envelope(self):
        raw, geometry, item, certified = self.fixture(3)
        groups = builder.build(raw, geometry, self.root, self.runtime)["files"][0]["rowGroups"]
        self.assertEqual(groups, [{"rowStart": 0, "rowEnd": 3, "geometry_bbox": certified["geometry_bbox"], "geometry_bounds_complete": True}])

    def test_same_size_changed_large_source_is_rejected_by_hash(self):
        raw, geometry, _, _ = self.fixture()
        with self.file.open("r+b") as output:
            output.seek(20)
            byte = output.read(1)
            output.seek(20)
            output.write(bytes([byte[0] ^ 1]))
        with self.assertRaisesRegex(ValueError, "SHA256"):
            builder.build(raw, geometry, self.root, self.runtime, small_threshold=0)

    def test_truncated_original_is_rejected_before_index_publication(self):
        raw, geometry, _, _ = self.fixture()
        with self.file.open("r+b") as output:
            output.truncate(100)
        with self.assertRaisesRegex(ValueError, "missing or changed"):
            builder.build(raw, geometry, self.root, self.runtime)

    def test_partition_gap_overlap_wrong_end_and_outside_bounds_are_rejected(self):
        for groups in ([{"rowStart": 1, "rowEnd": 3, "geometry_bbox": [0, 0, 1, 1], "geometry_bounds_complete": True}],
                       [{"rowStart": 0, "rowEnd": 2, "geometry_bbox": [0, 0, 1, 1], "geometry_bounds_complete": True}],
                       [{"rowStart": 0, "rowEnd": 2, "geometry_bbox": [0, 0, 1, 1], "geometry_bounds_complete": True}, {"rowStart": 1, "rowEnd": 3, "geometry_bbox": [0, 0, 1, 1], "geometry_bounds_complete": True}],
                       [{"rowStart": 0, "rowEnd": 3, "geometry_bbox": [-1, 0, 1, 1], "geometry_bounds_complete": True}]):
            with self.subTest(groups=groups), self.assertRaises(ValueError):
                builder.validate_groups(groups, 3, [0, 0, 1, 1])

    def test_manifest_and_per_file_identity_changes_are_rejected(self):
        raw, geometry, _, _ = self.fixture()
        value = json.loads(geometry)
        value["sourceManifestSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "does not match"):
            builder.build(raw, json.dumps(value).encode(), self.root, self.runtime)
        value = json.loads(geometry)
        value["files"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "identity"):
            builder.build(raw, json.dumps(value).encode(), self.root, self.runtime)

    def test_unknown_group_bounds_remain_present_in_exact_partition(self):
        raw, geometry, source, certified = self.fixture()
        self.file.unlink()
        with self.runtime.connection() as c:
            c.execute("COPY (SELECT ST_SetCRS(CASE WHEN i<2048 THEN NULL::GEOMETRY ELSE ST_Point(0,0) END,'EPSG:4326') AS geometry FROM range(6001) t(i)) TO " + builder.sqlstr(self.file) + " (FORMAT PARQUET,ROW_GROUP_SIZE 2048)")
        source.update(bytes=self.file.stat().st_size, sha256=hashlib.sha256(self.file.read_bytes()).hexdigest())
        certified.update(sha256=source["sha256"], geometry_bbox=[0, 0, 0, 0], geometry_bounds_complete=False)
        with self.runtime.connection() as c:
            groups = builder.index_groups(c, self.file, source, certified, small_threshold=0)
        self.assertEqual(groups[0]["rowStart"], 0)
        self.assertEqual(groups[-1]["rowEnd"], 6001)
        self.assertIsNone(groups[0]["geometry_bbox"])
        self.assertFalse(groups[0]["geometry_bounds_complete"])
        self.assertTrue(any(group["geometry_bounds_complete"] for group in groups[1:]))


if __name__ == "__main__":
    unittest.main()
