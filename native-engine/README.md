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

The implementation pins DuckDB 2.0.0, psutil 7.2.1 and certifi 2026.10.23. Public
HTTPS uses the bundled CA certificates with hostname and certificate checks;
it does not rely on a host Python certificate installation. Runtime status reports the
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
engine.set_build_info({"packageVersion": "0.2.0-preview.1", "revision": revision,
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

The installer creates an owned workspace launch file in `Engine/` and a per-user
Start Menu entry (Windows), Applications entry (macOS), or application-menu entry
(Linux). Reinstallation updates only unchanged owned entries; uninstall preserves
user-edited entries. Preview packages remain without publisher signing or Apple
notarization; an ad-hoc macOS integrity signature is not a publisher signature.

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
| `GET /v1/maintenance` | Local resource preferences, verified shared cache totals, protected bytes and soft-target status |
| `POST /v1/maintenance/settings` | `{threads,memoryMiB,cacheQuotaMiB}`; only when no queued/running task remains |
| `POST /v1/maintenance/cleanup` | `{dryRun:true,allUnused:false}` by default; previews/removes only verified disposable cache files |
| `GET /v1/diagnostics` | Actual Spatial load, disk and managed-cache ownership checks; no claim of network reachability |
| `GET /v1/files?path=Files` | At most 500 folder entries; `limited` signals more |
| `GET /v1/files/stat?path=Results/x.parquet` | Cheap existence/stat; cached published checksum only when size and timestamp match |
| `POST /v1/files/import` | `{name,data:FeatureCollection}` → new collision-safe `Files` path |
| `POST /v1/plan` | Fixed selected part list, source-file row/byte upper bounds and disk estimate |
| `POST /v1/jobs` | Persist a new job before it is queued |
| `GET /v1/jobs` | Latest 500 summaries; omits full part list, exact boundary geometry and large input contract |
| `GET /v1/jobs/{id}` | Full durable task including source parts, exact scope and input contract |
| `POST /v1/jobs/{id}/cancel` | Cooperative network/hash/SQL cancellation; no partial output publication |
| `POST /v1/jobs/{id}/resume` | Retry missing parts after failed, partial, cancelled or interrupted task |
| `GET /v1/jobs/{id}/table?offset=0&limit=100` | At most 1,000 rows and 16 MiB per page; oversized pages are rejected |
| `GET /v1/jobs/{id}/preview?limit=2000` | At most 2,000 scanned features and 8 MiB, explicitly marked as a display sample |
| `GET /v1/jobs/{id}/download?format=parquet` | Stream complete local GeoParquet |
| `GET /v1/jobs/{id}/download?format=metadata` | Stream reproducibility receipt |
| `GET /v1/jobs/{id}/download?format=geojson` | Whole GeoJSON only if the entire result fits the 2,000-feature budget |
| `GET /v1/jobs/{id}/map` | Complete-result bounds/count and native tile capabilities; builds a disposable spatial index |
| `GET /v1/jobs/{id}/tiles/{z}/{x}/{y}.pbf?selectionId=...` | Authenticated MVT; all records contribute to adaptive aggregates or detail |
| `GET /v1/jobs/{id}/features/{row}` | Exact original full feature by stable zero-based row; 16 MiB response budget |
| `POST /v1/jobs/{id}/query` | Full native attribute filters, search, sort, selected-record filtering and bounded pages |
| `POST /v1/jobs/{id}/selection` | Immutable server-side selection snapshots from IDs, boundary or attribute query |
| `POST /v1/jobs/{id}/summary` | Complete result or selection record counts, missing-value counts and numeric summaries |
| `GET /v1/jobs/{id}/export?format=geojson\|csv\|parquet&selectionId=...` | Full original/selected export, generated incrementally to disk and streamed |
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
* `native-selection`: `jobId` and immutable `selectionId` returned by the
  selection endpoint. Planning materializes the complete selected rows into a
  checksummed local GeoParquet input. Subsequent processing never uses map
  geometry or the preview sample as input.
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

Resource preferences persist in `Engine/resource-settings.json`. Configuring
threads/memory requires active jobs to finish first and applies to subsequent
DuckDB connections. Existing system GIS environments are not selected or changed.
The website and desktop show that native computation runs on this computer;
public data hosting is separate from cloud job execution.

SHA256-pinned downloads share a verified content-addressed store under
`Cache/native-sources-v1`. Every cache hit checks its complete SHA256 before
reuse. Native-cache cleanup first returns a preview and performs no deletion
unless `dryRun:false` is explicit. It preserves every unfinished-task dependency,
changed or unrecognized bytes, all Projects/Files/Results and task history.
Completed intermediates are removable only if their original hashes and the
published result plus receipt still match. The source-cache target is soft and
requires explicit cleanup: protected bytes can exceed it. A zero target stops
new shared-source storage, while existing verified entries remain available.
Spatial indexes/selections and generated exports remain in their separate native
cache directories in this preview. The browser file manager treats all native
cache folders as read-only and never removes them through browser-cache cleanup.

Original Parquet numeric values/types remain intact. JSON table/preview values
outside JavaScript's safe integer range, plus exact Decimal values, are strings with an explicit
encoding notice. Browser preview features are always marked `displayOnly` and
`limited` when incomplete. Native operations chain the complete local result
file; they must never analyze only that preview. The initial preview remains a
bounded fallback sample. Engine 0.2 capabilities separately enable indexed
complete-result map exploration.
Rows are fetched and serialized incrementally. SQL-side size checks keep
oversized individual values out of the browser transport. Preview features that
exceed its byte budget are omitted whole, with explicit omission counts and a
warning; geometry and attributes are never shortened to make them fit. Table
pages exceeding 16 MiB fail clearly and suggest a smaller page or complete
GeoParquet download. Preview scope contains only a label, CRS and bounds; its
receipt and full job retain the exact boundary and release metadata.

## Complete-result maps and selections

`Cache/native-results/{jobId}/index.duckdb` holds original typed attributes,
stable zero-based row identities, display geometry and two persistent RTree
indexes. A single ordered Parquet scanner assigns identities without reserving
any original attribute name. Source checksum identity and the published file's
size/timestamp must match before a cached index or tile can be used. The index
requires additional disk and may take time to build; it can be rebuilt from the
authoritative original result. Original files and attributes are never edited.

Tile layer `buildings` contains `nativeId` (`jobUUID:row`) and `selected` plus a
numeric MVT feature ID. Original attributes come from the feature endpoint,
avoiding tile-field truncation or unsafe numeric IDs. Below zoom 14, or above
20,000 intersecting records in a tile, the `clusters` layer aggregates all
intersecting records into up to 256 cells with `count` and `selectedCount`.
Oversized detail tiles also aggregate; no first-N sampling is used. A geometry
crossing several tiles contributes in each tile it intersects, so cluster counts
must not be summed across neighboring tiles as a global total. `map.recordCount`
and native summaries supply authoritative counts. Detail geometry is clipped
and quantized for display; original GeoParquet remains the analytical input.
Common height, area, source and `modified` scalar fields are also available for
detail styling, listed by exact original name in `map.displayFields`. Display
strings over 128 characters and unsafe/nonfinite numeric display values are
omitted rather than shortened; individual inspection retains the original
attributes. Aggregates show counts instead of per-building height/source styles.

For example, `query` accepts:

```json
{"offset":0,"limit":100,"filters":[{"field":"height","op":"gte","value":20}],"sort":{"field":"height","direction":"desc"}}
```

Conditions are ANDed and support `eq`, `ne`, `gt`, `gte`, `lt`, `lte`,
`contains`, `is-null` and `not-null`. `search` is a bounded case-insensitive
substring search over original attributes. `selectionId` filters to a selection;
`highlightSelectionId` marks selected rows without filtering. Sorting uses a
stable row tie-break. Pages contain attributes without geometry; exact geometry
is requested only for individual inspection. Attribute names are checked against
the original schema and values are SQL parameters; no arbitrary SQL is accepted.

Selection requests accept `mode` (`replace`, `add`, `remove`, `intersect`,
`invert`, `clear`), optional `baseSelectionId`, and exactly one of `ids`, `scope`
or `query`. Inversion and clearing require no criterion. A response returns
`{jobId,selectionId,count,bounds}`. A new immutable snapshot makes independent
browser selections safe to share one engine. Polygon and MultiPolygon selection
uses whole-geometry intersection, including boundary touches. The browser keeps
only a selection identity/count, even when millions of records are selected.
Selections are cache dependencies; a removed selection must be made again.

Full CSV/GeoJSON exports are disk-backed and have no 2,000-record preview limit.
Nested values are JSON in CSV. Large integer and Decimal JSON values use exact
strings; original GeoParquet types remain intact. Empty CSV cells follow CSV's
usual null/empty ambiguity; GeoJSON or GeoParquet retain typed nulls. Exporting a
large download still depends on browser file-saving capabilities and disk space.

An opt-in benchmark builds actual 100,000 and 1,000,000-rectangle GeoParquet
fixtures, checks complete aggregate counts, finds the final record beyond the
preview, filters/sorts the full table and selects 10,000 full records:

```sh
USBF_SPATIAL_EXTENSION=/path/to/signed/spatial.duckdb_extension \
  /path/to/venv/bin/python native-engine/tests/benchmark_results.py \
  --root /large/scratch/usbf-benchmarks --output /large/scratch/results.json
```

On the development Linux host with a 512 MiB DuckDB limit, the million-record
synthetic fixture indexed in 3.82 s; detail tiles took 0.11 s, a cached tile
0.006 s, filtered/sorted attributes 0.069 s, and a 10,000-row selection 0.278 s.
Peak process RSS was 451 MB. These are measured synthetic/hardware-specific
results, not estimates for the full national USBF data or complex real geometries.
The benchmark exposed an optimizer issue where clipping predicates forced a
full scan; materialized spatial candidates retain the actual RTree index scan.

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
