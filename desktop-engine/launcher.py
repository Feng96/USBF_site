"""Desktop setup, pairing and lifecycle for the isolated USBF engine."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import queue
import signal
import subprocess
import sys
import threading
import time
import webbrowser

from installation import install, payload_directory, uninstall, windows_deferred_uninstall

SITE = 'https://feng96.github.io/USBF_site/'

TEXT = {
    'engine': ('USBF local engine', 'USBF 本地引擎'),
    'install_title': ('Install USBF local engine', '安装 USBF 本地引擎'),
    'install_description': ('A separate runtime for large building-data tasks.', '使用独立运行环境处理大规模建筑数据。'),
    'workspace_parent': ('Workspace parent folder', '工作目录的母文件夹'),
    'choose': ('Choose folder…', '选择文件夹…'),
    'setup_note': ('Projects / Results / Files / Cache / Engine\nExisting GIS installations and your data stay independent.\nPreview package: no publisher code signing or notarization.',
                   'Projects / Results / Files / Cache / Engine\n独立于已安装的 GIS 软件，并保留您的数据。\n预览安装包：尚未提供发布者代码签名或公证。'),
    'install': ('Install and open engine', '安装并打开引擎'),
    'install_error': ('Installation could not finish', '安装未能完成'),
    'start_error': ('Engine could not start', '引擎未能启动'),
    'running_here': ('Running on this computer · browser and cloud hosting are separate.', '正在此计算机运行 · 浏览器和云端托管为独立环境。'),
    'workspace': ('Workspace', '工作目录'),
    'pair_label': ('Connect the website with this pairing code', '在网站输入此配对码以连接'),
    'pair_hint': ('Single use · expires in 3 minutes', '仅可使用一次 · 3 分钟后过期'),
    'new_code': ('New pairing code', '生成新配对码'),
    'open_site': ('Open USBF website', '打开 USBF 网站'),
    'ready': ('Ready. Keep this window open while tasks run.', '已就绪。运行任务时请保持此窗口打开。'),
    'runtime_note': ('Closing stops the engine; interrupted tasks remain in its history.\nProjects, results and source files are kept when uninstalling.',
                     '关闭窗口会停止引擎；中断的任务将保留在任务记录中。\n卸载时会保留项目、结果和源文件。'),
    'stop': ('Stop engine', '停止引擎'),
    'uninstall': ('Uninstall runtime…', '卸载运行环境…'),
    'uninstall_title': ('Uninstall USBF engine?', '卸载 USBF 引擎？'),
    'uninstall_confirm': ('Stop this engine and remove its managed runtime?\n\nProjects, Results, Files, Cache and task history will be kept.',
                          '停止此引擎并移除其独立运行环境？\n\n将保留 Projects、Results、Files、Cache 和任务记录。'),
    'uninstall_error': ('Uninstall could not finish', '卸载未能完成'),
    'status': ('Ready · local API port {port}\nVersion {version} · {cpus} logical CPUs', '已就绪 · 本地 API 端口 {port}\n版本 {version} · {cpus} 个逻辑 CPU'),
    'language': ('Interface language', '界面语言'),
}


def translate(language: str, key: str, **values) -> str:
    return TEXT[key][1 if language == 'zh' else 0].format(**values)


def save_language(workspace: Path, language: str) -> None:
    """Store only desktop interface preferences, never modify project metadata."""
    folder = workspace / 'Engine'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / 'desktop-preferences.json'
    temporary = target.with_suffix('.writing')
    temporary.write_text(json.dumps({'version': 1, 'language': language}), encoding='utf-8')
    temporary.replace(target)


def language_row(parent, args, refresh):
    from tkinter import ttk
    row = ttk.Frame(parent)
    row.pack(fill='x', pady=(0, 12))
    label = ttk.Label(row, text=translate(args.language, 'language'))
    label.pack(side='left')
    choice = ttk.Combobox(row, values=['English', '中文'], state='readonly', width=13)
    choice.set('中文' if args.language == 'zh' else 'English')
    choice.pack(side='right')
    def changed(_event):
        args.language = 'zh' if choice.get() == '中文' else 'en'
        label.configure(text=translate(args.language, 'language'))
        refresh()
    choice.bind('<<ComboboxSelected>>', changed)
    return row


def resources() -> Path:
    return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))


def build_info() -> dict:
    path = resources() / 'engine-build.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {
        'version': '0.1.0-preview', 'revision': 'development', 'signed': False}


def default_workspace() -> Path:
    return Path.home() / 'Documents' / 'USBF'


def workspace_lock(workspace: Path):
    """A second desktop process must not recover another running engine's jobs."""
    folder = workspace.resolve() / 'Engine'
    if folder.is_symlink() or (folder / 'desktop.lock').is_symlink():
        raise RuntimeError('The engine lock must be a real file inside the workspace.')
    folder.mkdir(parents=True, exist_ok=True)
    handle = (folder / 'desktop.lock').open('a+b')
    try:
        if not handle.seek(0, 2):
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return handle
    except OSError:
        handle.close()
        raise RuntimeError('USBF Engine is already running for this workspace. Use its existing window.') from None


