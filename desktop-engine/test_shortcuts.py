"""Launch entries survive updates and remove only their own unchanged bytes."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from installation import install
from shortcuts import install_shortcuts, remove_shortcuts


class ShortcutTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='usbf-shortcut-')
        self.root = Path(self.temp.name)
        self.workspace = self.root / "workspace ' $ % name"
        self.payload = self.root / 'payload'
        self.payload.mkdir()
        self.executable = self.payload / 'USBFEngine'
        self.executable.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > ' + str(self.root / 'args.txt') + '\n')
        self.executable.chmod(0o700)
        self.receipt = install(self.payload, self.executable, self.workspace, {'version': '0.2.0', 'revision': 'first'})
        self.user = self.root / 'user menu'

    def tearDown(self):
        self.temp.cleanup()

    @unittest.skipIf(os.name == 'nt', 'POSIX launcher execution')
    def test_linux_launcher_passes_exact_workspace_without_shell_expansion(self):
        value = install_shortcuts(self.workspace, self.receipt, platform='linux', user_directory=self.user)
        subprocess.run([str(self.workspace / value['launcher'])], check=True)
        self.assertEqual((self.root / 'args.txt').read_text().splitlines(), ['--workspace', str(self.workspace.resolve())])
        menu = list((self.user / 'applications').glob('*.desktop'))
        self.assertEqual(len(menu), 1)
        self.assertIn('Terminal=false', menu[0].read_text())
        self.assertIn('%%', menu[0].read_text())

    def test_upgrade_updates_owned_launcher_but_keeps_changed_user_entry(self):
        first = install_shortcuts(self.workspace, self.receipt, platform='linux', user_directory=self.user)
        menu = next((self.user / 'applications').glob('*.desktop'))
        menu.write_text('A custom user entry')
        second_receipt = install(self.payload, self.executable, self.workspace, {'version': '0.2.0', 'revision': 'second'})
        second = install_shortcuts(self.workspace, second_receipt, platform='linux', user_directory=self.user)
        self.assertIn('second', (self.workspace / second['launcher']).read_text())
        self.assertEqual(menu.read_text(), 'A custom user entry')
        removed = remove_shortcuts(self.workspace, platform='linux', user_directory=self.user)
        self.assertEqual(removed['changedEntriesKept'], 1)
        self.assertTrue(menu.exists())
        self.assertFalse((self.workspace / first['launcher']).exists())

    def test_windows_menu_quotes_paths_and_escapes_percent_expansion(self):
        value = install_shortcuts(self.workspace, self.receipt, platform='win32', user_directory=self.user)
        launcher = self.workspace / value['launcher']
        text = launcher.read_text()
        self.assertIn('start "USBF Engine" "', text)
        self.assertIn('%%', text)
        self.assertIn('"--workspace"', text)
        menu = list(self.user.rglob('*.cmd'))
        self.assertEqual(len(menu), 1)
        removed = remove_shortcuts(self.workspace, platform='win32', user_directory=self.user)
        self.assertEqual(len(removed['removed']), 2)

    def test_mac_application_entry_targets_owned_installed_app(self):
        payload = self.root / 'USBFEngine.app'
        executable = payload / 'Contents' / 'MacOS' / 'USBFEngine'
        executable.parent.mkdir(parents=True)
        executable.write_text('fixture')
        receipt = install(payload, executable, self.workspace, {'version': '0.2.0', 'revision': 'mac'})
        try:
            value = install_shortcuts(self.workspace, receipt, platform='darwin', user_directory=self.user)
        except OSError:
            self.skipTest('Symbolic links unavailable')
        alias = next((self.user / 'Applications').glob('*.app'))
        self.assertTrue(alias.is_symlink())
        self.assertTrue(alias.resolve().is_relative_to(self.workspace.resolve() / 'Engine' / 'runtime'))
        self.assertTrue((self.workspace / value['launcher']).is_file())
        remove_shortcuts(self.workspace, platform='darwin', user_directory=self.user)
        self.assertFalse(alias.is_symlink())

    def test_forged_receipt_cannot_remove_an_unrelated_file(self):
        install_shortcuts(self.workspace, self.receipt, platform='linux', user_directory=self.user)
        unrelated = self.root / 'user-result.txt'
        unrelated.write_bytes(b'keep')
        import hashlib
        receipt = self.workspace / 'Engine' / 'shortcuts.json'
        value = json.loads(receipt.read_text())
        value['entries'].append({'path': str(unrelated), 'kind': 'file', 'sha256': hashlib.sha256(b'keep').hexdigest()})
        receipt.write_text(json.dumps(value))
        remove_shortcuts(self.workspace, platform='linux', user_directory=self.user)
        self.assertEqual(unrelated.read_bytes(), b'keep')

    def test_unknown_uninstall_creates_nothing(self):
        other = self.root / 'does-not-exist'
        self.assertEqual(remove_shortcuts(other)['removed'], [])
        self.assertFalse(other.exists())


if __name__ == '__main__':
    unittest.main()
