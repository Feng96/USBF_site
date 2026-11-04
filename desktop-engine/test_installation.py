"""Runtime installation/removal boundaries independent of the display server."""
import json
from pathlib import Path
import tempfile
import unittest
from installation import install, uninstall, workspace_identity, workspace_root


class InstallationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='usbf-install-test-')
        self.root = Path(self.temp.name)
        self.payload = self.root / 'payload'
        self.payload.mkdir()
        self.exe = self.payload / 'USBFEngine'
        self.exe.write_bytes(b'Owned runtime fixture')
        self.workspace = self.root / 'workspace'
        self.build = {'version': '0.1.0', 'revision': 'test'}

    def tearDown(self):
        self.temp.cleanup()

    def test_shared_parent_and_stable_identity(self):
        receipt = install(self.payload, self.exe, self.workspace, self.build)
        self.assertTrue(all((self.workspace / name).is_dir() for name in ('Projects', 'Results', 'Cache', 'Files', 'Engine')))
        self.assertEqual((self.workspace / receipt['executable']).read_bytes(), self.exe.read_bytes())
        self.assertEqual(workspace_identity(self.workspace), receipt['workspaceId'])
        self.assertEqual(install(self.payload, self.exe, self.workspace, self.build), receipt)

    def test_unknown_runtime_is_not_overwritten(self):
        folder = self.workspace / 'Engine' / 'runtime' / '0.1.0-test'
        folder.mkdir(parents=True)
        (folder / 'user-file.txt').write_text('Keep')
        with self.assertRaises(ValueError):
            install(self.payload, self.exe, self.workspace, self.build)
        self.assertEqual((folder / 'user-file.txt').read_text(), 'Keep')

    def test_uninstall_preserves_user_data_and_unknown_runtime(self):
        install(self.payload, self.exe, self.workspace, self.build)
        for name in ('Projects', 'Results', 'Files', 'Cache'):
            (self.workspace / name / 'keep.txt').write_text('Keep ' + name)
        unknown = self.workspace / 'Engine' / 'runtime' / 'external'
        unknown.mkdir()
        (unknown / 'keep.txt').write_text('External')
        self.assertEqual(len(uninstall(self.workspace)), 1)
        self.assertTrue(all((self.workspace / name / 'keep.txt').exists() for name in ('Projects', 'Results', 'Files', 'Cache')))
        self.assertTrue((unknown / 'keep.txt').exists())
        self.assertFalse(json.loads((self.workspace / 'Engine' / 'install-receipt.json').read_text())['installed'])

    def test_rebuild_identity_conflict_keeps_previous_runtime(self):
        receipt = install(self.payload, self.exe, self.workspace, self.build)
        self.exe.write_bytes(b'Different unreviewed build')
        with self.assertRaises(ValueError):
            install(self.payload, self.exe, self.workspace, self.build)
        self.assertEqual((self.workspace / receipt['executable']).read_bytes(), b'Owned runtime fixture')

    def test_uninstall_unknown_parent_creates_nothing(self):
        self.assertEqual(uninstall(self.workspace), [])
        self.assertFalse(self.workspace.exists())

    def test_symlink_runtime_cannot_remove_external_folder(self):
        workspace_root(self.workspace)
        workspace_identity(self.workspace)
        outside = self.root / 'outside'
        outside.mkdir()
        (outside / 'keep').write_text('Keep')
        try:
            (self.workspace / 'Engine' / 'runtime').symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest('Symbolic links are unavailable')
        with self.assertRaises(ValueError):
            uninstall(self.workspace)
        self.assertTrue((outside / 'keep').exists())


if __name__ == '__main__':
    unittest.main()