def bundled_extension(workspace: Path) -> Path | None:
    compressed = resources() / 'spatial.duckdb_extension.gz'
    direct = resources() / 'spatial.duckdb_extension'
    if not compressed.is_file():
        return direct if direct.is_file() else None
    build = build_info()
    runtime = payload_directory().parent
    folder = (runtime / 'extensions') if (runtime / '.usbf-runtime.json').is_file() else (
        workspace / 'Cache' / 'engine-runtime' / str(build['version']))
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / 'spatial.duckdb_extension'
    expected = build['spatialExtensionSha256']
    if target.is_file():
        with target.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() == expected:
                return target
    temporary = target.with_suffix('.partial')
    try:
        count = 0
        with gzip.open(compressed, 'rb') as source, temporary.open('wb') as output:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                count += len(block)
                if count > 512 * 1024 * 1024:
                    raise RuntimeError('The bundled spatial extension exceeds its budget.')
                output.write(block)
        with temporary.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
                raise RuntimeError('The bundled spatial extension checksum does not match.')
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


def backend(workspace: Path, port: int, origins: list[str]):
    if not getattr(sys, 'frozen', False):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'native-engine'))
    from usbf_engine import Engine
    from usbf_engine.server import serve
    lock = workspace_lock(workspace)
    engine = None
    try:
        extension = bundled_extension(workspace)
        if extension is None and not getattr(sys, 'frozen', False) and os.environ.get('USBF_ENGINE_TEST_EXTENSION'):
            extension = Path(os.environ['USBF_ENGINE_TEST_EXTENSION'])
        engine = Engine(workspace, extension_path=extension)
        engine._desktop_lock = lock
        if hasattr(engine, 'set_build_info'):
            engine.set_build_info(build_info())
        server = serve(engine, port=port, origins=origins)
        threading.Thread(target=server.serve_forever, name='usbf-http', daemon=True).start()
        return engine, server
    except Exception:
        if engine is not None:
            engine.close(revoke=True)
        lock.close()
        raise


def shutdown(engine, server) -> None:
    server.shutdown()
    server.server_close()
    try:
        engine.close(revoke=True)
    finally:
        lock = getattr(engine, '_desktop_lock', None)
        if lock is not None:
            lock.close()


def run_headless(args) -> int:
    if sys.stdout is None or getattr(sys.stdout, 'closed', False):
        raise RuntimeError('This windowed build cannot display a local headless pairing code. Open its desktop interface, or use a console build for --headless.')
    engine, server = backend(args.workspace, args.port, args.allow_origin)
    stopped = threading.Event()
    for item in (signal.SIGINT, signal.SIGTERM):
        signal.signal(item, lambda *_: stopped.set())
    print(json.dumps({'service': 'USBF local engine', 'port': server.server_address[1],
                      'version': build_info()['version'], 'pairingCode': engine.pairing_code(),
                      'expiresInSeconds': 180}), flush=True)
    try:
        stopped.wait()
    finally:
        shutdown(engine, server)
    return 0


def setup_gui(args) -> int:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
    args.language = args.language or 'en'
    root = tk.Tk()
    root.title(translate(args.language, 'install_title'))
    root.geometry('620x450')
    root.minsize(560, 430)
    root.configure(bg='#f5f8f4')
    frame = ttk.Frame(root, padding=24)
    frame.pack(fill='both', expand=True)
    labels = []
    def localize(widget, key):
        labels.append((widget, key))
        widget.configure(text=translate(args.language, key))
        return widget
    def refresh():
        root.title(translate(args.language, 'install_title'))
        for widget, key in labels: widget.configure(text=translate(args.language, key))
    language_row(frame, args, refresh)
    localize(ttk.Label(frame, font=('', 20, 'bold')), 'engine').pack(anchor='w')
    localize(ttk.Label(frame, wraplength=550), 'install_description').pack(anchor='w', pady=(8, 18))
    localize(ttk.Label(frame), 'workspace_parent').pack(anchor='w')
    selected = tk.StringVar(value=str(args.workspace))
    ttk.Entry(frame, textvariable=selected).pack(fill='x', pady=7)
    localize(ttk.Button(frame, command=lambda: selected.set(
        filedialog.askdirectory(initialdir=selected.get(), title=translate(args.language, 'choose')) or selected.get())), 'choose').pack(anchor='w')
    localize(ttk.Label(frame, justify='left', wraplength=550), 'setup_note').pack(anchor='w', pady=16)

    def perform():
        try:
            workspace = Path(selected.get()).expanduser().resolve()
            receipt = install(payload_directory(), Path(sys.executable), workspace, build_info())
            save_language(workspace, args.language)
            command = [str(workspace / receipt['executable']), '--workspace', str(workspace), '--language', args.language]
            subprocess.Popen(command, close_fds=True)
            root.destroy()
        except Exception as error:
            messagebox.showerror(translate(args.language, 'install_error'), str(error), parent=root)

    localize(ttk.Button(frame, command=perform), 'install').pack(anchor='e')
    root.mainloop()
    return 0


