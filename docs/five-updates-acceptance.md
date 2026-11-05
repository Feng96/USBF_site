# Full results, consistent scope and portable Projects

Implementation and verification date: 2026-11-04. Final deployment and native
release identities are recorded below when their independent receipts exist.

## Complete analytical results

Full native GeoParquet files remain in `Results`. MapLibre requests authenticated
MVT over a custom protocol; bearer tokens and native paths never enter tile URLs.
Low-zoom aggregates and adaptive dense-tile aggregation represent the complete
input rather than the first N records. Display geometry is quantized; counts
across overlapping tile edges must not be summed as a global record count.
Exact clicked attributes and whole geometries are read separately from the file.

A typed DuckDB table and RTree index provide viewport queries. Safe common display
scalars support source/height colors and filters; long/nonfinite display values
are omitted from tiles while their originals remain in the file. Aggregates
remain count views, with explicit detail guidance when an attribute display
filter requires individual records. Full attribute tables support pagination,
typed comparisons, global sorting/search and map selection highlighting.

Selection snapshots are immutable and bound to the source SHA256. Box, polygon,
query and individual-record selection operate on complete records. Fixed table
inputs constrain query selection, exports and derived layers. Selection requests
are serialized per visual layer. Native processing consumes the full snapshot,
never a bounded saved preview. Exact large identifiers remain decimal strings at
the JSON boundary; native file types remain intact.

Zero-row files retain original field schemas and explicit GeoParquet WKB / EPSG:4326
metadata. No placeholder buildings or bounding boxes are invented. Oversized
feature/table JSON requests still have explicit byte budgets; the complete file
remains available. GeoJSON and CSV export stream locally; browsers without a file
stream picker retain the explicit 64 MiB download fallback limit. CSV cannot
distinguish an empty string from a null cell; GeoParquet preserves original types.

## Consistent loading scope

Both execution paths retain whole geometries intersecting the saved boundary,
including boundary touching and courtyard-hole semantics. Ownership coordinates
cannot safely exclude long crossing geometries and are no longer used as an
analysis filter. Candidate indexes are verified separately from source coverage.

All 3,522 published original shards were read without modification and matched
their manifest byte sizes, SHA256 and 150,261,726 total rows. Full finite geometry
envelopes are verified. The geometry index is not a topology audit or evidence
that every real-world building exists in the provider data. Verified row ranges
must partition the complete source without gaps. The national row-group index contains 5,512 ranges across all 3,522 files, SHA256 `2fde03b97b2d9c40c2ed714632b5cabe961028b2ea0e9a4bc29f54bd4b549565`. Large files use their actual Parquet row groups; smaller files retain a complete logical range. Unknown ranges are read rather
than silently omitted. Pinned browser reads still verify complete shard SHA256;
large pinned shards require the local engine instead of bypassing this check.

## Projects and local operation

Project ZIP64 packages stream native dependencies without loading them into
browser memory. Import verifies all member names, sizes, SHA256, schemas and row
counts before adoption. No general archive extraction is used. A persisted
restoration receipt allows recovery if queuing fails; the current map remains
protected by Project validation and the unsaved-change guard. A moved file needs
the exact saved SHA256 before relinking. Duplicate dependencies share one package
member. Public online sources and renderer assets are not silently bundled.

The local runtime has workspace and user application launch entries, real health
checks, persisted CPU/memory settings, content-verified source download reuse and
explicit cache cleanup. A cache target is soft; cleanup preserves results,
projects, source files, unfinished checkpoints and analytical selection/index
state. Removal affects only owned unchanged launch entries and managed runtime
files. GUI, browser and cloud execution are labelled; cloud computation and live
coediting are not connected. English remains primary; Chinese translates system
and interface text while fields, layer names, paths, IDs and data remain opaque.

## Verification

| Evidence | Result |
| --- | --- |
| Full native engine regression after zero-row fix | 67 passed |
| Full-result browser interactions | 46 passed, no browser errors |
| Real Project package browser workflow, separate workspaces | 20 passed |
| Actual empty-result browser workflow, schemas and safe attribution rendering | 10 passed |
| Frontend regression groups for native authority, scope, Projects and UI | 15 suites / 357 checks passed |
| Actual GeoParquet worker including crossing geometries and safe row-group pruning | 31 passed |
| Geometry index registry and exact-source binding | 8 passed |
| Original-data no-overwrite publication and geometry generator | 10 passed |
| Row-group generator | 7 passed |
| Actual public PMTiles / original-data browser and isolated sharing on staging | 35 passed |

