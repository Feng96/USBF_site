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
from contextlib import contextmanager
from datetime import datetime, timezone

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


@contextmanager
def _system_dll_search():
    """Do not pass PyInstaller's bundled DLL search path to system PowerShell."""
    import ctypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    get_directory = kernel.GetDllDirectoryW
    get_directory.argtypes = [ctypes.c_uint32, ctypes.c_wchar_p]
    get_directory.restype = ctypes.c_uint32
    set_directory = kernel.SetDllDirectoryW
    set_directory.argtypes = [ctypes.c_wchar_p]
    set_directory.restype = ctypes.c_int
    size = get_directory(0, None)
    previous = None
    if size:
        buffer = ctypes.create_unicode_buffer(size + 1)
        ctypes.set_last_error(0)
        copied = get_directory(len(buffer), buffer)
        error = ctypes.get_last_error()
        if not copied and error:
            raise ctypes.WinError(error)
        previous = buffer.value
    if not set_directory(None):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        yield
    finally:
        set_directory(previous)


def _launch_cleanup(script: Path, plan: Path, log: Path, scratch: Path):
    import subprocess
    system = Path(os.environ.get('SystemRoot', r'C:\Windows'))
    executable = system / 'System32' / 'WindowsPowerShell' / 'v1.0' / 'powershell.exe'
    if not executable.is_file():
        raise FileNotFoundError('Windows PowerShell is unavailable.')
    environment = dict(os.environ)
    bundled = Path(getattr(sys, '_MEIPASS', Path(sys.executable).parent)).resolve()
    environment['PATH'] = os.pathsep.join(part for part in environment.get('PATH', '').split(os.pathsep)
                                        if part and not Path(part).resolve().is_relative_to(bundled))
    # A helper whose current directory is inside the runtime cannot remove that
    # directory on Windows, even after its parent executable has exited.
    with _system_dll_search(), log.open('ab') as output:
        return subprocess.Popen([str(executable), '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                                 '-File', str(script), '-PlanPath', str(plan)], cwd=str(scratch), env=environment,
                                stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT, close_fds=True,
                                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP)


CLEANUP_SCRIPT = r'''param([Parameter(Mandatory=$true)][string]$PlanPath)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$planData = Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
$statusPath = [IO.Path]::Combine([string]$planData.workspace, 'Engine', 'uninstall-status.json')
$utf8 = New-Object System.Text.UTF8Encoding($false)
$phase = 'starting'
$removed = New-Object 'System.Collections.Generic.List[string]'
function Write-Status([string]$State, [string]$Message) {
  $data = [ordered]@{schema=1;requestId=$planData.requestId;state=$State;phase=$script:phase;
    workspaceId=$planData.workspaceId;requesterPid=$planData.requesterPid;cleanupPid=$PID;
    targets=@($planData.targets);removed=@($script:removed.ToArray());
    updatedAt=[DateTime]::UtcNow.ToString('o');error=$Message}
  $temporary = $statusPath + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
  [IO.File]::WriteAllText($temporary, ($data | ConvertTo-Json -Depth 10), $utf8)
  if ([IO.File]::Exists($statusPath)) {
    # PowerShell 5 converts a null string argument to an empty backup path.
    $backup = $statusPath + '.' + [Guid]::NewGuid().ToString('N') + '.backup'
    [IO.File]::Replace($temporary, $statusPath, $backup)
    [IO.File]::Delete($backup)
  }
  else { [IO.File]::Move($temporary, $statusPath) }
}
function Assert-RealDirectory([string]$Directory) {
  if (([IO.File]::GetAttributes($Directory) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'A runtime directory is a reparse point; it was kept.'
  }
}
function Assert-NoReparseChildren([string]$Directory) {
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($Directory)
  while ($pending.Count -gt 0) {
    $current = $pending.Pop()
    foreach ($entry in @(Get-ChildItem -LiteralPath $current -Force)) {
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'A runtime contains a reparse point; it was kept.'
      }
      if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
    }
  }
}
try {
  $phase = 'waiting-for-exit'
  Write-Status 'pending' $null
  $requester = Get-Process -Id ([int]$planData.requesterPid) -ErrorAction SilentlyContinue
  if ($null -ne $requester -and -not $requester.WaitForExit(30000)) {
    throw 'The requesting engine did not exit within 30 seconds.'
  }
  $engineFolder = [IO.Path]::Combine([string]$planData.workspace, 'Engine')
  $base = [IO.Path]::GetFullPath([IO.Path]::Combine($engineFolder, 'runtime'))
  Assert-RealDirectory $engineFolder
  Assert-RealDirectory $base
  $identity = Get-Content -LiteralPath ([IO.Path]::Combine($engineFolder, 'workspace-id.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($identity.id -ne $planData.workspaceId) { throw 'The workspace identity changed; files were kept.' }
  $phase = 'removing-runtime'
  foreach ($relative in $planData.targets) {
    $full = [IO.Path]::GetFullPath([IO.Path]::Combine([string]$planData.workspace, [string]$relative))
    if (-not [StringComparer]::OrdinalIgnoreCase.Equals([IO.Path]::GetDirectoryName($full), $base)) {
      throw 'Invalid runtime path; files were kept.'
    }
    $markerPath = [IO.Path]::Combine($full, '.usbf-runtime.json')
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([IO.Directory]::Exists($full)) {
      Assert-RealDirectory $full
      $ownerText = [IO.File]::ReadAllText($markerPath, $utf8)
      $owner = $ownerText | ConvertFrom-Json
      if ($owner.application -ne 'org.usbf.engine' -or $owner.workspaceId -ne $planData.workspaceId) {
        throw 'Invalid runtime owner; files were kept.'
      }
      Assert-NoReparseChildren $full
      try {
        # Keep the owner marker until all other files are gone. A transient DLL
        # lock must never turn a partially removed runtime into an unknown tree.
        Get-ChildItem -LiteralPath $full -Force | Where-Object { $_.Name -ne '.usbf-runtime.json' } |
          Remove-Item -Recurse -Force -ErrorAction Stop
        Remove-Item -LiteralPath $markerPath -Force -ErrorAction Stop
        try { [IO.Directory]::Delete($full, $false) }
        catch { [IO.File]::WriteAllText($markerPath, $ownerText, $utf8); throw }
      }
      catch {
        if ([DateTime]::UtcNow -ge $deadline -or -not [IO.File]::Exists($markerPath)) { throw }
        Start-Sleep -Milliseconds 250
      }
    }
    $removed.Add([string]$relative)
    Write-Status 'pending' $null
  }
  $phase = 'updating-receipt'
  $receiptPath = [IO.Path]::Combine($engineFolder, 'install-receipt.json')
  if ([IO.File]::Exists($receiptPath)) {
    $receipt = [IO.File]::ReadAllText($receiptPath, $utf8) | ConvertFrom-Json
    if ($receipt.application -eq 'org.usbf.engine' -and $receipt.workspaceId -eq $planData.workspaceId) {
      $receipt.installed = $false
      [IO.File]::WriteAllText($receiptPath, ($receipt | ConvertTo-Json -Depth 10), $utf8)
    }
  }
  $phase = 'finished'
  Write-Status 'complete' $null
  Remove-Item -LiteralPath $PlanPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}
catch {
  try { Write-Status 'error' ([string]$_.Exception.Message) } catch { }
  Write-Error -Message $_.Exception.Message -ErrorAction Continue
  exit 1
}
'''


def windows_deferred_uninstall(workspace: Path) -> None:
    """Defer self-removal until exit; leave structured status outside the runtime."""
    root = Path(workspace).resolve()
    targets = managed_runtimes(root)
    identity = workspace_identity(root)
    request = uuid.uuid4().hex
    status_path = root / 'Engine' / 'uninstall-status.json'
    status = {'schema': 1, 'requestId': request, 'state': 'pending', 'phase': 'launching',
              'workspaceId': identity, 'requesterPid': os.getpid(), 'cleanupPid': None,
              'targets': [str(path.relative_to(root)) for path in targets], 'removed': [],
              'updatedAt': datetime.now(timezone.utc).isoformat(), 'error': None}
    write_json(status_path, status)
    scratch = Path(tempfile.mkdtemp(prefix='usbf-uninstall-'))
    plan = scratch / 'plan.json'
    write_json(plan, {'workspace': str(root), 'targets': status['targets'], 'workspaceId': identity,
                      'requestId': request, 'requesterPid': os.getpid()})
    script = scratch / 'cleanup.ps1'
    script.write_text(CLEANUP_SCRIPT, encoding='utf-8')
    try:
        _launch_cleanup(script, plan, root / 'Engine' / 'uninstall-worker.log', scratch)
    except Exception as error:
        status.update(state='error', phase='launching', error=str(error)[:2048],
                      updatedAt=datetime.now(timezone.utc).isoformat())
        write_json(status_path, status)
        raise
