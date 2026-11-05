"""Test the built installer and its copied runtime on the actual target OS."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    args = parser.parse_args()
    metadata = [p for p in args.assets.glob('usbf-engine-*.json')]
    assert len(metadata) == 1, 'Exactly one target build is required'
    build = json.loads(metadata[0].read_text(encoding='utf-8'))
    executable = Path(build['executable'])
    prefix = ['xvfb-run', '-a'] if platform.system() == 'Linux' else []
    for mode in (['--install'], []):
        subprocess.run(prefix + [str(executable), '--gui-smoke', '--workspace', str(args.work / 'gui-smoke')] + mode,
                       check=True, timeout=90)
    workspace = args.work / 'installed workspace'
    args.work.mkdir(parents=True, exist_ok=True)
    asset = args.assets / build['asset']
    if platform.system() == 'Windows':
        # NSIS parses quotes around the option VALUE. list2cmdline would quote
        # the entire /WORKSPACE=... argument, hiding the option from GetOptions.
        command = '"' + str(asset) + '" /WORKSPACE="' + str(workspace) + '"'
    elif platform.system() == 'Linux':
        command = ['sh', str(asset), '--workspace', str(workspace), '--no-start']
    else:
        mount = args.work / 'mounted'
        mount.mkdir(exist_ok=True)
        subprocess.run(['hdiutil', 'attach', str(asset), '-mountpoint', str(mount), '-nobrowse', '-quiet'], check=True)
        command = [str(mount / 'USBFEngine.app' / 'Contents' / 'MacOS' / 'USBFEngine'),
                   '--install', '--workspace', str(workspace), '--no-start']
    try:
        subprocess.run(command, check=True, timeout=300)
    finally:
        if platform.system() == 'Darwin':
            subprocess.run(['hdiutil', 'detach', str(mount), '-quiet'], check=True)
    receipt_path = workspace / 'Engine' / 'install-receipt.json'
    receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
    assert receipt['installed'] is True
    shortcut_receipt = workspace / 'Engine' / 'shortcuts.json'
    shortcuts = json.loads(shortcut_receipt.read_text(encoding='utf-8'))
    assert shortcuts['workspaceId'] == receipt['workspaceId']
    assert len(shortcuts['entries']) == 2, 'Workspace launcher and per-user application entry are installed'
    for entry in shortcuts['entries']:
        assert Path(entry['path']).exists()
    installed = workspace / receipt['executable']
    report = args.work / 'runtime-selftest.json'
    tls_environment = {**os.environ,
                       'SSL_CERT_FILE': str(args.work / 'missing-host-cert.pem'),
                       'SSL_CERT_DIR': str(args.work / 'missing-host-certificates')}
    selftest = None
    try:
        selftest = subprocess.run([str(installed), '--self-test', '--workspace', str(workspace),
                                  '--report', str(report)], check=False, timeout=180, env=tls_environment)
    finally:
        if report.is_file():
            shutil.copyfile(report, args.assets / report.name)
            if selftest is None or selftest.returncode:
                print(report.read_text(encoding='utf-8-sig', errors='replace'), flush=True)
    selftest.check_returncode()
    result = json.loads(report.read_text(encoding='utf-8'))
    assert result['passed'], result
    markers = []
    for name in ('Projects', 'Results', 'Files', 'Cache'):
        marker = workspace / name / 'user-file-kept.txt'
        marker.write_text('user data', encoding='utf-8')
        markers.append(marker)
    # Windows must exercise deletion of the runtime whose executable is running.
    cleanup_executable = installed if platform.system() == 'Windows' else executable
    subprocess.run([str(cleanup_executable), '--uninstall', '--yes', '--workspace', str(workspace),
                    '--report', str(args.work / 'uninstall-command.json')],
                   check=True, timeout=60)
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline and (workspace / receipt['runtime']).exists():
        time.sleep(.2)
    if (workspace / receipt['runtime']).exists():
        status = workspace / 'Engine' / 'uninstall-status.json'
        detail = status.read_text(encoding='utf-8-sig') if status.is_file() else 'No cleanup worker status was written.'
        worker_log = workspace / 'Engine' / 'uninstall-worker.log'
        if worker_log.is_file():
            detail += '\n' + worker_log.read_text(encoding='utf-8-sig', errors='replace')[-12000:]
        (args.assets / 'uninstall-failure.txt').write_text(detail, encoding='utf-8')
        raise AssertionError('The managed runtime was not removed: ' + detail)
    assert all(p.read_text(encoding='utf-8') == 'user data' for p in markers)
    assert json.loads(receipt_path.read_text(encoding='utf-8'))['installed'] is False
    assert not json.loads(shortcut_receipt.read_text(encoding='utf-8'))['entries'], 'Owned launchers are removed on uninstall'
    assert all(not Path(entry['path']).exists() for entry in shortcuts['entries'])
    result['checks'] += ['Actual installer installs into the chosen workspace',
                         'Packaged Tk interface opens on the target OS',
                         'Workspace and application-menu launch entries are installed and removed by ownership',
                         'Uninstall removes its runtime and preserves user folders']
    (args.assets / 'acceptance.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': True, 'checks': len(result['checks']), 'platform': platform.system()}))


if __name__ == '__main__':
    main()
