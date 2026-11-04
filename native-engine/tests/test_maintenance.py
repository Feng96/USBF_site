"""Resource/cache maintenance never trades reproducibility for free space."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import unittest
import uuid
from unittest import mock

from usbf_engine.maintenance import EngineMaintenance


class StubRuntime:
    threads = 2
    memory_limit = '1GB'

    def information(self):
        return {'threads': self.threads, 'memoryLimit': self.memory_limit}


class StubEngine:
    def __init__(self, root):
        self.workspace = root
        self.workspace_id = str(uuid.uuid4())
        self.mutex = threading.RLock()
        self.runtime = StubRuntime()
        self.build_info = {'signed': False}
        for folder in ('Engine', 'Files', 'Projects', 'Cache', 'Results'):
            (root / folder).mkdir()
        self.db = root / 'Engine' / 'test.sqlite3'
        with self._database() as connection:
            connection.execute('CREATE TABLE jobs(id TEXT, document TEXT)')

    @contextmanager
    def _database(self):
        connection = sqlite3.connect(self.db)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _active_count(self):
        with self._database() as connection:
            return connection.execute("SELECT count(*) FROM jobs WHERE json_extract(document,'$.status') IN ('queued','running','cancelling')").fetchone()[0]

    def _hash_file(self, path, *_):
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()

    def result_path(self, job_id, format='parquet'):
        return self.workspace / 'Results' / (job_id + ('.metadata.json' if format == 'metadata' else '.parquet'))

    def save(self, job):
        with self._database() as connection:
            connection.execute('DELETE FROM jobs WHERE id=?', [job['id']])
            connection.execute('INSERT INTO jobs VALUES(?,?)', [job['id'], json.dumps(job)])


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='usbf-maintenance-', dir=os.environ.get('USBF_ENGINE_TEST_DIR'))
        self.root = Path(self.temp.name)
        self.engine = StubEngine(self.root)
        self.maintenance = EngineMaintenance(self.engine)

    def tearDown(self):
        self.temp.cleanup()

    def source(self, content=b'verified source'):
        path = self.root / 'Cache' / (uuid.uuid4().hex + '.download')
        path.write_bytes(content)
        return path, {'id': '0', 'sha256': self.engine._hash_file(path), 'bytes': len(content), 'format': 'parquet'}

    def test_verified_bytes_are_reused_across_jobs_and_formats(self):
        source, part = self.source()
        common = self.maintenance.source_store(part, source, 'job1')
        self.assertFalse(source.exists())
        other = {**part, 'id': '9', 'format': 'geoparquet'}
        self.assertEqual(self.maintenance.source_hit(other, 'job2'), common)
        status = self.maintenance.status()['cache']
        self.assertEqual(status['files'], 1)
        self.assertEqual(status['deduplicatedHits'], 1)
        common.write_bytes(b'changed bytes')
        self.assertIsNone(self.maintenance.source_hit(other, 'job3'))

    def test_unfinished_tasks_protect_shared_sources_and_checkpoints(self):
        source, part = self.source()
        common = self.maintenance.source_store(part, source, 'job1')
        for status in ('interrupted', 'partial', 'failed', 'cancelled'):
            job = {'id': str(uuid.uuid4()), 'status': status, 'parts': [part]}
            self.engine.save(job)
        result = self.maintenance.cleanup({'dryRun': False, 'allUnused': True})
        self.assertEqual(result['files'], 0)
        self.assertTrue(common.exists())
        self.assertEqual(result['status']['cache']['protectedBytes'], part['bytes'])

    def test_cleanup_is_preview_by_default_and_keeps_all_user_files(self):
        source, part = self.source()
        common = self.maintenance.source_store(part, source, 'job1')
        for folder in ('Projects', 'Files', 'Results'):
            (self.root / folder / 'keep').write_text('user data')
        preview = self.maintenance.cleanup({'allUnused': True})
        self.assertTrue(preview['dryRun'])
        self.assertEqual(preview['files'], 1)
        self.assertTrue(common.exists())
        cleaned = self.maintenance.cleanup({'dryRun': False, 'allUnused': True})
        self.assertEqual(cleaned['bytes'], part['bytes'])
        self.assertFalse(common.exists())
        self.assertTrue(all((self.root / folder / 'keep').read_text() == 'user data' for folder in ('Projects', 'Files', 'Results')))

    def completed_job(self):
        job_id = str(uuid.uuid4())
        directory = self.root / 'Cache' / 'native-jobs' / job_id
        directory.mkdir(parents=True)
        checkpoint = directory / '0.parquet'
        checkpoint.write_bytes(b'checkpoint')
        result = self.engine.result_path(job_id)
        result.write_bytes(b'published complete result')
        digest = self.engine._hash_file(result)
        self.engine.result_path(job_id, 'metadata').write_text(json.dumps({'jobId': job_id, 'sha256': digest}))
        part = {'id': '0', 'format': 'parquet', 'checkpointSha256': self.engine._hash_file(checkpoint)}
        job = {'id': job_id, 'status': 'completed', 'parts': [part], 'result': {'sha256': digest}}
        self.engine.save(job)
        return job, checkpoint, result

    def test_completed_intermediates_removed_only_with_intact_result_and_receipt(self):
        job, checkpoint, result = self.completed_job()
        unknown = checkpoint.parent / 'user-file'
        unknown.write_text('keep')
        self.assertEqual(self.maintenance.cleanup({'dryRun': False})['files'], 1)
        self.assertFalse(checkpoint.exists())
        self.assertTrue(result.exists())
        self.assertTrue(unknown.exists())
        with self.engine._database() as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM jobs').fetchone()[0], 1)

    def test_changed_result_protects_its_last_good_checkpoint(self):
        _, checkpoint, result = self.completed_job()
        result.write_bytes(b'changed by another app')
        self.assertEqual(self.maintenance.cleanup({'dryRun': False})['files'], 0)
        self.assertTrue(checkpoint.exists())

    def test_changed_cache_and_unknown_files_are_kept(self):
        source, part = self.source()
        common = self.maintenance.source_store(part, source, 'job1')
        common.write_bytes(b'x' * part['bytes'])
        unknown = common.parent / 'unrecognized.txt'
        unknown.write_text('keep')
        result = self.maintenance.cleanup({'dryRun': False, 'allUnused': True})
        self.assertEqual(result['files'], 0)
        self.assertGreater(result['skipped'], 0)
        self.assertTrue(common.exists())
        self.assertTrue(unknown.exists())

    def test_symlinked_cache_never_reaches_external_files(self):
        outside = self.root / 'Files' / 'outside'
        outside.mkdir()
        (outside / 'keep').write_text('keep')
        try:
            self.maintenance.root.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest('Symlinks unavailable')
        with self.assertRaises(ValueError):
            self.maintenance.cleanup({'dryRun': False, 'allUnused': True})
        self.assertEqual((outside / 'keep').read_text(), 'keep')

    def test_active_jobs_block_cleanup_and_setting_changes(self):
        self.engine.save({'id': str(uuid.uuid4()), 'status': 'running'})
        with self.assertRaises(ValueError):
            self.maintenance.configure({'threads': 1})
        with self.assertRaises(ValueError):
            self.maintenance.cleanup({'dryRun': False})

    def test_settings_are_validated_and_persist_without_project_changes(self):
        self.maintenance.configure({'threads': 1, 'memoryMiB': 512, 'cacheQuotaMiB': 0})
        second = EngineMaintenance(self.engine)
        self.assertEqual(second.settings, {'threads': 1, 'memoryMiB': 512, 'cacheQuotaMiB': 0})
        self.assertEqual(self.engine.runtime.memory_limit, '512MiB')
        source, part = self.source()
        self.assertEqual(second.source_store(part, source, 'job'), source)
        for invalid in ({'threads': True}, {'memoryMiB': 1}, {'cacheQuotaMiB': -1}, {'sql': 'DROP TABLE jobs'}):
            with self.assertRaises(ValueError):
                second.configure(invalid)

    def test_diagnostics_are_factual_and_do_not_claim_network_or_signing(self):
        value = self.maintenance.diagnostics()
        self.assertTrue(value['passed'])
        self.assertEqual(value['execution'], 'local')
        self.assertFalse(value['networkTested'])
        self.assertFalse(value['publisherSignature'])


@unittest.skipUnless(os.environ.get('USBF_SPATIAL_EXTENSION'), 'Real native cache integration needs the official Spatial extension')
class NativeCacheIntegration(unittest.TestCase):
    def test_two_real_tasks_download_once_then_cleanup_keeps_both_full_results(self):
        from usbf_engine import Engine
        with tempfile.TemporaryDirectory(prefix='usbf-cache-integration-', dir=os.environ.get('USBF_ENGINE_TEST_DIR')) as temporary:
            root = Path(temporary)
            data = json.dumps({'type': 'FeatureCollection', 'features': [
                {'type': 'Feature', 'properties': {'raw_id': '9007199254740993123', 'flag': False},
                 'geometry': {'type': 'Point', 'coordinates': [-77, 39]}},
                {'type': 'Feature', 'properties': {'raw_id': '9007199254740993124', 'flag': False},
                 'geometry': {'type': 'Point', 'coordinates': [-77.001, 39]}}
            ]}).encode()
            calls = []
            def downloader(part, target, job):
                calls.append(part['url'])
                target.write_bytes(data)
            engine = Engine(root, extension_path=os.environ['USBF_SPATIAL_EXTENSION'], downloader=downloader)
            try:
                spec = {'schema': 1, 'operation': 'load', 'inputs': [{'kind': 'url', 'url': 'https://data.source.coop/qa/fixture.geojson',
                        'format': 'geojson', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}]}
                finished = []
                for _ in range(2):
                    with mock.patch('usbf_engine.validation.socket.getaddrinfo', return_value=[(2, 1, 6, '', ('1.1.1.1', 443))]):
                        job = engine.create_job(spec)
                    deadline = time.monotonic() + 30
                    while time.monotonic() < deadline:
                        job = engine.get_job(job['id'])
                        if job['status'] in {'completed', 'failed', 'partial', 'cancelled'}:
                            break
                        time.sleep(.02)
                    self.assertEqual(job['status'], 'completed', job)
                    self.assertEqual(job['result']['rows'], 2)
                    finished.append(job)
                self.assertEqual(len(calls), 1)
                self.assertEqual(engine.maintenance.status()['cache']['files'], 1)
                cleaned = engine.maintenance.cleanup({'dryRun': False, 'allUnused': True})
                self.assertEqual(cleaned['files'], 3)
                for job in finished:
                    self.assertTrue(engine.result_path(job['id']).exists())
                    preview = engine.preview(job['id'])
                    self.assertEqual(len(preview['features']), 2)
                    self.assertEqual(preview['features'][0]['properties']['raw_id'], '9007199254740993123')
            finally:
                engine.close()


if __name__ == '__main__':
    unittest.main()
