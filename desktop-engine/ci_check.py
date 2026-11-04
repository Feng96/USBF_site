"""Test the built installer and its copied runtime on the actual target OS."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import platform
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
    subprocess.run(prefix + [str(executable), '--gui-smoke'], check=True, timeout=60)
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
    installed = workspace / receipt['executable']
    report = args.work / 'runtime-selftest.json'
    tls_environment = {**os.environ,
                       'SSL_CERT_FILE': str(args.work / 'missing-host-cert.pem'),
                       'SSL_CERT_DIR': str(args.work / 'missing-host-certificates')}
    subprocess.run([str(installed), '--self-test', '--workspace', str(workspace),
                    '--report', str(report)], check=True, timeout=180, env=tls_environment)
    result = json.loads(report.read_text(encoding='utf-8'))
    assert result['passed'], result
    markers = []
    for name in ('Projects', 'Results', 'Files', 'Cache'):
        marker = workspace / name / 'user-file-kept.txt'
        marker.write_text('user data', encoding='utf-8')
        markers.append(marker)
    # Launch from the original bundle to test cleanup independently of locked binaries.
    subprocess.run([str(executable), '--uninstall', '--yes', '--workspace', str(workspace)],
                   check=True, timeout=60)
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline and (workspace / receipt['runtime']).exists():
        time.sleep(.2)
    assert not (workspace / receipt['runtime']).exists(), 'The managed runtime was not removed'
    assert all(p.read_text(encoding='utf-8') == 'user data' for p in markers)
    assert json.loads(receipt_path.read_text(encoding='utf-8'))['installed'] is False
    result['checks'] += ['Actual installer installs into the chosen workspace',
                         'Packaged Tk interface opens on the target OS',
                         'Uninstall removes its runtime and preserves user folders']
    (args.assets / 'acceptance.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': True, 'checks': len(result['checks']), 'platform': platform.system()}))


if __name__ == '__main__':
    main()
