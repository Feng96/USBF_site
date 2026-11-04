"""Partial enqueue failures keep a recoverable Project and verified files."""
import copy
import hashlib
import json
from unittest import mock
import unittest

import test_project_packages as fixtures
from usbf_engine.project_dependencies import import_package


class PackageRecoveryTests(unittest.TestCase):
    setUp = fixtures.ProjectPackagesTests.setUp
    tearDown = fixtures.ProjectPackagesTests.tearDown
    package = fixtures.ProjectPackagesTests.package
    rewrite = fixtures.ProjectPackagesTests.rewrite

    def test_boolean_record_count_fails_before_adoption_or_enqueue(self):
        _, file = self.package()
        def change(entries):
            manifest = json.loads(entries['package.json'])
            manifest['dependencies'][0]['recordCount'] = True
            entries['package.json'] = json.dumps(manifest).encode()
        self.rewrite(file, change)
        with self.assertRaisesRegex(ValueError, 'record count'):
            import_package(self.b, {'path': 'Files/map.usbf.zip'})
        self.assertEqual(self.b.jobs(), [])
        self.assertEqual(list((self.b.workspace / 'Files' / 'Projects').iterdir()), [])

    def test_consistent_but_false_saved_counts_fail_against_full_parquet(self):
        _, file = self.package()
        def change(entries):
            project = json.loads(entries['project.json'])
            project['layers'][0]['meta']['nativeSource']['recordCount'] = 2999
            entries['project.json'] = json.dumps(project).encode()
            manifest = json.loads(entries['package.json'])
            manifest['project']['bytes'] = len(entries['project.json'])
            manifest['project']['sha256'] = hashlib.sha256(entries['project.json']).hexdigest()
            manifest['dependencies'][0]['recordCount'] = 2999
            entries['package.json'] = json.dumps(manifest).encode()
        self.rewrite(file, change)
        with self.assertRaisesRegex(ValueError, 'count differs'):
            import_package(self.b, {'path': 'Files/map.usbf.zip'})
        self.assertEqual(self.b.jobs(), [])
        self.assertEqual(list((self.b.workspace / 'Files' / 'Projects').iterdir()), [])

    def test_planning_failure_cannot_adopt_or_queue_any_dependency(self):
        self.package()
        with mock.patch.object(self.b, 'plan', side_effect=ValueError('Injected planning failure')):
            with self.assertRaisesRegex(ValueError, 'planning failure'):
                import_package(self.b, {'path': 'Files/map.usbf.zip'})
        self.assertEqual(self.b.jobs(), [])
        self.assertEqual(list((self.b.workspace / 'Files' / 'Projects').iterdir()), [])

    def test_second_enqueue_failure_preserves_project_receipt_and_cancels_only_new_jobs(self):
        other = fixtures.wait(self.a, self.a.create_job({'schema': 1, 'operation': 'measure',
            'inputs': [{'kind': 'file', 'path': self.job['result']['path'], 'crs': 'EPSG:4326'}]}))
        layer = copy.deepcopy(self.project['layers'][0])
        layer['key'] = 'layer-2'
        layer['meta']['nativeSource'].update(jobId=other['id'], path=other['result']['path'], sha256=other['result']['sha256'])
        self.project['layers'].append(layer)
        self.package()
        original = self.b.create_job
        calls = []
        def enqueue(value):
            calls.append(value)
            if len(calls) == 2:
                raise ValueError('Injected second enqueue failure')
            return original(value)
        with mock.patch.object(self.b, 'create_job', side_effect=enqueue):
            with self.assertRaisesRegex(ValueError, 'recovery details: Files/Projects/'):
                import_package(self.b, {'path': 'Files/map.usbf.zip'})
        queued = self.b.jobs()
        self.assertEqual(len(queued), 1)
        self.assertEqual(queued[0]['status'], 'cancelled')
        folders = list((self.b.workspace / 'Files' / 'Projects').iterdir())
        self.assertEqual(len(folders), 1)
        receipt = json.loads((folders[0] / 'restore-receipt.json').read_text())
        self.assertEqual(receipt['state'], 'needs-recovery')
        self.assertEqual(receipt['jobs'][0]['jobId'], queued[0]['id'])
        self.assertTrue((folders[0] / 'project.usbf.json').exists())
        self.assertEqual(len(list(folders[0].glob('*.parquet'))), 2)
        self.assertTrue(receipt['dataVerified'])


if __name__ == '__main__':
    unittest.main()
