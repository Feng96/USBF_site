# USBF Engine preview

The 0.4 preview adds validated original-provider cache reuse, complete native
histograms/category counts/grouped means, and saved-area building correspondence
reports. Install the new package into the existing workspace to update its
isolated runtime while keeping Projects, Results and Files. Existing system GIS
environments remain separate. The website checks actual runtime capabilities
before enabling these operations. See [methods and acceptance](../docs/analysis-workspace-acceptance.md).

The installer contains an independent CPython runtime, DuckDB 2.0.0, its official
signed Spatial extension (including GDAL), psutil and the desktop interface.
Users do not need Python, GDAL or DuckDB installed. Existing GIS environments
are not searched or modified.

Download the installer for your operating system from **Files & device → Engine**
on the USBF site. These are preview packages without publisher code signing or
Apple notarization. macOS uses an ad-hoc signature; the download manifest shows
the SHA256 of each tested package. Follow your organisation's software policy.

1. Open the Windows `.exe` or the app in the macOS `.dmg`. Linux users run the
   `.run` file with a desktop session (`sh usbf-engine-…run`).
2. Choose a workspace parent folder. Its siblings are `Projects`, `Results`,
   `Files`, `Cache` and `Engine`. Installation copies its complete runtime to
   `Engine/runtime/<version>-<revision>/` and opens the engine window.
3. Keep that window open. On the website, open **Files & device → Engine**, enter
   the displayed pairing code and connect. If the browser asks for local network
   permission, allow it for the USBF site. Pairing authority stays in this tab's
   session; saved Projects and shared maps do not contain it.
4. Plan an area load or choose **Native** in processing. Review the input range
   and estimates before starting. Tasks continue locally when the tab closes.
5. Browse the complete indexed result through local MVT tiles, query its full
   attribute table and select records for further native processing. A bounded
   preview remains available when the original native workspace is disconnected.

To start again, use the installed Start Menu entry on Windows, the USBF app in
your user Applications folder on macOS, or the application-menu entry on Linux.
Each workspace also has a launch file directly in `Engine/`. Launch entries are
scoped to the current user and updated only when their saved contents still
match; edited entries are preserved. The executable recognises its workspace
marker. Uninstall from the engine window; the website can request
that desktop confirmation. Uninstall removes managed program folders, while
Projects, Results, Files, Cache, workspace identity and task history remain.
Unknown folders and changed user files are not treated as runtime files.

This release supports Windows x64, Linux x64, macOS Apple Silicon and macOS
Intel. The manifest records tested operating-system requirements. Mobile
browsers use browser processing. The native tile service covers the full local
result; public nationwide browsing continues to use PMTiles. Cloud job execution, accounts and
simultaneous Project editing are not part of this local preview.

## Resources, diagnostics and cache

The desktop **Resources and cache** window and website **Files & device → Local
engine** expose CPU threads, native memory limit and a soft source-cache target.
Changes require active tasks to finish first. A target of zero stops adding new
shared source entries; verified existing bytes remain available until cleanup.
DuckDB can spill intermediate computation to the workspace Cache folder.

SHA256-pinned source files are verified and reused across tasks from the managed
`Cache/native-sources-v1` store. Explicit cleanup first previews its candidate
files. It removes only unchanged verified source-cache files that no unfinished
task references, plus verified intermediates whose completed output and receipt
are intact. Projects, source Files, Results, task history, unrecognized bytes,
and all resumable-task checkpoints remain. The cache target is a soft target,
not a disk quota; protected data may exceed it. Native spatial indexes,
selections and exported subsets are retained separately in this preview.

Local health checks test the bundled spatial runtime, workspace free space and
managed cache ownership. They do not claim network reachability or publisher
identity. Package hashes verify bytes; this preview is still unsigned by a
publisher and is not notarized by Apple.

## Build and verification

Build on each target OS with Python 3.11:

```sh
python -m pip install -r native-engine/requirements.txt -r desktop-engine/requirements-build.txt
python desktop-engine/build.py --work /scratch/build --output /scratch/assets --revision <commit>
python desktop-engine/ci_check.py --assets /scratch/assets --work /scratch/acceptance
```

Windows builds also require NSIS; Linux GUI tests require Xvfb. macOS packaging
uses `codesign` and `hdiutil`. Build outputs and caches belong outside the source
tree. The workflow runs real geographic extraction, exact attribute preservation,
large results, cancellation/restart/resume, checksum/origin/path restrictions,
the actual installer, bundled API/SQL runtime, a Tk window and data-preserving
uninstall before publishing all four packages as a prerelease.

Signed Spatial extension bytes are stored as a gzip resource so macOS signing
cannot rewrite DuckDB's embedded extension signature. At runtime they are
expanded into the managed engine folder and checked against the build SHA256;
DuckDB then validates its official signature on `LOAD`. Unsigned DuckDB
extensions are never enabled.
