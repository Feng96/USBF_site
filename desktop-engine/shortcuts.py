"""Per-user launch entries that refer to one owned USBF workspace.

Launchers contain no pairing codes or bearer tokens. Cleanup removes an entry
only when its current contents/target still match the installation receipt.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shlex
import sys

from installation import APP_ID, write_json, workspace_identity


def _hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _entry_owned(entry):
    path = Path(entry["path"])
    if entry.get("kind") == "symlink":
        if not path.is_symlink() or not isinstance(entry.get("target"), str):
            return False
        try:
            actual, expected = path.readlink(), Path(entry["target"])
            if not actual.is_absolute():
                actual = path.parent / actual
            if not expected.is_absolute():
                expected = path.parent / expected
            # Windows readlink can add an extended-length prefix, while macOS
            # can canonicalize /var to /private/var. Compare the target identity
            # rather than its spelling; removal still unlinks only this allowed
            # launch entry, never its target directory.
            return actual.resolve() == expected.resolve() or actual.samefile(expected)
        except (OSError, ValueError):
            return False
    return not path.is_symlink() and path.is_file() and _hash(path) == entry.get("sha256")


def _previous(workspace):
    receipt = workspace / "Engine" / "shortcuts.json"
    if receipt.is_symlink():
        raise ValueError("The shortcut receipt must be a real workspace file.")
    if not receipt.exists():
        return []
    value = json.loads(receipt.read_text(encoding="utf-8"))
    if value.get("application") != APP_ID or value.get("workspaceId") != workspace_identity(workspace):
        raise ValueError("Existing shortcut ownership is not recognized.")
    return value.get("entries", [])


def install_shortcuts(workspace, receipt, *, user_directory=None, platform=None):
    workspace = Path(workspace).resolve()
    platform = platform or sys.platform
    identity = workspace_identity(workspace)
    executable = (workspace / receipt["executable"]).resolve()
    if not executable.is_relative_to(workspace / "Engine" / "runtime") or not executable.is_file():
        raise ValueError("Launchers require an installed workspace runtime.")
    if any(c in str(workspace) + str(executable) for c in "\n\r\x00"):
        raise ValueError("The workspace path cannot contain line breaks for desktop launchers.")
    previous = _previous(workspace)
    entries = []
    def available(path):
        if not path.exists() and not path.is_symlink():
            return True
        known = next((entry for entry in previous if entry["path"] == str(path)), None)
        return bool(known and _entry_owned(known))
    def put(path, text, executable_bit=False):
        if not available(path):
            return False
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".writing")
        if temporary.exists() or temporary.is_symlink():
            raise ValueError("An unfamiliar temporary launcher was kept.")
        try:
            temporary.write_text(text, encoding="utf-8")
            if executable_bit:
                temporary.chmod(0o700)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
        entries.append({"path": str(path), "kind": "file", "sha256": _hash(path)})
        return True
    command = [str(executable), "--workspace", str(workspace)]
    if platform == "win32":
        launcher = workspace / "Engine" / "Start USBF Engine.cmd"
        quoted = " ".join('"' + part.replace('%', '%%') + '"' for part in command)
        put(launcher, "@echo off\r\nstart \"USBF Engine\" " + quoted + "\r\n")
        # A Start Menu .cmd is a standard per-user launch entry and does not
        # require registry edits, elevation or an unverified helper executable.
        base = Path(user_directory) if user_directory is not None else Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        menu = base / "Microsoft" / "Windows" / "Start Menu" / "Programs" / ("USBF Engine " + identity[:8] + ".cmd")
        put(menu, "@echo off\r\nstart \"USBF Engine\" " + quoted + "\r\n")
    else:
        launcher = workspace / "Engine" / ("Start USBF Engine.command" if platform == "darwin" else "start-usbf-engine.sh")
        put(launcher, "#!/bin/sh\nexec " + shlex.join(command) + "\n", True)
        if platform == "darwin":
            # Finder's Applications entry opens the actual installed app. Its
            # launcher infers the original workspace from the owned runtime.
            app = next((parent for parent in executable.parents if parent.suffix.lower() == ".app"), None)
            if app is not None:
                base = Path(user_directory) if user_directory is not None else Path.home()
                alias = base / "Applications" / ("USBF Engine " + identity[:8] + ".app")
                if available(alias):
                    alias.parent.mkdir(parents=True, exist_ok=True)
                    alias.unlink(missing_ok=True)
                    alias.symlink_to(app, target_is_directory=True)
                    entries.append({"path": str(alias), "kind": "symlink", "target": str(app)})
        else:
            base = Path(user_directory) if user_directory is not None else Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
            desktop = base / "applications" / ("org.usbf.engine." + identity + ".desktop")
            def desktop_quote(value):
                return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("`", "\\`").replace("$", "\\$").replace("%", "%%") + '"'
            put(desktop, "[Desktop Entry]\nType=Application\nName=USBF Engine " + identity[:8] + "\nComment=Local building data processing\nExec=" + " ".join(desktop_quote(x) for x in command) + "\nTerminal=false\nCategories=Science;Geography;\n", True)
    # Preserve changed entries so uninstall can report/retain them safely.
    retained = [entry for entry in previous if not any(new["path"] == entry["path"] for new in entries)]
    write_json(workspace / "Engine" / "shortcuts.json", {"schema": 1, "application": APP_ID,
        "workspaceId": identity, "entries": entries + retained})
    return {"launcher": str(launcher.relative_to(workspace)), "entries": len(entries),
            "retainedChangedEntries": sum(not _entry_owned(entry) for entry in retained)}


def remove_shortcuts(workspace, *, user_directory=None, platform=None):
    workspace = Path(workspace).resolve()
    if not (workspace / "Engine" / "shortcuts.json").is_file():
        return {"removed": [], "changedEntriesKept": 0}
    identity = workspace_identity(workspace)
    platform = platform or sys.platform
    allowed = {workspace / "Engine" / "Start USBF Engine.cmd",
               workspace / "Engine" / "Start USBF Engine.command",
               workspace / "Engine" / "start-usbf-engine.sh"}
    if platform == "win32":
        base = Path(user_directory) if user_directory is not None else Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        allowed.add(base / "Microsoft" / "Windows" / "Start Menu" / "Programs" / ("USBF Engine " + identity[:8] + ".cmd"))
    elif platform == "darwin":
        base = Path(user_directory) if user_directory is not None else Path.home()
        allowed.add(base / "Applications" / ("USBF Engine " + identity[:8] + ".app"))
    else:
        base = Path(user_directory) if user_directory is not None else Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
        allowed.add(base / "applications" / ("org.usbf.engine." + identity + ".desktop"))
    entries = _previous(workspace)
    removed, kept = [], []
    for entry in entries:
        path = Path(entry["path"])
        if path in allowed and _entry_owned(entry):
            path.unlink()
            removed.append(str(path))
        elif path.exists() or path.is_symlink():
            kept.append(entry)
    write_json(workspace / "Engine" / "shortcuts.json", {"schema": 1, "application": APP_ID,
        "workspaceId": workspace_identity(workspace), "entries": kept})
    return {"removed": removed, "changedEntriesKept": len(kept)}
