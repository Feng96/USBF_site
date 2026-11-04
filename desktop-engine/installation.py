"""Install only USBF-owned runtimes; user data has an independent lifecycle."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import uuid

APP_ID = 'org.usbf.engine'
FOLDERS = ('Projects', 'Results', 'Files', 'Cache', 'Engine')
MARKER = '.usbf-runtime.json'


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('x', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def workspace_root(value: str | Path) -> Path:
    root = Path(value).expanduser().resolve()
    if root == Path(root.anchor):
        raise ValueError('Choose a USBF workspace folder, not a filesystem root.')
    root.mkdir(parents=True, exist_ok=True)
    for name in FOLDERS:
        folder = root / name
        if folder.is_symlink():
            raise ValueError(f'{name} must be a real folder inside this workspace.')
        folder.mkdir(exist_ok=True)
    return root


def workspace_identity(root: Path) -> str:
    path = root / 'Engine' / 'workspace-id.json'
    if path.exists():
        value = json.loads(path.read_text(encoding='utf-8'))
        return str(uuid.UUID(value['id']))
    identity = str(uuid.uuid4())
    write_json(path, {'version': 1, 'id': identity})
    return identity


def payload_directory(executable: Path | None = None) -> Path:
    executable = (executable or Path(sys.executable)).resolve()
    for parent in executable.parents:
        if parent.suffix.lower() == '.app':
            return parent
    return executable.parent


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def install(payload: Path, executable: Path, workspace: Path, build: dict) -> dict:
    root = workspace_root(workspace)
    identity = workspace_identity(root)
    version = str(build.get('version', '0.1.0-preview'))
    revision = str(build.get('revision', 'local'))[:16]
    runtime_name = version + '-' + revision
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,100}', runtime_name):
        raise ValueError('The runtime version is invalid.')
    payload, executable = payload.resolve(), executable.resolve()
    executable_in_payload = executable.relative_to(payload)
    runtimes = root / 'Engine' / 'runtime'
    runtimes.mkdir(exist_ok=True)
    if runtimes.is_symlink():
        raise ValueError('The runtime directory cannot be a symbolic link.')
    target = runtimes / runtime_name
    digest = sha256(executable)
    marker = {'application': APP_ID, 'workspaceId': identity, 'version': version,
              'revision': revision, 'executableSha256': digest,
              'executable': str(Path(payload.name) / executable_in_payload)}
    if target.exists():
        if target.is_symlink() or not (target / MARKER).is_file():
            raise ValueError('An unfamiliar runtime folder already uses this name.')
        previous = json.loads((target / MARKER).read_text(encoding='utf-8'))
        if previous != marker:
            raise ValueError('A different runtime already uses this build identity.')
    else:
        stage = Path(tempfile.mkdtemp(prefix='.install-', dir=runtimes))
        try:
            shutil.copytree(payload, stage / payload.name, symlinks=True)
            write_json(stage / MARKER, marker)
            stage.rename(target)
        finally:
            if stage.exists():
                shutil.rmtree(stage)
    receipt = {**marker, 'schema': 1, 'installed': True,
               'runtime': str(target.relative_to(root)),
               'executable': str((target / marker['executable']).relative_to(root))}
    write_json(root / 'Engine' / 'install-receipt.json', receipt)
    return receipt


def managed_runtimes(workspace: Path) -> list[Path]:
    root = Path(workspace).expanduser().resolve()
    if not (root / 'Engine' / 'workspace-id.json').is_file():
        return []
    identity = workspace_identity(root)
    runtimes = root / 'Engine' / 'runtime'
    if not runtimes.exists():
        return []
    if runtimes.is_symlink():
        raise ValueError('The runtime directory cannot be a symbolic link.')
    found = []
    for folder in runtimes.iterdir():
        marker_path = folder / MARKER
        if folder.is_symlink() or not folder.is_dir() or not marker_path.is_file():
            continue
        try:
            marker = json.loads(marker_path.read_text(encoding='utf-8'))
        except (ValueError, OSError):
            continue
        if marker.get('application') == APP_ID and marker.get('workspaceId') == identity:
            found.append(folder)
    return found


def uninstall(workspace: Path) -> list[str]:
    root = Path(workspace).expanduser().resolve()
    targets = managed_runtimes(root)
    removed = []
    for folder in targets:
        shutil.rmtree(folder)
        removed.append(str(folder.relative_to(root)))
    receipt_path = root / 'Engine' / 'install-receipt.json'
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        if receipt.get('application') == APP_ID:
            receipt['installed'] = False
            write_json(receipt_path, receipt)
    return removed


def windows_deferred_uninstall(workspace: Path) -> None:
    """A separate PowerShell process removes locked binaries after this PID exits."""
    import subprocess
    root = Path(workspace).resolve()
    targets = managed_runtimes(root)
    scratch = Path(tempfile.mkdtemp(prefix='usbf-uninstall-'))
    plan = scratch / 'plan.json'
    write_json(plan, {'workspace': str(root), 'targets': [str(p) for p in targets],
                      'workspaceId': workspace_identity(root), 'pid': os.getpid()})
    script = scratch / 'cleanup.ps1'
    script.write_text(r'''param([string]$Plan)
$ErrorActionPreference = 'Stop'
$p = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
Wait-Process -Id $p.pid -ErrorAction SilentlyContinue
$base = [IO.Path]::GetFullPath((Join-Path $p.workspace 'Engine\runtime'))
foreach ($item in $p.targets) {
  $full = [IO.Path]::GetFullPath($item)
  if ([IO.Path]::GetDirectoryName($full) -ne $base) { throw 'Invalid runtime path' }
  $marker = Get-Content -LiteralPath (Join-Path $full '.usbf-runtime.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($marker.application -ne 'org.usbf.engine' -or $marker.workspaceId -ne $p.workspaceId) { throw 'Invalid runtime owner' }
  Remove-Item -LiteralPath $full -Recurse -Force
}
$receiptPath = Join-Path $p.workspace 'Engine\install-receipt.json'
if (Test-Path -LiteralPath $receiptPath) {
  $receipt = Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $receipt.installed = $false
  [IO.File]::WriteAllText($receiptPath, ($receipt | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))
}
Remove-Item -LiteralPath $Plan -Force
Remove-Item -LiteralPath $PSCommandPath -Force
''', encoding='utf-8')
    subprocess.Popen(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                      '-File', str(script), '-Plan', str(plan)], close_fds=True,
                     creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP)
