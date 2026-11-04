"""Produce a self-contained, explicitly unsigned preview package on its target OS."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile

VERSION = '0.1.0-preview.1'


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def extension_file(folder: Path) -> Path:
    import duckdb
    connection = duckdb.connect()
    machine = connection.execute('PRAGMA platform').fetchone()[0]
    version = duckdb.__version__
    target = folder / 'spatial.duckdb_extension'
    if not target.exists():
        url = f'https://extensions.duckdb.org/v{version}/{machine}/spatial.duckdb_extension.gz'
        request = urllib.request.Request(url, headers={'User-Agent': f'DuckDB/v{version}'})
        compressed = folder / 'spatial.duckdb_extension.gz'
        with urllib.request.urlopen(request, timeout=120) as response, compressed.open('wb') as output:
            shutil.copyfileobj(response, output, 1024 * 1024)
        partial = target.with_suffix('.partial')
        try:
            size = 0
            with gzip.open(compressed, 'rb') as source, partial.open('wb') as output:
                for block in iter(lambda: source.read(1024 * 1024), b''):
                    size += len(block)
                    if size > 512 * 1024 * 1024:
                        raise RuntimeError('The spatial extension exceeds its build budget.')
                    output.write(block)
            partial.replace(target)
        finally:
            partial.unlink(missing_ok=True)
    # LOAD retains DuckDB's official signature verification.
    connection.execute("LOAD '" + str(target).replace("'", "''") + "'")
    assert connection.execute('SELECT ST_AsText(ST_Point(1, 2))').fetchone()[0] == 'POINT (1 2)'
    connection.close()
    return target


def make_linux_installer(bundle: Path, output: Path) -> None:
    archive = output.with_suffix('.tar.gz')
    with tarfile.open(archive, 'w:gz') as stream:
        stream.add(bundle, arcname=bundle.name)
    header = '''#!/bin/sh
set -eu
USBF_INSTALL_TMP=$(mktemp -d "${TMPDIR:-/tmp}/usbf-install.XXXXXX")
trap 'rm -rf "$USBF_INSTALL_TMP"' EXIT HUP INT TERM
USBF_PAYLOAD_LINE=$(awk '/^__USBF_PAYLOAD__$/{print NR + 1; exit}' "$0")
tail -n +"$USBF_PAYLOAD_LINE" "$0" | tar -xz -C "$USBF_INSTALL_TMP"
if [ "$#" -gt 0 ]; then
  "$USBF_INSTALL_TMP/USBFEngine/USBFEngine" --install "$@"
else
  "$USBF_INSTALL_TMP/USBFEngine/USBFEngine"
fi
exit $?
__USBF_PAYLOAD__
'''.encode()
    with output.open('wb') as target, archive.open('rb') as source:
        target.write(header)
        shutil.copyfileobj(source, target)
    output.chmod(0o755)
    archive.unlink()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    work, output = args.work.resolve(), args.output.resolve()
    work.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    os.environ['PYINSTALLER_CONFIG_DIR'] = str(work / 'pyinstaller-cache')
    repository = Path(__file__).resolve().parents[1]
    extension = extension_file(work)
    extension_resource = work / 'spatial.duckdb_extension.gz'
    if not extension_resource.exists():
        with extension.open('rb') as source, gzip.open(extension_resource, 'wb') as target:
            shutil.copyfileobj(source, target, 1024 * 1024)
    import duckdb
    system = platform.system().lower()
    architecture = {'amd64': 'x86_64', 'aarch64': 'arm64'}.get(platform.machine().lower(), platform.machine().lower())
    build = {'version': VERSION, 'revision': args.revision, 'platform': system,
             'architecture': architecture, 'duckdb': duckdb.__version__,
             'spatialExtensionSha256': digest(extension), 'signed': False,
             'signatureKind': 'ad-hoc' if system == 'darwin' else 'none'}
    info = work / 'engine-build.json'
    info.write_text(json.dumps(build, indent=2) + '\n', encoding='utf-8')
    command = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir',
               '--name', 'USBFEngine', '--distpath', str(work / 'dist'),
               '--workpath', str(work / 'pyinstaller'), '--specpath', str(work),
               '--paths', str(repository / 'native-engine'),
               '--paths', str(repository / 'desktop-engine'),
               '--collect-all', 'duckdb',
               '--copy-metadata', 'duckdb', '--copy-metadata', 'psutil',
               '--hidden-import', '_duckdb',
               '--add-data', str(extension_resource) + os.pathsep + '.',
               '--add-data', str(info) + os.pathsep + '.',
               '--add-data', str(repository / 'desktop-engine' / 'THIRD_PARTY_NOTICES.md') + os.pathsep + '.']
    if system in ('windows', 'darwin'):
        command += ['--windowed']
    command += [str(repository / 'desktop-engine' / 'launcher.py')]
    subprocess.run(command, check=True)
    name = f'usbf-engine-{VERSION}-{system}-{architecture}'
    if system == 'linux':
        bundle = work / 'dist' / 'USBFEngine'
        asset = output / (name + '.run')
        make_linux_installer(bundle, asset)
        executable = bundle / 'USBFEngine'
    elif system == 'darwin':
        bundle = work / 'dist' / 'USBFEngine.app'
        subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(bundle)], check=True)
        asset = output / (name + '.dmg')
        subprocess.run(['hdiutil', 'create', '-volname', 'Install USBF Engine',
                        '-srcfolder', str(bundle), '-ov', '-format', 'UDZO', str(asset)], check=True)
        executable = bundle / 'Contents' / 'MacOS' / 'USBFEngine'
    else:
        bundle = work / 'dist' / 'USBFEngine'
        asset = output / (name + '.exe')
        nsis = shutil.which('makensis') or next((str(p) for p in [
            Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)')) / 'NSIS' / 'makensis.exe',
            Path('C:/Program Files/NSIS/makensis.exe')] if p.is_file()), None)
        if not nsis:
            raise RuntimeError('NSIS is required to build the Windows self-extracting installer.')
        quote = lambda value: str(value).replace('$', '$$').replace('"', '$\\"')
        script = work / 'installer.nsi'
        script.write_text('''Unicode true
!include "FileFunc.nsh"
!include "LogicLib.nsh"
Name "USBF Engine preview"
RequestExecutionLevel user
SilentInstall silent
SetCompressor /SOLID lzma
OutFile "''' + quote(asset) + '''"
Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\\USBFEngine"
  File /r "''' + quote(bundle) + '''\\*.*"
  ${GetParameters} $R0
  ${GetOptions} $R0 "/WORKSPACE=" $R1
  ${If} $R1 != ""
    ExecWait '"$PLUGINSDIR\\USBFEngine\\USBFEngine.exe" --install --workspace "$R1" --no-start' $R2
    SetErrorLevel $R2
  ${Else}
    ExecWait '"$PLUGINSDIR\\USBFEngine\\USBFEngine.exe"' $R2
    SetErrorLevel $R2
  ${EndIf}
SectionEnd
''', encoding='utf-8')
        subprocess.run([nsis, '/V2', str(script)], check=True)
        executable = bundle / 'USBFEngine.exe'
    result = {**build, 'asset': asset.name, 'bytes': asset.stat().st_size,
              'sha256': digest(asset), 'bundle': str(bundle), 'executable': str(executable),
              'minimumOS': ('Linux x64, glibc ' + platform.libc_ver()[1] + ' or newer'
                            if system == 'linux' else 'macOS ' + platform.mac_ver()[0] + ' or newer'
                            if system == 'darwin' else 'Windows 10/11 x64; tested on Windows Server 2025')}
    (output / (name + '.json')).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result), flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
