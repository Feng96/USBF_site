"""Provider identity keys and shared-cache lifecycle guards."""
import hashlib
import tempfile
from pathlib import Path
import os
import unittest
import uuid

from usbf_engine.provider_cache import cache_key, source_binding
from usbf_engine.maintenance import EngineMaintenance
from test_maintenance import StubEngine


class ProviderCacheTests(unittest.TestCase):
    def test_identity_key_binds_url_strong_tag_size_release_and_algorithm(self):
        identity={"bytes":100,"etag":'"v1"',"lastModified":"Thu, 05 Nov 2026 12:00:00 GMT"}
        binding=source_binding("https://example.org/a",identity,{"release":"v1"})
        key=cache_key(binding,"providerMetadata",[32,68])
        for url,current,release in [
            ("https://example.org/b",identity,{"release":"v1"}),
            ("https://example.org/a",{**identity,"etag":'"v2"'},{"release":"v1"}),
            ("https://example.org/a",{**identity,"bytes":101},{"release":"v1"}),
            ("https://example.org/a",identity,{"release":"v2"})]:
            self.assertNotEqual(key,cache_key(source_binding(url,current,release),"providerMetadata",[32,68]))
        self.assertNotEqual(key,cache_key(binding,"providerMetadata",[31,69]))

    def test_last_modified_fallback_always_binds_size_and_rejects_weak_only(self):
        identity={"bytes":100,"etag":'W/"v1"',"lastModified":"Thu, 05 Nov 2026 12:00:00 GMT"}
        self.assertEqual(source_binding("https://example.org/a",identity)["identity"],{"bytes":100,"lastModified":identity["lastModified"]})
        for bad in [{"bytes":100},{"bytes":100,"etag":'W/"v1"'},{"bytes":True,"etag":'"v1"'}]:
            with self.assertRaises(ValueError): source_binding("https://example.org/a",bad)

    def test_provider_blobs_share_quota_protection_and_explicit_cleanup(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("USBF_ENGINE_TEST_DIR")) as temporary:
            engine=StubEngine(Path(temporary));maintenance=EngineMaintenance(engine)
            key=hashlib.sha256(b"binding").hexdigest()
            target=maintenance.provider_store(key,"providerMaterialization",b"verified original typed records","job")
            digest=target.stem
            job={"id":str(uuid.uuid4()),"status":"cancelled","parts":[{"providerCacheSha256":digest}]}
            engine.save(job)
            self.assertEqual(maintenance.provider_hit(key,"next"),target)
            status=maintenance.status()["cache"]
            self.assertEqual(status["bytes"],status["providerMaterializationBytes"])
            self.assertEqual(status["bytes"],status["protectedBytes"])
            self.assertEqual(maintenance.cleanup({"dryRun":False,"allUnused":True})["files"],0)
            job["status"]="completed";engine.save(job)
            self.assertEqual(maintenance.cleanup({"allUnused":True})["files"],1)
            self.assertTrue(target.exists())
            self.assertEqual(maintenance.cleanup({"dryRun":False,"allUnused":True})["files"],1)
            self.assertFalse(target.exists())
            self.assertIsNone(maintenance.provider_hit(key,"next"))
            maintenance.configure({"cacheQuotaMiB":0})
            self.assertIsNone(maintenance.provider_store(key,"providerMetadata",b"footer","job"))


if __name__=="__main__":unittest.main()
