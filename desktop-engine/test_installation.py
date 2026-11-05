"""Runtime installation/removal boundaries independent of the display server."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock
import psutil
from installation import install, uninstall, workspace_identity, workspace_root, windows_deferred_uninstall


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

    def test_deferred_launch_failure_is_recorded_without_removing_files(self):
        receipt = install(self.payload, self.exe, self.workspace, self.build)
        captured = []
        def failure(script, plan, log, scratch):
            captured.append(scratch)
            self.assertEqual(json.loads((self.workspace / 'Engine' / 'uninstall-status.json').read_text())['state'], 'pending')
            raise OSError('System helper could not start')
        try:
            with mock.patch('installation._launch_cleanup', side_effect=failure):
                with self.assertRaisesRegex(OSError, 'could not start'):
                    windows_deferred_uninstall(self.workspace)
            status = json.loads((self.workspace / 'Engine' / 'uninstall-status.json').read_text())
            self.assertEqual(status['state'], 'error')
            self.assertEqual(status['phase'], 'launching')
            self.assertTrue((self.workspace / receipt['runtime']).is_dir())
        finally:
            for folder in captured: shutil.rmtree(folder)

    def powershell(self):
        executable = os.environ.get('USBF_TEST_POWERSHELL')
        if not executable and os.name == 'nt':
            executable = str(Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32' / 'WindowsPowerShell' / 'v1.0' / 'powershell.exe')
        if not executable or not Path(executable).is_file():
            self.skipTest('PowerShell execution requires Windows or USBF_TEST_POWERSHELL')
        return executable

    def execute_cleanup(self, transform=None):
        executable = self.powershell()
        captured = []
        with mock.patch('installation._launch_cleanup', side_effect=lambda *args: captured.append(args)):
            windows_deferred_uninstall(self.workspace)
        script, plan, _, scratch = captured[0]
        try:
            data = json.loads(plan.read_text())
            data['requesterPid'] = 2147483647  # A process which already exited.
            if transform: transform(data)
            plan.write_text(json.dumps(data), encoding='utf-8')
            process = subprocess.run([executable, '-NoProfile', '-NonInteractive', '-File', str(script), '-PlanPath', str(plan)],
                                     cwd=scratch, capture_output=True, text=True, timeout=20)
            status = json.loads((self.workspace / 'Engine' / 'uninstall-status.json').read_text())
            return process, status
        finally:
            shutil.rmtree(scratch)

    def test_real_powershell_removes_owned_runtime_and_keeps_user_files(self):
        self.powershell()
        receipt = install(self.payload, self.exe, self.workspace, self.build)
        for name in ('Projects', 'Results', 'Files', 'Cache'):
            (self.workspace / name / 'keep.txt').write_text('Keep')
        unknown = self.workspace / 'Engine' / 'runtime' / 'external'
        unknown.mkdir()
        (unknown / 'keep.txt').write_text('External')
        process, status = self.execute_cleanup()
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(status['state'], 'complete', status)
        self.assertEqual(status['removed'], [receipt['runtime']])
        self.assertFalse((self.workspace / receipt['runtime']).exists())
        self.assertTrue((unknown / 'keep.txt').exists())
        self.assertTrue(all((self.workspace / name / 'keep.txt').exists() for name in ('Projects', 'Results', 'Files', 'Cache')))

    def test_real_powershell_refuses_a_changed_outside_target(self):
        self.powershell()
        receipt = install(self.payload, self.exe, self.workspace, self.build)
        outside = self.root / 'outside'
        outside.mkdir()
        (outside / 'keep.txt').write_text('Keep')
        process, status = self.execute_cleanup(lambda plan: plan.update(targets=[str(outside)]))
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(status['state'], 'error')
        self.assertIn('Invalid runtime path', status['error'])
        self.assertTrue((outside / 'keep.txt').exists())
        self.assertTrue((self.workspace / receipt['runtime']).is_dir())

    @unittest.skipUnless(os.name == 'nt', 'Actual detached system PowerShell launch requires Windows')
    def test_windows_self_removal_from_a_runtime_working_directory(self):
        receipt = install(self.payload, self.exe, self.workspace, self.build)
        runtime = self.workspace / receipt['runtime']
        module_dir = str(Path(__file__).resolve().parent)
        code = 'import sys;sys.path.insert(0,sys.argv[1]);from pathlib import Path;from installation import windows_deferred_uninstall;windows_deferred_uninstall(Path(sys.argv[2]))'
        subprocess.run([sys.executable, '-c', code, module_dir, str(self.workspace)], cwd=runtime / self.payload.name,
                       check=True, timeout=15)
        deadline = time.monotonic() + 40
        status_path = self.workspace / 'Engine' / 'uninstall-status.json'
        status = {}
        try:
            while time.monotonic() < deadline:
                try:
                    status = json.loads(status_path.read_text())
                except (PermissionError, FileNotFoundError, json.JSONDecodeError):
                    time.sleep(.1)
                    continue
                if status['state'] in {'complete', 'error'}: break
                time.sleep(.1)
            else:
                self.fail('Timed out waiting for runtime self-removal: ' + str(status))
            self.assertEqual(status['state'], 'complete', status)
            self.assertFalse(runtime.exists())
        finally:
            # A terminal receipt is written before the PowerShell process returns.
            # Release its log handle even when polling or an assertion fails.
            cleanup_pid = status.get('cleanupPid')
            if cleanup_pid:
                try:
                    psutil.Process(cleanup_pid).wait(timeout=15)
                except psutil.NoSuchProcess:
                    pass


if __name__ == '__main__':
    unittest.main()
