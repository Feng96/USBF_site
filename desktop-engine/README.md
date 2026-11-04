# USBF Engine preview

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
5. Add a bounded map preview or open the full paginated attribute table. Further
   native processing reads the complete GeoParquet result. Preview geometry is
   not silently promoted to a complete browser workset.

To start again, open the installed `USBFEngine.exe`, `USBFEngine.app` or
`USBFEngine` inside the managed runtime folder. The executable recognises its
workspace marker. Uninstall from the engine window; the website can request
that desktop confirmation. Uninstall removes managed program folders, while
Projects, Results, Files, Cache, workspace identity and task history remain.
Unknown folders and changed user files are not treated as runtime files.

This release supports Windows x64, Linux x64, macOS Apple Silicon and macOS
Intel. The manifest records tested operating-system requirements. Mobile
browsers use browser processing. The initial map result is a bounded sample;
it is not a nationwide dynamic tile service. Cloud job execution, accounts and
simultaneous Project editing are not part of this local preview.

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