One actual public HTTPS shard matched its 29,754-byte expected identity and
retained both original records. A DC source shard with 601,007 records and
84,558,962 bytes produced 508 records for the fixed test AOI: 67 ordinary field
names/types, all values and canonical geometries matched the original, with zero
differences. Boundary touching, empty extraction, full tiles/table/attributes and
paired HTTP access also passed. This is a targeted real-provider test, not a
performance benchmark of the national dataset.

Synthetic regular-rectangle tests at 100,000 and 1,000,000 records passed under
a 512 MiB DuckDB limit. For the million-record fixture, index construction took
3.82 s, the detail tile 110 ms, a cached tile 6 ms, typed query/sort 69 ms, and a
10,000-record selection 278 ms; peak process RSS was about 451 MB. These results
depend on the test hardware and geometry complexity.

Development receipts remain in the isolated scratch test workspace. Native
installers require separate target-platform installer, GUI, API/SQL and uninstall
acceptance before the website advertises them.

## Original-data publication status

The publication tool and verified manifest plan are complete. The plan contains
24,185,934,449 source bytes under a separate full-manifest-hash prefix. Every
uploaded object must be read back and hashed; publication markers are written
last. Existing different bytes are refused rather than overwritten. Credentials
are discovered from normal AWS environment/profile configuration and never enter
the website, a Project, a CLI argument or a receipt.

The earlier private Source Cooperative session was checked using a signed
read-only request and returned HTTP 403. No archive writes were attempted. A
usable upload session is still needed; the original-data archive has not been
published, and the release
registry explicitly reports `immutable: false` / `pending-upload-credentials`.
Existing data remain accessible through their current source keys with identity
checks. Publisher code signing and Apple notarization also require external
publisher credentials and are not claimed.

## Publication receipts

Native release [`engine-v0.2.0-preview.1-r5`](https://github.com/Feng96/USBF_site/releases/tag/engine-v0.2.0-preview.1-r5), built from `0eba0ab46f0017a4760428d97f4f6df3de1d7d41`, passed all four target builds in [workflow 41935868427](https://github.com/Feng96/USBF_site/actions/runs/41935868427). Each platform passed 22 actual installer/runtime/UI/uninstall checks, plus its source test suites. All four public package sizes and SHA256 values match GitHub release asset digests. Public manifest SHA256: `4804b4648c9ac87905dc4f13acf68643ec9aa9cbe3572189f9659f89a979f939`.

Pages deployment and final production acceptance are recorded in deployment history and the local publication receipt after publication.

## Production website and browser connection

The implementation commit `24225c3a26d7b5501c7a306de4eeafa1426539c7` deployed successfully in [Pages run 41937079448](https://github.com/Feng96/USBF_site/actions/runs/41937079448). The actual public site passed 39 checks, including real DC / New York / Los Angeles / Boston data, complete ordinary attributes, bounded range reads, readonly sharing and Chinese phone layout. Seven deployed resources matched the exact tested source SHA256.

The initial production HTTPS page passed 14 real browser-to-loopback checks after explicit browser local-network permission, including pairing, original attributes, authenticated MVT and full tables. Chromium 141 correctly blocked this connection before permission was allowed. A narrow interface patch supplies English/Chinese instructions for prompt, denied and granted states without requesting or granting permission itself. That patch passed 10 tests using actual browser permission states with only the three local patch scripts substituted; native requests remained direct with normal Origin/CORS and mixed-content enforcement.

The deployed permission patch at `cfe910ff0a456fcba4a6565c9fcf38342bb75abe` passed 15 actual HTTPS-to-loopback browser checks with no script substitution or security bypass flags. Request interception used `route.continue` only, without changing content, headers or CORS. The public scripts matched the tested SHA256. Pairing, actual local processing, authenticated MVT rendering, exact original attributes in the full table, and UI disconnect with credential removal and saved-preview fallback all passed without page, console or network errors.

## Maps from complete native results

Map composition invalidates an old captured preview when the native result identity,
connection state or selection changes, including a replacement selection with the
same count. Workset framing uses the verified complete result bounds; a disconnected
saved preview cannot supply the complete extent. Downloaded map details distinguish
the full GeoParquet identity, generalized display tiles and saved bounded sample,
without including native workspace/task identifiers or local result paths.

The narrow composition regression passed 12 logic checks and 11 real browser
checks with 25,001 complete native records and a 2,000-feature saved preview.
The browser downloaded an actual PNG and map metadata and verified invalidation
after reconnection and same-count selection replacement, complete-result framing,
and disconnected-preview protection without uncaught browser errors.
