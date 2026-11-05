"""DuckDB Spatial is loaded from the isolated engine runtime, never system GIS."""
from __future__ import annotations

import os
import sys
import gzip
import shutil
import threading
import urllib.request
from pathlib import Path

import duckdb
from .security import https_context as tls_context

_extension_lock = threading.Lock()


def sqlstr(value):
    return "'" + str(value).replace("'", "''") + "'"


def ident(value):
    return '"' + str(value).replace('"', '""') + '"'


class Runtime:
    def __init__(self, workspace, *, extension_path=None, threads=2, memory_limit="1GB", allow_install=True):
        self.workspace = Path(workspace)
        self.extension_path = extension_path
        self.threads = max(1, min(int(threads), os.cpu_count() or 1))
        self.memory_limit = memory_limit
        self.allow_install = allow_install
        self.extension_dir = self.workspace / "Cache" / "duckdb-extensions"
        self.temp_dir = self.workspace / "Cache" / "native-spill"
        self.extension_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def connection(self):
        connection = duckdb.connect(config={"threads": self.threads, "memory_limit": self.memory_limit,
                                           "temp_directory": str(self.temp_dir),
                                           "extension_directory": str(self.extension_dir),
                                           "autoinstall_known_extensions": False,
                                           "autoload_known_extensions": False})
        candidate = self.extension_path or os.environ.get("USBF_SPATIAL_EXTENSION")
        if not candidate and getattr(sys, "frozen", False):
            bundled = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)) / "spatial.duckdb_extension"
            if bundled.is_file():
                candidate = str(bundled)
        try:
            if candidate:
                connection.execute("LOAD " + sqlstr(Path(candidate).resolve()))
            else:
                try:
                    connection.execute("LOAD spatial")
                except duckdb.Error:
                    if not self.allow_install:
                        raise RuntimeError("The bundled DuckDB Spatial extension is unavailable.")
                    # The official CDN requires DuckDB's User-Agent on some
                    # networks. Loading the downloaded file still verifies the
                    # upstream signature; unsigned extensions remain disabled.
                    with _extension_lock:
                        platform = connection.execute("PRAGMA platform").fetchone()[0]
                        destination = self.extension_dir / ("v" + duckdb.__version__) / platform / "spatial.duckdb_extension"
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        if not destination.exists():
                            address = "https://extensions.duckdb.org/v" + duckdb.__version__ + "/" + platform + "/spatial.duckdb_extension.gz"
                            request = urllib.request.Request(address, headers={"User-Agent": "DuckDB/v" + duckdb.__version__})
                            compressed = Path(str(destination) + ".gz.writing")
                            temporary = Path(str(destination) + ".writing")
                            try:
                                with urllib.request.urlopen(request, timeout=60, context=tls_context()) as response, compressed.open("wb") as output:
                                    total = 0
                                    while True:
                                        block = response.read(1024 * 1024)
                                        if not block:
                                            break
                                        total += len(block)
                                        if total > 128 * 1024 * 1024:
                                            raise RuntimeError("The native Spatial package exceeds its download budget.")
                                        output.write(block)
                                with gzip.open(compressed, "rb") as source, temporary.open("wb") as output:
                                    total = 0
                                    while True:
                                        block = source.read(1024 * 1024)
                                        if not block:
                                            break
                                        total += len(block)
                                        if total > 512 * 1024 * 1024:
                                            raise RuntimeError("The native Spatial package exceeds its runtime budget.")
                                        output.write(block)
                                os.replace(temporary, destination)
                            finally:
                                compressed.unlink(missing_ok=True)
                                temporary.unlink(missing_ok=True)
                        connection.execute("LOAD " + sqlstr(destination))
            # Untrusted browser input can never activate extensions or fetch files
            # through SQL; all source bytes are acquired by the checked downloader.
            connection.execute("SET geometry_always_xy=true")
            # Serialize timestamp instants consistently across desktop locales.
            # Original Parquet timestamp types and instants remain unchanged.
            connection.execute("SET TimeZone='UTC'")
            return connection
        except Exception:
            connection.close()
            raise

    def information(self):
        with self.connection() as c:
            spatial = c.execute("SELECT extension_version FROM duckdb_extensions() WHERE extension_name='spatial'").fetchone()
            try:
                proj = c.execute("SELECT DuckDB_Proj_Version()").fetchone()[0]
            except duckdb.Error:
                proj = None
        return {"duckdb": duckdb.__version__, "spatial": spatial[0] if spatial else None,
                "proj": proj, "gdal": "Bundled by DuckDB Spatial; no system GDAL is used",
                "threads": self.threads, "memoryLimit": self.memory_limit,
                "isolated": True}