def run_gui(args) -> int:
    import tkinter as tk
    from tkinter import messagebox, ttk
    root = tk.Tk()
    root.title(translate(args.language, 'engine'))
    root.geometry('680x590')
    root.minsize(590, 540)
    actions = queue.Queue()
    try:
        engine, server = backend(args.workspace, args.port, args.allow_origin)
    except Exception as error:
        messagebox.showerror(translate(args.language, 'start_error'), str(error), parent=root)
        root.destroy()
        return 1
    engine.set_uninstall_handler(lambda: actions.put('uninstall'))
    frame = ttk.Frame(root, padding=24)
    frame.pack(fill='both', expand=True)
    labels = []
    def localize(widget, key):
        labels.append((widget, key))
        widget.configure(text=translate(args.language, key))
        return widget
    def refresh():
        root.title(translate(args.language, 'engine'))
        for widget, key in labels: widget.configure(text=translate(args.language, key))
        save_language(args.workspace, args.language)
    language_row(frame, args, refresh)
    localize(ttk.Label(frame, font=('', 20, 'bold')), 'engine').pack(anchor='w')
    localize(ttk.Label(frame, wraplength=610), 'running_here').pack(anchor='w', pady=(6, 18))
    localize(ttk.Label(frame), 'workspace').pack(anchor='w')
    ttk.Label(frame, text=str(args.workspace), wraplength=590).pack(anchor='w', pady=(4, 14))
    pairing = tk.StringVar()
    localize(ttk.Label(frame), 'pair_label').pack(anchor='w')
    ttk.Label(frame, textvariable=pairing, font=('', 25, 'bold')).pack(anchor='w', pady=8)
    localize(ttk.Label(frame), 'pair_hint').pack(anchor='w', pady=(0, 8))

    def refresh_code():
        value = engine.pairing_code()
        pairing.set(value.get('code', '') if isinstance(value, dict) else str(value))

    refresh_code()
    row = ttk.Frame(frame)
    row.pack(fill='x', pady=(0, 16))
    localize(ttk.Button(row, command=refresh_code), 'new_code').pack(side='left')
    localize(ttk.Button(row, command=lambda: webbrowser.open(SITE)), 'open_site').pack(side='left', padx=10)
    status = tk.StringVar(value=translate(args.language, 'ready'))
    ttk.Label(frame, textvariable=status, wraplength=590, justify='left').pack(anchor='w', pady=10)
    localize(ttk.Label(frame, justify='left', wraplength=610), 'runtime_note').pack(anchor='w', pady=12)

    def stop():
        try:
            shutdown(engine, server)
        finally:
            root.destroy()

    def remove():
        if not messagebox.askyesno(translate(args.language, 'uninstall_title'),
            translate(args.language, 'uninstall_confirm'), parent=root):
            return
        shutdown(engine, server)
        try:
            if os.name == 'nt':
                windows_deferred_uninstall(args.workspace)
            else:
                uninstall(args.workspace)
        except Exception as error:
            messagebox.showerror(translate(args.language, 'uninstall_error'), str(error), parent=root)
        root.destroy()

    bottom = ttk.Frame(frame)
    bottom.pack(side='bottom', fill='x', pady=(12, 0))
    localize(ttk.Button(bottom, command=stop), 'stop').pack(side='left')
    localize(ttk.Button(bottom, command=remove), 'uninstall').pack(side='right')
    root.protocol('WM_DELETE_WINDOW', stop)

    def tick():
        try:
            while not actions.empty():
                if actions.get_nowait() == 'uninstall':
                    remove()
                    return
            status.set(translate(args.language, 'status', port=server.server_address[1],
                                 version=build_info()['version'], cpus=os.cpu_count() or 1))
            root.after(1000, tick)
        except tk.TclError:
            pass

    root.after(500, tick)
    root.mainloop()
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='USBF local engine')
    parser.add_argument('--workspace', type=Path, default=None)
    parser.add_argument('--port', type=int, default=52763)
    parser.add_argument('--allow-origin', action='append', default=['https://feng96.github.io'])
    parser.add_argument('--language', choices=['en', 'zh'], help='Desktop interface language (saved with this workspace).')
    parser.add_argument('--headless', action='store_true')
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--no-start', action='store_true')
    parser.add_argument('--uninstall', action='store_true')
    parser.add_argument('--yes', action='store_true')
    parser.add_argument('--version', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--report', type=Path)
    parser.add_argument('--gui-smoke', action='store_true')
    args = parser.parse_args(argv)
    if args.version:
        print(json.dumps(build_info()))
        return 0
    if args.gui_smoke:
        import tkinter as tk
        if args.workspace is None:
            raise RuntimeError('GUI acceptance requires an explicit temporary workspace.')
        args.workspace = args.workspace.resolve()
        args.language = args.language or 'en'
        args.port = 0
        original_tk = tk.Tk
        def acceptance_window(*values, **options):
            window = original_tk(*values, **options)
            def close_window():
                command = window.protocol('WM_DELETE_WINDOW')
                if command:
                    window.tk.call(command)
                else:
                    window.destroy()
            window.after(1000, close_window)
            return window
        tk.Tk = acceptance_window
        try:
            return setup_gui(args) if args.install else run_gui(args)
        finally:
            tk.Tk = original_tk
    if args.self_test:
        if args.workspace is None or args.report is None:
            raise RuntimeError('Self-test requires explicit workspace and report paths.')
        from selftest import run
        return run(args.workspace.resolve(), args.report.resolve())
    if args.workspace is None:
        if getattr(sys, 'frozen', False):
            runtime = payload_directory().parent
            if (runtime / '.usbf-runtime.json').is_file():
                args.workspace = runtime.parent.parent.parent
            else:
                return setup_gui(argparse.Namespace(**{**vars(args), 'workspace': default_workspace()}))
        else:
            args.workspace = default_workspace()
    args.workspace = args.workspace.expanduser().resolve()
    if args.language is None:
        try:
            preference = json.loads((args.workspace / 'Engine' / 'desktop-preferences.json').read_text(encoding='utf-8'))
            args.language = preference.get('language') if preference.get('language') in {'en', 'zh'} else 'en'
        except (OSError, ValueError, AttributeError):
            args.language = 'en'
    if args.install:
        if not getattr(sys, 'frozen', False):
            raise RuntimeError('Use a built desktop package to install a runtime.')
        receipt = install(payload_directory(), Path(sys.executable), args.workspace, build_info())
        save_language(args.workspace, args.language)
        if not args.no_start:
            subprocess.Popen([str(args.workspace / receipt['executable']), '--workspace', str(args.workspace), '--language', args.language], close_fds=True)
        return 0
    if args.uninstall:
        if args.yes:
            if os.name == 'nt' and getattr(sys, 'frozen', False):
                windows_deferred_uninstall(args.workspace)
            else:
                uninstall(args.workspace)
            return 0
        return run_gui(args)
    return run_headless(args) if args.headless else run_gui(args)


def command_entrypoint(argv=None) -> int:
    """Return failures to installer automation without a windowed error modal."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    try:
        return main(arguments)
    except Exception as error:
        report = None
        for index, item in enumerate(arguments):
            if item == '--report' and index + 1 < len(arguments):
                report = Path(arguments[index + 1])
            elif item.startswith('--report='):
                report = Path(item.split('=', 1)[1])
        message = str(error)[:2048]
        if report is not None:
            try:
                previous = json.loads(report.read_text(encoding='utf-8')) if report.is_file() else {}
                if not isinstance(previous, dict): previous = {}
                previous.update(passed=False, errorType=type(error).__name__, commandError=message)
                previous.setdefault('error', message)
                report.parent.mkdir(parents=True, exist_ok=True)
                report.write_text(json.dumps(previous, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            except (OSError, ValueError):
                pass
        if sys.stderr is not None:
            print(type(error).__name__ + ': ' + message, file=sys.stderr)
        automation = {'--install', '--self-test', '--headless', '--uninstall', '--gui-smoke', '--version', '--no-start'}
        if not any(item.split('=', 1)[0] in automation for item in arguments):
            try:
                from tkinter import messagebox
                language = arguments[arguments.index('--language') + 1] if '--language' in arguments else 'en'
                messagebox.showerror(translate(language, 'start_error'), message)
            except Exception:
                pass
        return 1


if __name__ == '__main__':
    raise SystemExit(command_entrypoint())
