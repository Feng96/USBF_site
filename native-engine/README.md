# USBF Local Engine API v1

This service runs DuckDB Spatial on the user's computer. Its workspace is a
single selected parent containing `Projects`, `Results`, `Files`, `Cache` and
`Engine`. It never starts or opens a Codex database. The desktop launcher and
installer live in `../desktop-engine/`.

## Development

Use Python 3.11 or later and an isolated virtual environment. Large environments,
test data and build outputs belong on an appropriate local scratch disk.

```sh
python -m venv /path/to/isolated/venv
/path/to/isolated/venv/bin/pip install -r native-engine/requirements.txt
PYTHONPATH=native-engine /path/to/isolated/venv/bin/python -m usbf_engine \
  --workspace /path/to/USBF --port 52763
```

The CLI prints a local, single-use eight-digit pairing code, valid for three
minutes. The desktop program displays the code in its own window. Packaged
builds include the signed `spatial.duckdb_extension` matching DuckDB's exact
version and platform. A developer launch can install that signed extension
from DuckDB's HTTPS CDN into the workspace cache; `--no-extension-install`
disables this fallback. An existing system GDAL, Python or DuckDB installation
is never used by a packaged build.

The implementation pins DuckDB 2.0.0 and psutil 7.2.1. Runtime status reports the
versions actually loaded, including Spatial and PROJ. GDAL is provided by
DuckDB Spatial; the service does not claim a separately installed GDAL version.
See [DuckDB 2.0 release](https://github.com/duckdb/duckdb/releases/tag/v2.0.0),
[Spatial documentation](https://duckdb.org/docs/2.0/core_extensions/spatial/overview)
and [geometry CRS documentation](https://duckdb.org/docs/2.0/sql/data_types/geometry).

## Desktop integration

```python
from threading import Thread
from usbf_engine import Engine
from usbf_engine.server import serve

engine = Engine(workspace_parent, extension_path=bundled_signed_extension)
engine.set_build_info({"packageVersion": "0.1.0-preview.1", "revision": revision,
                       "platform": platform_name, "signed": False})
engine.set_uninstall_handler(request_local_desktop_confirmation)
pairing_code = engine.pairing_code()  # Display locally, never expose through HTTP.
server = serve(engine, port=52763, origins=["https://feng96.github.io"])
Thread(target=server.serve_forever, daemon=True).start()
# Clean shutdown:
server.shutdown()
server.server_close()
engine.close(revoke=True)
```

`serve` always binds `127.0.0.1`. A workspace lock prevents two service instances
from using the same task database. `Engine/workspace-id.json` is a persistent
marker shared with the browser's workspace connection. Uninstall requests only
notify a registered desktop callback. The desktop must ask the local user and
remove only its installed runtime; projects, source files, results, cache and
task history remain user data.

## HTTP contract

All JSON uses UTF-8. Bodies are limited to 16 MiB. Except minimal health and
pairing, endpoints require `Authorization: Bearer <token>`. Browser requests
must have an exact allowed Origin. Default allowed origin is
`https://feng96.github.io`; development origins must be explicitly supplied.
The service rejects a mismatched Host, wildcard origins, arbitrary shell
commands, SQL, absolute input paths and private-network source URLs. CORS and
compatible Private Network Access preflight responses are provided, but browser
local-network permission remains subject to browser policy.

| Method and path | Response or behavior |
| --- | --- |
| `GET /v1/health` | Minimal service/version/API identity; no machine paths or hardware |
| `POST /v1/pair` | `{code}` → `{token,workspaceId,version}`; code consumed once |
| `POST /v1/unpair` | Revoke this token; running jobs remain |
| `GET /v1/status` | Actual runtime, build, hardware, workspace and capabilities |
| `GET /v1/files?path=Files` | At most 500 folder entries; `limited` signals more |
| `GET /v1/files/stat?path=Results/x.parquet` | Cheap existence/stat; cached published checksum only when size and timestamp match |
| `POST /v1/files/import` | `{name,data:FeatureCollection}` → new collision-safe `Files` path |
| `POST /v1/plan` | Fixed selected part list, source-file row/byte upper bounds and disk estimate |
| `POST /v1/jobs` | Persist a new job before it is queued |
| `GET /v1/jobs` | Latest 500 summaries; omits full part list, exact boundary geometry and large input contract |
| `GET /v1/jobs/{id}` | Full durable task including source parts, exact scope and input contract |
| `POST /v1/jobs/{id}/cancel` | Cooperative network/hash/SQL cancellation; no partial output publication |
| `POST /v1/jobs/{id}/resume` | Retry missing parts after failed, partial, cancelled or interrupted task |
| `GET /v1/jobs/{id}/table?offset=0&limit=100` | At most 1,000 rows per page and original field types |
| `GET /v1/jobs/{id}/preview?limit=2000` | At most 2,000 features, explicitly marked as a display preview |
| `GET /v1/jobs/{id}/download?format=parquet` | Stream complete local GeoParquet |
| `GET /v1/jobs/{id}/download?format=metadata` | Stream reproducibility receipt |
| `GET /v1/jobs/{id}/download?format=geojson` | Whole GeoJSON only if the entire result fits the 2,000-feature budget |
| `POST /v1/uninstall-request` | Ask the desktop controller; available only when registered |

Tokens are generated with 256 bits of randomness and stored as SHA256 hashes.
Pairing attempts are rate limited. Clean shutdown revokes tokens. A single tab
can unpair without cancelling its durable jobs. Generating a new desktop code
does not revoke other paired tabs; the local shutdown action revokes all.

## Fixed input and task scope

```json
{
  "schema": 1,
  "operation": "extract-mask",
  "name": "District buildings",
  "inputs": [{"kind": "file", "path": "Files/buildings.parquet"}],
  "scope": {
    "crs": "EPSG:4326",
    "label": "My study boundary",
    "geometry": {"type": "Polygon", "coordinates": [[[-77.1,38.8],[-76.9,38.8],[-76.9,39],[-77.1,39],[-77.1,38.8]]]}
  },
  "parameters": {},
  "release": {"policy": "pinned", "releaseId": "published-release-id"},
  "inputContract": {"mode": "fixed-workset", "selectedSourceRows": ["stable-row-id"]}
}
```

Supported operations are `load`, `extract-box`, `extract-mask`, `merge`,
`measure` (collision-safe geodesic area and boundary/line length fields), and projected `buffer`.
Extraction retains whole intersecting source polygons. There is no implicit
clipping. All boundaries and output geometry use EPSG:4326 longitude/latitude.
Source CRS is read from GeoParquet/GDAL metadata, or must be explicitly supplied
when it is unknown. Disagreement with identified source metadata is rejected.
Buffer requires `distanceMetres` and a known metre-based `measurementCRS`
(a UTM EPSG:326xx/327xx zone, EPSG:5070, 6933 or 3035); users must choose a CRS
suitable for their area. Output remains EPSG:4326. Merge rejects conflicting
common attribute types instead of silently coercing them; absent fields are null.

Input kinds:

* `file`: workspace-relative `Files/...`, `Results/...` or `Cache/...`, optional
  `sha256`, `rows`, `crs`. File size and modification timestamp are frozen at
  planning; an optional checksum is verified before reading.
* `inline` or `geojson`: a fixed browser FeatureCollection in `data`, limited to
  16 MiB and frozen into a checksummed task cache before execution.
* `url`: approved public HTTPS static vector file, `format`, optional `sha256`,
  `bytes`, `rows`, `crs`. Each redirect is validated. Dynamic/paginated ArcGIS
  and NYC endpoints are rejected; their browser adapters must complete their
  paging contract before transferring a fixed workset.
* `usbf` / `usbf-manifest`: an immutable selected `files` array with
  `{path,url,sha256,bytes,rows,bbox}`, plus `baseUrl`, `manifestUrl`,
  `manifestSha256`, `releaseId`, `licenses`, `crs`. Each file needs a SHA256.
  Supplied file lists are honored without fetching mutable latest manifests.
  Without a file list, the manifest is fetched, bounded to 16 MiB, and checked
  against its supplied SHA256. File boxes select candidates; exact geometry
  intersection determines output membership.

Input contracts are bounded plain metadata, never executable SQL. Current
provider coverage is distinct from successful request completion: completing
every planned source file does not establish that a provider maps every real
building. A zero-feature spatial result can still be a successfully completed
request.

## Durable results and limits

The SQLite task store is `Engine/state/jobs.sqlite3`. Each source file has a
separate checksummed GeoParquet checkpoint under `Cache/native-jobs/{jobId}`.
After restart, previously active tasks become `interrupted` and await explicit
resume. Successful checkpoints are verified and retained; missing/failed source
parts are retried. A task with any failed part is `partial` or `failed` and has
no complete published result. Failed-part identities and messages remain in
the full task manifest.

Successful output is `Results/{jobId}.parquet` plus `.metadata.json`. The receipt
records the exact boundary, release references, source checksums/counts, input
selection metadata, output checksum/count, original field types and derived
fields. Receipt and result publication are recoverable across a crash before
the final database update. Unknown existing output is preserved and reported.

There is no browser-style 20,000-row native truncation. Native jobs are still
limited by the user's disk, memory, source rate limits and operation cost.
Unknown source sizes are explicitly reported as unknown, not an assurance that
the job fits. Default DuckDB memory is 1 GB with two CPU threads and local spill
files; desktop settings can supply different startup values. The queue admits
at most 64 active tasks, up to 64 input descriptors and 100,000 selected parts.

Original Parquet numeric values/types remain intact. JSON table/preview values
outside JavaScript's safe integer range, plus exact Decimal values, are strings with an explicit
encoding notice. Browser preview features are always marked `displayOnly` and
`limited` when incomplete. Native operations chain the complete local result
file; they must never analyze only that preview. The initial preview is a
bounded sample, not a dynamically tiled representation of a huge result.

## Tests

```sh
USBF_ENGINE_TEST_DIR=/path/to/test-scratch \
USBF_SPATIAL_EXTENSION=/path/to/signed/spatial.duckdb_extension \
PYTHONPATH=native-engine /path/to/venv/bin/python \
  -m unittest discover -s native-engine/tests -v
```

The suite runs real Spatial SQL and GeoParquet writes, including an output above
the browser workset budget, long IDs/nulls, exact whole-geometry extraction,
projected CRS conversion, failed-part restart/resume, checksum mismatch,
cancellation, recoverable publication, pairing and HTTP origin/path restrictions.
Installer builds require their own Windows/macOS/Linux artifact smoke tests.
