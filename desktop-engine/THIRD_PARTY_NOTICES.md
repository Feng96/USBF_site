# USBF Engine preview distribution

The engine includes an isolated CPython runtime, DuckDB and its officially signed
Spatial extension, Apache Arrow / PyArrow, pytz, psutil, certifi, Tcl/Tk, and a PyInstaller bootloader. It does not borrow
an existing user Python, GDAL or DuckDB environment. Native spatial IO is provided
by the GDAL components in DuckDB Spatial, not a separate GDAL command-line install.

Package metadata and license files are retained by the build. Upstream projects:

- CPython: https://docs.python.org/3/license.html
- DuckDB: https://github.com/duckdb/duckdb/blob/main/LICENSE
- DuckDB Spatial (including its third-party dependencies): https://github.com/duckdb/duckdb-spatial
- GDAL: https://gdal.org/en/stable/license.html
- Apache Arrow / PyArrow: https://github.com/apache/arrow/blob/main/LICENSE.txt
- pytz: https://github.com/stub42/pytz/blob/master/LICENSE.txt
- psutil: https://github.com/giampaolo/psutil/blob/master/LICENSE
- certifi (Mozilla CA bundle): https://github.com/certifi/python-certifi/blob/master/LICENSE
- Tcl/Tk: https://www.tcl.tk/software/tcltk/license.html
- PyInstaller distribution exception: https://pyinstaller.org/en/stable/license.html

This preview has no publisher code-signing certificate or Apple notarization.
macOS bundles use an ad-hoc signature for bundle integrity only. SHA256 checksums
identify the exact released assets. Source datasets retain their own component
licenses; the runtime license does not relicense a dataset or generated result.
