"""Offline no-overwrite publication tests and real full-geometry index fixtures."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


publisher = module("usbf_original_release", "publish-original-release.py")
indexer = module("usbf_original_index", "build-original-geometry-index.py")
from usbf_engine.runtime import Runtime, sqlstr


class HTTPError(Exception):
    def __init__(self, status):
        self.response = {"ResponseMetadata": {"HTTPStatusCode": status}}


class FakeS3:
    def __init__(self):
        self.objects, self.puts, self.reads = {}, [], []
        self.fail_key = None
        self.race = None

    def head_object(self, *, Bucket, Key):
        if Key not in self.objects:
            raise HTTPError(404)
        return {"ContentLength": len(self.objects[Key])}

    def get_object(self, *, Bucket, Key):
        self.reads.append(Key)
        if Key not in self.objects:
            raise HTTPError(404)
        return {"Body": io.BytesIO(self.objects[Key])}

    def put_object(self, *, Bucket, Key, Body, ContentLength, ContentType, IfNoneMatch, Metadata):
        if IfNoneMatch != "*":
            raise AssertionError("Publication must use a conditional no-overwrite write")
        if Key == self.fail_key:
            raise HTTPError(403)
        value = Body.read()
        if len(value) != ContentLength:
            raise AssertionError("Declared size differs from transmitted bytes")
        if self.race is not None:
            self.objects[Key] = self.race
            self.race = None
            raise HTTPError(412)
        if Key in self.objects:
            raise HTTPError(412)
        self.objects[Key] = value
        self.puts.append(Key)


def entry(name, data, rows=1):
    return {"path": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "rows": rows, "bbox": [0, 0, 1, 1]}


def manifest(files):
    return json.dumps({"release": "USBF_v1", "crs": "EPSG:4326", "tiles": sum(item["path"].endswith(".parquet") for item in files), "files": files}, sort_keys=True).encode()


class OriginalReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="usbf-publish-tests-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        self.root = Path(self.tmp.name)
        self.source, self.work = self.root / "source", self.root / "work"
        self.source.mkdir()
        self.client = FakeS3()
        self.first, self.second = b"exact original first file", b"exact original second file"
        (self.source / "USBF_x+00000_y+00000.parquet").write_bytes(self.first)
        (self.source / "USBF_x+00001_y+00000.parquet").write_bytes(self.second)
        self.raw = manifest([entry("USBF_x+00000_y+00000.parquet", self.first), entry("USBF_x+00001_y+00000.parquet", self.second)])
        self.plan = publisher.publication(self.raw)

    def tearDown(self):
        self.tmp.cleanup()

    def test_publish_verifies_actual_remote_bytes_and_writes_markers_last(self):
        receipt = publisher.archive(self.client, self.raw, self.work, self.source)
        prefix = self.plan["releasePrefix"]
        self.assertTrue(receipt["published"])
        self.assertTrue(receipt["registryPatch"]["original.immutable"])
        self.assertEqual(self.client.puts[-2:], [prefix + "manifest.json", prefix + "release.json"])
        self.assertEqual(len(self.client.reads), 4)
        self.assertEqual(self.client.objects[prefix + "manifest.json"], self.raw)
        marker = json.loads(self.client.objects[prefix + "release.json"])
        self.assertTrue(marker["originalBytesVerified"])
        self.assertIsNone(marker["providerCompleteness"])
        self.assertIsNone(marker["geometryBoundsGuaranteed"])

    def test_interrupted_release_is_not_published_and_resume_never_reuploads(self):
        prefix = self.plan["releasePrefix"]
        self.client.fail_key = prefix + "USBF_x+00001_y+00000.parquet"
        with self.assertRaises(HTTPError):
            publisher.archive(self.client, self.raw, self.work, self.source)
        self.assertNotIn(prefix + "manifest.json", self.client.objects)
        self.assertNotIn(prefix + "release.json", self.client.objects)
        self.assertEqual(len(self.client.puts), 1)
        self.client.fail_key = None
        receipt = publisher.archive(self.client, self.raw, self.work, self.source)
        self.assertTrue(receipt["published"])
        self.assertEqual(self.client.puts.count(prefix + "USBF_x+00000_y+00000.parquet"), 1)
        puts = list(self.client.puts)
        publisher.archive(self.client, self.raw, self.work, self.source)
        self.assertEqual(self.client.puts, puts)

    def test_existing_wrong_remote_bytes_are_kept_and_refused(self):
        key = self.plan["releasePrefix"] + "USBF_x+00000_y+00000.parquet"
        self.client.objects[key] = b"wrong remote bytes"
        with self.assertRaisesRegex(ValueError, "No overwrite"):
            publisher.archive(self.client, self.raw, self.work, self.source)
        self.assertEqual(self.client.objects[key], b"wrong remote bytes")
        self.assertEqual(self.client.puts, [])

    def test_conditional_write_race_requires_matching_remote_bytes(self):
        self.client.race = self.first
        publisher.put_exact(self.client, "opengeos", "race", io.BytesIO(self.first), hashlib.sha256(self.first).hexdigest(), len(self.first), "application/octet-stream")
        self.assertEqual(self.client.objects["race"], self.first)
        self.client.race = b"different concurrent bytes"
        with self.assertRaisesRegex(ValueError, "not overwritten"):
            publisher.put_exact(self.client, "opengeos", "wrong-race", io.BytesIO(self.first), hashlib.sha256(self.first).hexdigest(), len(self.first), "application/octet-stream")

    def test_changed_source_never_creates_a_release_object_or_marker(self):
        (self.source / "USBF_x+00000_y+00000.parquet").write_bytes(b"changed original source")
        with self.assertRaisesRegex(ValueError, "changed|length"):
            publisher.archive(self.client, self.raw, self.work, self.source)
        self.assertEqual(self.client.objects, {})

    def test_manifest_paths_duplicates_and_missing_identities_rejected(self):
        for key in ("../secret", "a/b.parquet", ".hidden", "manifest.json"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                publisher.publication(manifest([entry(key, self.first)]))
        with self.assertRaises(ValueError):
            publisher.publication(manifest([entry("a.parquet", self.first), entry("a.parquet", self.first)]))
        bad = entry("a.parquet", self.first)
        bad["sha256"] = "unknown"
        with self.assertRaises(ValueError):
            publisher.publication(manifest([bad]))


class GeometryIndexTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="usbf-geometry-index-tests-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        cls.root = Path(cls.tmp.name)
        cls.extension = os.environ.get("USBF_SPATIAL_EXTENSION")
        cls.runtime = Runtime(cls.root / "runtime", extension_path=cls.extension, allow_install=not bool(cls.extension))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def build_source(self, expression, rows):
        file = self.root / ("USBF_x+00000_y+00000.parquet")
        file.unlink(missing_ok=True)
        with self.runtime.connection() as c:
            c.execute("COPY (" + expression + ") TO " + sqlstr(file) + " (FORMAT PARQUET)")
        raw = manifest([entry(file.name, file.read_bytes(), rows)])
        return raw, file

    def test_full_envelope_covers_cross_shard_polygon_hole_and_boundary(self):
        raw, _ = self.build_source("SELECT ST_GeomFromText('POLYGON ((-2 -1, 3 -1, 3 4, -2 4, -2 -1), (0 0, 0 1, 1 1, 1 0, 0 0))') AS geometry", 1)
        value = indexer.build(raw, self.root, self.runtime)
        self.assertTrue(value["geometryBoundsGuaranteed"])
        self.assertEqual(value["files"][0]["geometry_bbox"], [-2, -1, 3, 4])
        self.assertEqual(value["sourceManifestSha256"], hashlib.sha256(raw).hexdigest())

    def test_null_empty_and_invalid_geometries_do_not_claim_complete_bounds(self):
        expression = "SELECT ST_Point(1,2) AS geometry UNION ALL SELECT NULL::GEOMETRY UNION ALL SELECT ST_GeomFromText('POLYGON EMPTY') UNION ALL SELECT ST_GeomFromText('POLYGON ((0 0, 2 2, 0 2, 2 0, 0 0))')"
        raw, _ = self.build_source(expression, 4)
        value = indexer.build(raw, self.root, self.runtime, validate_topology=True)
        self.assertFalse(value["geometryBoundsGuaranteed"])
        self.assertEqual(value["files"][0]["missingOrInvalidGeometries"], 3)

    def test_geometry_envelopes_do_not_invent_topology_quality(self):
        raw, _ = self.build_source("SELECT ST_GeomFromText('POLYGON ((0 0, 2 2, 0 2, 2 0, 0 0))') AS geometry", 1)
        value = indexer.build(raw, self.root, self.runtime)
        self.assertTrue(value["geometryBoundsGuaranteed"])
        self.assertFalse(value["topologyValidated"])
        self.assertIsNone(value["files"][0]["missingOrInvalidGeometries"])

    def test_original_hash_count_and_missing_file_are_verified(self):
        raw, file = self.build_source("SELECT ST_Point(1,2) AS geometry", 1)
        bad = json.loads(raw)
        bad["files"][0]["rows"] = 2
        with self.assertRaisesRegex(ValueError, "row count"):
            indexer.build(json.dumps(bad).encode(), self.root, self.runtime)
        file.write_bytes(b"changed")
        with self.assertRaises(ValueError):
            indexer.build(raw, self.root, self.runtime)
        file.unlink()
        with self.assertRaises((ValueError, FileNotFoundError)):
            indexer.build(raw, self.root, self.runtime)


if __name__ == "__main__":
    unittest.main()
