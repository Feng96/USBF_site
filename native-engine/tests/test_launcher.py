"""Windowed installer commands must fail without an interactive exception modal."""
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'desktop-engine'))
import launcher


class LauncherCommandTests(unittest.TestCase):
    def test_windowed_command_failure_writes_report_and_returns_one(self):
        with tempfile.TemporaryDirectory() as folder:
            report = Path(folder) / 'report.json'
            report.write_text(json.dumps({'passed': False, 'checks': ['kept previous self-test detail']}))
            with mock.patch.object(launcher, 'main', side_effect=RuntimeError('Install path invalid.')), mock.patch.object(sys, 'stderr', io.StringIO()):
                code = launcher.command_entrypoint(['--install', '--report', str(report)])
            self.assertEqual(code, 1)
            result = json.loads(report.read_text())
            self.assertFalse(result['passed'])
            self.assertEqual(result['errorType'], 'RuntimeError')
            self.assertEqual(result['checks'], ['kept previous self-test detail'])

    def test_argparse_exit_is_not_swallowed(self):
        with mock.patch.object(launcher, 'main', side_effect=SystemExit(2)):
            with self.assertRaises(SystemExit): launcher.command_entrypoint(['--unknown'])

    def test_windowed_headless_rejects_before_starting_a_service(self):
        with mock.patch.object(sys, 'stdout', None), mock.patch.object(launcher, 'backend') as backend:
            with self.assertRaisesRegex(RuntimeError, 'desktop interface'):
                launcher.run_headless(SimpleNamespace())
            backend.assert_not_called()

    def test_console_headless_prints_single_local_expiring_pairing_code(self):
        engine = SimpleNamespace(pairing_code=lambda: '12345678')
        server = SimpleNamespace(server_address=('127.0.0.1', 52763))
        output = io.StringIO()
        args = SimpleNamespace(workspace=Path('/unused'), port=52763, allow_origin=['https://feng96.github.io'])
        with mock.patch.object(launcher, 'backend', return_value=(engine, server)), mock.patch.object(launcher, 'shutdown'), mock.patch.object(launcher.threading, 'Event'), mock.patch.object(launcher.signal, 'signal'), mock.patch.object(sys, 'stdout', output):
            self.assertEqual(launcher.run_headless(args), 0)
        startup = json.loads(output.getvalue())
        self.assertEqual(startup['pairingCode'], '12345678')
        self.assertEqual(startup['expiresInSeconds'], 180)


if __name__ == '__main__':
    unittest.main()
