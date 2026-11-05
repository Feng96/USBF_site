# US Buildings

## Complete results and portable Projects (workspace 1.12 / engine 0.2)

- A local GeoParquet result has one layer with authenticated MapLibre MVT,
  low-zoom aggregates and original-feature inspection. The saved bounded preview
  is a disconnected fallback; selection and analysis use the complete local file.
- Full-result attribute search, typed sorting, box/polygon selection and selected
  records stay linked. A fixed table area, its matching selection and its export
  use the same immutable input scope. CSV, GeoJSON and GeoParquet export support
  full or selected records. Display filters are separate from analytical scope.
- Browser and native USBF readers use whole geometry intersection, including
  touching outlines. SHA256-bound full geometry envelopes cover every published
  shard. Verified internal row ranges allow safe browser pruning without
  rejecting long buildings by their ownership coordinates. Request completion,
  index coverage and real-world provider completeness are separate statuses.
- **Projects → Project dependencies** creates a local `.usbf.zip` package with
  complete native results and embedded map assets. Copy it into another engine's
  `Files` folder, verify it and restore it, or relink a moved dependency by its
  saved SHA256. Public catalogs, basemaps and the online renderer remain internet
  dependencies; a package is not a national-data mirror or an offline renderer.
- **Start a task** guides area selection, fixed worksets, summaries and maps.
  **Files & device** manages actual CPU/memory limits, health checks, shared
  verified downloads and safe cleanup. Installed workspace and user application
  entries start the isolated runtime; existing system GIS packages remain separate.

The current original source uses mutable flat keys. Checksums verify identities,
but permanent remote availability still needs the original-data release upload.
`tools/publish-original-release.py` prepares and verifies a separate hash-addressed
release and never overwrites an existing object. Actual Source Cooperative
publication requires configured upload credentials. Publisher signing and Apple
notarization are not supplied by this preview.

For the first desktop connection, allow the browser's **Local network access**
request. If it was blocked, use the site information control beside the address
bar to restore that permission, start USBF Engine and reconnect in **Files & device**.
The website explains permission and desktop-start failures in English and Chinese.

See [the implementation acceptance record](docs/five-updates-acceptance.md) for
verification, benchmark limits and publication receipts.

## Versioned USBF map display (1.6)

The default USBF map reads a pre-generated national PMTiles archive from Source
Cooperative. Pan and zoom use MapLibre vector-tile caching and make no original
GeoParquet requests. Original polygons and full attributes load only for an
explicit building, statistical, modeling or data-download operation. Display
geometry may be clipped or simplified and must not stand in for full source
geometry in scientific analysis. Low-zoom density reduction is cartographic.

The website follows a small stable display manifest; immutable archive versions
carry their SHA256 and source release. Future accepted data and display releases
can update these manifests without changing the website code. Project identity,
local project storage, English/Chinese interface selection and Models sidebar
controls remain independent of the display transport. Clear cache releases
on-demand original-data caches while retaining current work and saved projects.

[Open the workspace](https://feng96.github.io/USBF_site/).

A map for the published USBF U.S. building inventory, comparison datasets and
research roof models. Search a place, inspect buildings, summarize an area and
save a map or data. Advanced controls stay in the tools and layer menus.

## Workspace 1.4

- USBF uses its own PMTiles display publication for map navigation. Opening the
  map, zooming, panning, and saving a map image do not read building GeoParquet.
  Statistics, spatial tools, charts, original-data downloads and LoD1 creation
  load original records only when requested, for the captured map area, study
  boundary or selected building. Repeated requests reuse bounded source caches.

- A compact header and toolbar. Statistics, spatial tools, charts, drawing,
  coordinate settings and map styling open from **Tools**. Layer opacity,
  publication status and source details live in each layer’s settings. Rename,
  recolor and reorder layers there without adding controls over the map.
- A quick local list of 821 U.S. cities, states and coverage entries, plus
  32,363 official Census Gazetteer places loaded by state. Same-name places
  remain separate choices. Street addresses use an explicitly submitted U.S.
  Census Bureau query. Address points are
  approximate locations along a street range, separate from identified buildings.
  Building cards show readable height, footprint source, area and edit status;
  original fields and component licenses remain under details.
- Local and HTTPS imports: GeoJSON, GeoParquet, CSV/TSV points, KML, zipped Shapefiles,
  GeoTIFF/COG, georeferenced PNG/JPG/WebP and vector/raster PMTiles. Network
  connections also accept XYZ vector/raster tiles and WMS 1.1.1 in EPSG:3857.
  GeoParquet keeps exact identifiers, dates, nulls, original files and source
  licenses. Embedded horizontal CRS definitions are used when supported;
  an unknown CRS prompts for a declaration before adding the data.
- Building heights render as LoD1 only when a real positive source height exists.
  The existing eight US experimental LoD2 buildings and twenty Dutch training
  roofs remain separate collections. Import static OBJ or self-contained GLB
  models with explicit placement, up axis, units, elevation and scale. Download
  original files or a ZIP containing placed OBJ geometry and its location file.
  Model export actually applies units, orientation, scale and elevation.
  GLB structure and allocation sizes are checked before the 3D loader runs.
- **Models → Create from buildings** produces genuine flat-roof LoD1 OBJ/GLB
  files from complete original footprints and positive supplied heights. Holes,
  multipart buildings and exact geographic placement are retained. Missing
  heights are skipped and counted. Downloads include source attributes,
  component licenses, captured scope and a reversible local AEQD projection.
  The map preview uses the original geographic footprints; it does not place a
  large projected mesh using an approximate map transform. LoD2 research models
  remain a separate experimental collection.
- A frozen data snapshot drives numeric summaries, category frequencies,
  histograms, scatter plots and grouped averages. Statistics prepare their inputs
  automatically; explicit refresh marks a new calculation. PNG charts embed their
  exact source, area and licenses; SVG and CSV are also available. Nulls, missing
  building-height codes and booleans never become measured zero height.
- Metre-based buffers, polygon clipping, intersection overlay, spatial selection,
  counts and intersection-area summaries within polygons, centroids and geometry
  measurements. Results become independent, downloadable vector layers.
  Derived buffers and overlays keep source height attributes for reference but
  are not automatically extruded as physical buildings.
- Draw points, lines, polygons and point labels. After drawing a study area,
  choose the building dataset and directly summarize or download its buildings.
  Whole original buildings intersecting the area are included once; holes and
  missing heights remain meaningful. The exact boundary and source details are
  frozen with the result. Escape cancels; Enter finishes; Backspace undoes a vertex.
- Real coordinate conversion for imports, readouts and exports: WGS84, Web
  Mercator, north/south UTM and custom PROJ definitions. The map itself renders
  in EPSG:3857. Horizontal conversion leaves source Z values and vertical datums
  unchanged.
- Map layouts include the current rendered vectors, raster previews and 3D
  models, plus title, dataset legend, scale, north arrow, date, extent and source
  credits. Legends use the same colors and classes as the map, including source,
  change status and the continuous building-height scale. Download PNG at standard
  or true 2× rendering resolution, download
  map metadata, or download a PDF directly. PDF supports Letter/A4/A3, portrait
  or landscape and page margins. Paper text uses readable physical sizes; long
  source credits continue on additional pages. A source-details JSON stays attached.
  Pending/failed data require explicit consent
  to make a clearly labelled partial map.
- Save and open a portable `.usbf.json` map from **Tools → Save or open a map**.
  It retains original vector records, drawings/labels, raster and model original
  files, source rights, derived-result scope, styles, order, camera and CRS.
  Catalog sources reconnect to the latest publication. Embedded files are checked
  before replacement; a staging failure keeps the previous map intact.
  GeoTIFF windows retain their original read extent when a saved map opens or
  its palette changes.
- Download complete loaded source geometry as WGS84 GeoJSON, declared projected
  JSON or CSV with WKT. Original local raster files remain available unchanged.

## Fast rendering and analytical data

The display and analysis paths have different contracts:

| Input | Map display | Statistics and spatial analysis |
|---|---|---|
| Full imported vector | Browser GeoJSON tiles | Frozen complete source geometry, or whole features intersecting a chosen extent |
| USBF with its analytical source | Versioned PMTiles with renderer tile caching | Data & scope explicitly loads originals for a saved boundary; analytical tools use the resulting fixed workset |
| GBA / government batch | Current neighborhood | Live display cache only; prepare a fixed workset for a saved area before analysis |
| PMTiles / MVT | Fast, clipped/simplified tiles | Display and attribute inspection only; analytical inputs and original-data exports require a fixed full-geometry workset |
| Raster tiles / raster image preview | Georeferenced display | Excluded from vector analysis; GeoTIFF details expose clearly labelled preview sample summaries rather than claiming full-resolution pixel statistics |

`PortalAnalysisData.capture()` makes a deep-frozen independent source snapshot.
Panning, live publication updates and later layer edits do not change an existing
result. Every chart, derived layer and data export retains its scope, component
licenses and lineage. Reimporting an exported tile preview does not erase its
restrictions. A regional or nationwide analysis needs an original analytical
source and a suitable processing service; this site does not scan 150 million
buildings in a browser or substitute loaded tile counts for national totals.

The attribute table remains an explicitly labelled current-view preview. Its
CSV/fragment exports describe their current-view scope; complete source records
are recovered for full-geometry layers before selection or export; use **Download** for source
geometry exports. Overlapping datasets are not automatically reconciled into a
single building inventory.

The USBF display archive contains stable `usbf_id`, source `cx`/`cy`, available
height, footprint source and component terms. A selected tile can request its
complete original building by ID and its published ownership coordinates. The
attribute table remains a clearly labelled tile preview, including after an
analytical source batch has been cached. Original-building cards and downloads
use only actual source records. Display and analytical release dates are kept
separately when the source publication advances before a new display archive.

## Working with data

1. Choose **Add data** → Catalog, From URL or Local File. Declare the source CRS
   when the file does not embed it. CSV requires valid x/y columns; images need
   bounds or a world file. ZIPs need matching `.prj` files or a declared CRS.
2. Open **Data & scope**. Choose a connection and save a named study area. A
   current-view boundary is sampled when saved; later map movement does not change
   it. Explicitly load original records to create a fixed analysis workset, or
   choose an imported original vector layer.
3. Select **All workset records**, **Selected workset records**, or **Workset
   records in saved study area**. Review the exact input count, format and coverage.
   Statistics, charts, processing, LoD1 and data downloads use this same contract.
   An operation's mask/reference boundary remains separate from its input subset.
4. Use **Create map** for images and **Download** for vector data/original files.
   PNG and metadata are complementary: the metadata records source dates,
   styles, limits, camera and local model placements.

Save a map file to keep local files, finished drawings, added analysis outputs
and imported models for another session or device. Shared URLs restore catalog
connections, camera and styles; send the saved map file when local content is
needed. The site does not upload user files to a storage service. Maps include up
to 24 layers and three models, with at most 48 MiB of embedded originals
(32 MiB per original file; map JSON up to 80 MiB). Image-only layers explicitly
retain a display preview rather than claiming original raster pixels. Drawings
restore up to 64 text labels per layer and 128 across a saved map.

## Browser limits and measurement meaning

- Flat-roof mesh creation: at most 2,000 buildings, 75,000 source vertices,
  150,000 triangles and a 10 km local radius. Topology checks have a bounded
  comparison budget, stop at the first invalid intersection and can be cancelled.
  Ground elevation and roof shape are not inferred.
- Direct vector/image inputs: 32 MiB; vectors: 50,000 features / one million
  coordinate positions. Zipped Shapefile expansion is checked before parsing.
- GeoParquet: bounded local files and HTTPS downloads, GeoParquet 1.0/1.1 WKB
  geometry in XY or XYZ. Spherical non-point geometry, GeoArrow encoding and
  unsupported compression are rejected with an explanation. Memory limits apply
  before page decoding; a failed or cancelled import never adds a partial layer.
- GeoTIFF/COG: range-based access, bounded native decode memory, overview/window
  selection, maximum 1536 × 1536 preview. NoData is retained. GeoTIFF extra-sample
  alpha is currently not applied and is recorded in metadata; PNG/JPG/WebP alpha
  is retained. Use original raster pixels in dedicated software for raster
  algebra, full-resolution zonal statistics or scientific raster measurements.
- Statistical snapshots: 20,000 records / 500,000 vertices. Spatial tools:
  1,500 records per input, 200,000 vertices and 50,000 feature pairs, with
  cancellation and result limits. Clip masks have additional union limits.
- Geometry area and length use Turf’s spherical Earth algorithms in m²/metres,
  including polygon holes. Summed areas can overlap when input polygons overlap;
  they are not a survey-grade ellipsoidal or projected engineering calculation.
- Imported models: three at a time, 32 MiB and 150,000 triangles per model. OBJ
  geometry uses a neutral material; external MTL/assets and compressed GLB
  extensions requiring unavailable decoders are not loaded. Placement is manual,
  relative to the map sea-level plane; there is no terrain/vertical-datum fit or
  automatic roof reconstruction.
- Image export requires CORS-compatible sources and a ready map, with a
  16-million-pixel layout limit. Model/viewport availability and network limits
  remain visible rather than being replaced with synthetic data.

## Live USBF and automatic updates

The dataset entry is [opengeos/us-buildings](https://source.coop/opengeos/us-buildings).
The viewer follows `USBF_display/manifest.json` for the display archive and
`USBF_v1/manifest.json` for original analytical records. Neither national index
nor source tile list is bundled in this repository.

- Opening USBF fetches the small display manifest and the requested PMTiles
  ranges. Map navigation uses MapLibre's tile cache and never starts a source
  GeoParquet worker. Original-data metadata is requested when a data tool needs it.
- A visible layer in a visible browser tab checks every five minutes. Returning
  to a foreground tab checks again if the last check was over 30 seconds ago.
  Hidden layers and background tabs pause automatic checks.
- **Refresh data** checks the display publication immediately. A changed archive
  updates the map source while retaining camera, styles and opacity. Existing
  analytical results retain the original release and area used by that calculation.
- Data URLs include each file's current SHA256 as a cache version. File-length
  and exposed ETag changes during a range read reject mixed publication bytes.
  SHA256 is a cache version, not a whole-file integrity verification: the viewer
  reads only selected byte ranges. The persistent analytical worker caches up to
  64 MiB of ranges with their ETags. The source layer retains at most three
  analytical batches within a 24 MiB serialized-memory estimate. Selection-only
  batches cannot answer area queries; truncated batches cannot cover a new area.
- A failed update check retains the last successfully loaded view, displays its
  original publication date and shows an explicit warning. It does not label
  old data as the new release.

Shared USBF links follow the current publication; they do not freeze a data
snapshot. Record the publication date and selected tile checksums for citations.

Future data updates need **no website push** when these publication URLs and
schemas stay compatible. Publish accepted original files and their index first;
publish an immutable display archive and update the display pointer after its
verification. A new source publication does not automatically rebuild PMTiles.
An older displayed release is recorded separately from newer analytical data.
The website reader never modifies scientific outputs or source publication files.

Buildings appear at the display archive's declared zoom levels. Below that,
search for a place or zoom into a city. When no display archive is available,
the publication grid and an explicit **Load original buildings for this area**
action remain available; panning still does not fetch source data.

An analytical request selects original records whose published `cx`/`cy` lie in
the fixed requested bounds plus a 0.002-degree buffer. Full polygons are retained.
This is an ownership-view selection, not an exhaustive intersection query for
very large buildings centered outside that buffer. Actual per-file bounds select
candidate files, including grid-edge footprints. Requests are capped at nine
files, 32 MiB of ranges and 12,000 records; use a smaller area when needed.
Cancelling a tool or opening another map rejects pending metadata and data reads
immediately. Late responses cannot update the replacement project.

The worker reads the core identity, source, state, inherited height, edit,
coverage, snapshot and component-license fields. It does not download the large
`original_geometry` column or every production diagnostic column; the full
published schema and source downloads remain linked. Original-data actions
recover full source features by `usbf_id`,
retaining original nulls. `modified = null` remains unknown, separately from
`false`; the recorded-change color style uses a distinct unknown color.
`height_m` accepts positive source `height` values only. Those heights are
inherited GBA heights; nDSM input coverage flags never overwrite their meaning.

## Development and validation

This is a buildless static site; GitHub Pages serves the repository root.
A local HTTP server is required for ES modules and browser file APIs.
`?empty=1` starts without a default catalog layer.

- `buildings-explorer.js`: U.S. places, explicit Census address lookup and readable building facts.
- `data-manager.js`: map layers, source state, visibility, opacity and styles.
- `data-import.js` / `import-worker.js`: vector/raster parsing and reprojection.
- `geoparquet-import-core.js` / `geoparquet-import-worker.js`: bounded GeoParquet reads.
- `analysis-data.js` / `analysis-ui.js`: scoped snapshots, analysis and charts.
- `workspace-crs.js`: actual coordinate conversion and settings.
- `map-composer.js`: rendered map layouts and analytical source downloads.
- `map-legend.js` / `map-paper.js`: shared map colors and physical PDF layouts.
- `workspace-tools.js`: compact toolbar and geographic drawing/annotations.
- `local-models.js`: user-supplied OBJ/GLB placement and shared-WebGL rendering.
- `model-asset-guard.js`: GLB structural and memory checks before parsing.
- `model-browser.js`: verified experimental and training model collections.
- `usbf-source.js` / `usbf-analysis-worker.js`: display publication, explicit bounded original reads and separate caches. `usbf-worker.js` is retained for old cached viewer versions.

Run the source-contract checks:

```sh
node tools/usbf-update-qa.cjs
node tools/import-qa.cjs
node tools/analysis-qa.cjs
node tools/crs-export-qa.cjs
node tools/local-models-qa.cjs
node tools/pmtiles-qa.cjs
node tools/explorer-qa.cjs
node tools/analysis-export-qa.cjs
node tools/outputs-models-qa.cjs
node tools/geoparquet-import-qa.cjs
node tools/legend-qa.cjs
node tools/model-asset-guard-qa.cjs
node tools/usbf-lazy-qa.cjs
node tools/usbf-lazy-worker-qa.cjs
node tools/lazy-analysis-qa.cjs
node tools/lazy-browsing-qa.cjs
```

Use Node 22 or newer for the complete suite. GeoParquet parser checks use tiny
synthetic files: generate them with
`python3 tools/geoparquet-fixtures.py /path/to/scratch/fixtures` (requires PyArrow),
then pass that directory to `node tools/geoparquet-qa.cjs` and
`node tools/geoparquet-worker-qa.cjs` as their first argument.

`tools/workspace-qa.cjs` uses Playwright, real WebGL and real parsers with explicit
network fixtures to exercise import, CRS, statistics/charts, spatial results,
model loading, drawing, downloads, map generation and mobile layout. Supply
`PLAYWRIGHT_PATH`, `PORTAL_CHROMIUM_PATH` and `PORTAL_QA_OUTPUT`. Its fixture
records are test data, never published as observed buildings. Public USBF range
reads and publication-update contracts are checked separately.

## Dependencies and licenses

Runtime dependencies are pinned and self-hosted: MapLibre GL JS 5.6.2, PMTiles
4.3.0, Three.js r169 (with matching official OBJ/GLTF loaders), Turf 7.2.0,
Proj4js 2.12.1, GeoTIFF.js 2.1.3, shpjs 6.2.0, hyparquet 1.31.5 and fzstd 0.1.1.
Their license files are retained under `vendor/`. MapLibre’s previously verified
subresource integrity is retained. No package installation or CDN script is
required by the published site.

Library references: [Turf](https://turfjs.org/),
[Proj4js](https://proj4js.org/),
[GeoTIFF.js](https://github.com/geotiffjs/geotiff.js),
[shpjs](https://github.com/calvinmetcalf/shapefile-js),
[Three.js r169](https://github.com/mrdoob/three.js/tree/r169/examples/jsm/loaders).
Application MIT licensing does not replace dataset licensing. Each provider and
model retains its source attribution and component terms. US experimental LoD2
results remain experiments and are not a national production roof inventory.

The beginner flows were informed by the official [GeoLibre guide](https://geolibre.app/)
and [QGIS interface / print layout documentation](https://docs.qgis.org/3.40/en/docs/user_manual/print_composer/overview_composer.html).
The application remains centered on the published U.S. building data rather than
exposing every GIS operation on the starting map. Internal processing parameters
stay in source metadata and developer documentation.

### Interface languages and panel controls

The header language selector supports English (default) and Chinese (`zh-CN`).
The preference is browser-local and changing it does not reload the map or its
data. English remains the source language in HTML and JavaScript. Chinese copy
lives in `i18n-zh.js`; `i18n.js` binds only explicitly marked interface text,
accessibility labels, placeholders and system messages. Unknown copy falls back
to English. Dataset names, attributes, field keys, place names, model methods,
technical format/CRS names and exported source data stay as supplied.

Use `data-i18n` for direct, source-owned UI text, `data-i18n-system` for dynamic
system messages, and `data-i18n-title`, `data-i18n-aria-label` or
`data-i18n-placeholder` for interface attributes. Use `data-i18n-ignore` for raw
data subtrees. Never mark a container whose direct text comes from a dataset.
For a programmatically created button, set its binding attribute explicitly.
`tools/i18n-markup.py` can annotate static copy already present in the dictionary;
review its diff. It skips data cells and never processes `data/`, `vendor/`, or
export engines. Interpolated message values remain opaque. Additional locales
can register a dictionary and extend `PortalI18n.supported`'s source list and
the header options. The `portal-language-changed` event is available for UI
modules that need to react to a locale change.

`PortalSidebar` owns Layers/Models visibility and toolbar accessibility state.
Each toolbar button toggles its panel; switching panels keeps the sidebar open.
Opening the Models panel does not fetch a sample, move the camera, or reset the
selected model. Explicit research-sample links still load and locate the model.

Validation: `node tools/i18n-qa.cjs` plus the browser workflow
`tools/i18n-workflow-checks.cjs` through `tools/overnight-browser.cjs`.
Set `PORTAL_I18N_LIVE_URL` to run the same acceptance against a deployed site
without intercepting public network responses.

### Project workspace (1.5)

Open **Tools → Projects**, or click the project name in the desktop header.
Projects have independent UUIDs, creation dates and saved revision numbers.
Save stores the current document in this browser; Save a copy gives it a new
identity and records its source project/revision. The local library survives
page reloads. Ctrl/Cmd+S saves, Ctrl/Cmd+Shift+S saves a copy, and Ctrl/Cmd+O
opens the project manager. Unsaved changes are tracked for camera, layer order,
styles and names, CRS, drawings, model selection/placement and map layout.
Replacing changed work offers Save and continue, Discard changes, or Cancel.
Closing a changed workspace also requests the browser's unsaved-work warning.

Export for sharing downloads a portable `.usbf.json` snapshot. Opening that file
creates a separate unsaved local copy with a source-project reference; it never
overwrites another saved project. Files include local vector records, original
model/raster attachments, attribution, source rights, view and paper layout.
Catalog connections record available publication metadata and reconnect to the
latest publication rather than pinning historical server bytes. Exports with
unsaved edits have `projectInfo.draft: true`; a saved revision has `draft: false`.
Keep exported backups: clearing browser site storage or changing browser/device
can remove browser-local projects. Files are checked before replacing a map,
and failed staged restoration retains the prior resources. Existing version-1
map files without project identity or presentation fields remain supported.

Project metadata and document JSON are stored in separate IndexedDB stores in
`usbf-project-library-v1`. A single read/write transaction commits both stores,
checks the expected revision and increments it. Concurrent tabs cannot silently
overwrite a newer revision or delete a changed saved copy. BroadcastChannel
refreshes other tabs' library lists. Storage failures leave work open and permit
file export. `PortalProjectStore` is the persistence boundary for a future cloud
implementation; this release has no account system, remote project storage,
permission roles, public project URLs or simultaneous team editing. Sharing
currently means exchanging project files.

**Clear cache** is available in Tools and Projects. It cancels pending USBF
reads and clears decoded building neighborhoods and fetched model caches, while
keeping current displayed records, drawings, language preference and saved
projects. The next explicit original-data action can fetch fresh source bytes. It does not clear
the browser-managed HTTP cache, other applications' storage, or the project
database. **New project** starts an empty map with default view/CRS/layout,
releases old layers/models and invalidates in-flight work. It keeps the library
and asks about unsaved changes before replacing the open map.

Project workflow acceptance: `tools/projects-library-workflow-checks.cjs`.
Compatibility/rollback: `tools/project-workflow-checks.cjs`. Cache and schema
contracts: `tools/usbf-navigation-cache-qa.cjs` and `tools/project-qa.cjs`.

### Independent OpenStreetMap buildings

**Add Data → OSM → OpenStreetMap buildings · OpenFreeMap** adds a direct
OpenStreetMap building-layer connection using OpenFreeMap's OpenMapTiles vector
service. It is independent of both USBF and the filtered **VIDA US · OpenStreetMap
subset**, which remains available with its subset label. The OSM layer covers
the globe, including the US. Adding it from a national overview opens a DC
neighborhood; an existing neighborhood view stays in place. Native TileJSON
resolves the upstream versioned tile URLs. Saved projects reconnect the logical
OSM catalog source.

The display polygons may be clipped or simplified. They are not exhaustive
original OSM records. OpenMapTiles `render_height` / `render_min_height` are
cartographic values that can include estimates or defaults, so this connection
does not enable measured-height or LoD1 workflows from those fields. Original
values remain inspectable. Geometry analysis retains the existing tiled-preview
restrictions. The separate **OpenStreetMap · Original building data** resource
links to OpenStreetMap US Layercake; provider details also link to Geofabrik
regional extracts. No global GeoParquet file is automatically downloaded.

Attribution: OpenFreeMap © OpenMapTiles · Data from OpenStreetMap contributors;
OSM data terms are ODbL 1.0. Upstream documentation: https://openfreemap.org/quick_start/
and https://layercake.openstreetmap.us/layers/buildings/.

### Complete non-PMTiles view loading

Government footprint APIs load all pages for the requested neighborhood. DC
first obtains the matching `OBJECTID` list and requests bounded batches; an
ArcGIS transfer-limit response splits the batch until its IDs are complete.
NYC obtains a count and requests 1,000-row pages with stable `:id` ordering.
Returned IDs/row totals are checked, so short or repeated pages and HTTP failures
cannot mark a view complete. Completed batches appear progressively. Old geometry
stays visible during replacement, while analytical capture remains blocked until
the current request finishes. Moving away cancels obsolete requests.

GBA uses a persistent worker, explicit country/bbox statistics pruning and
progressive row-group reads instead of stopping at 12,000 buildings. Bounded HTTP
range caching survives camera changes and checks ETags before combining reads.
Complete views have a small buffered extent and a five-minute bounded cache;
zooming inside that extent reuses the completed data. Clear cache releases both
view and worker caches while keeping the current project.

API/GBA display reads stop at 50,000 records or 64 MiB per request. These limits,
timeouts and incomplete responses show **partial coverage** or an error, never a
complete-map claim. Zoom in for a smaller area when a limit is reached. The
Microsoft Esri vector connection uses its published final level, 16; MapLibre
overzooms those tiles at higher camera zooms instead of requesting nonexistent
levels 17–19. Native OSM TileJSON and USBF PMTiles keep their own tile caches.

Validation: `tools/viewport-source-qa.cjs`, `tools/gba-viewport-qa.cjs`, and
`tools/non-pmtiles-workflow-checks.cjs`. The real-provider browser workflow checks
DC IDs, NYC totals, GBA beyond the previous cutoff, cache reuse and Microsoft at
camera zooms 16–19.

### Layer purpose before file format

The layer list and Add Data cards show a persistent purpose badge alongside a
separate format label. **Map preview** means display fragments; original records
are required for counts, areas and spatial tools. **Analysis data** means the
loaded vector records are eligible for tools. **Partial analysis data** explicitly
limits results to the loaded subset. Loading/error states do not claim readiness.
Images retain their reference-only role. Formats and raw data values stay opaque
to interface translation.

`layer-purpose.js` reads the same `PortalAnalysisData.capabilities()` contract as
the analytical guards. A GeoJSON file exported from tiles remains a preview when
its provenance identifies display fragments. A cached USBF selection never turns
the PMTiles display into a complete analytical dataset. USBF offers **Load area &
analyze**, which now opens the shared **Data & scope** preparation panel; browsing and
showing labels do not fetch GeoParquet. Its analysis panel explicitly identifies
GeoParquet original records while the map continues to use PMTiles. External
preview-only sources lead to source details, verified provider links and Add Data.
Display URLs are labelled as display sources rather than original downloads.

Validation: `tools/layer-purpose-qa.cjs` and
`tools/layer-purpose-workflow-checks.cjs` cover original/partial/tiled inputs,
real synthetic PMTiles/Parquet parsing, explicit loading, Chinese and phone layout.

### Load original analysis layers and inspect attributes

Each preview layer offers **Load analyzable data**, opening **Data & scope**. USBF reads a saved study
area's original GeoParquet through its existing bounded reader and add a separate
GeoJSON analysis layer. Original geometry, attributes, licenses, file checksums,
requested area and partial-source provenance are retained. The new layer stays
fixed when the map moves and saves/restores as project data. It opens an attribute
table; the PMTiles preview remains a separate display connection. Loading can be
cancelled without adding a late layer.

The loading dialog also links to supported file/URL imports and the existing GBA,
DC and NYC original-data connections. Those alternatives are explicitly separate
datasets with their own coverage and licenses. Previews without a verified
original-data connection offer provider links and regional-file import rather
than pretending to convert display fragments back into original records.

Original vector layers expose **View attribute table** directly in Layers.
Opening it selects that layer and defaults to **All loaded records**, including
records outside the view or in a hidden layer. **Current map view** retains the
existing rendered-view behavior. All-loaded tables ignore map display filters;
their metadata and exports say so. Sorting, searching, selectable original fields,
exact row selection, CSV export and pagination work in either mode. Raw zero,
false, null, long identifiers and duplicate source IDs retain their values.

Loaded tables are bounded at 50,000 original rows; map-view tables retain their
20,000-row limit. Table limits and partial API/source scope remain distinct and
explicit. Neither table mode loads an entire remote dataset. Tile exports cannot
acquire the all-original-record scope. `analysis-layers.js` owns explicit loading;
`PortalInventory.openTable(layerID, {scope:'loaded'|'view'})` opens a specific
original vector layer without toggling an already open table closed.

Validation: `tools/analysis-layers-workflow-checks.cjs` and the inventory table
unit/browser acceptance cover true Parquet/PMTiles fixtures, independent area
layers, project restoration, hidden/offscreen rows, exports, cancellation and
Chinese/mobile controls.

### GIS workspace: ranges, bulk records and vector processing

The top ribbon separates **Data**, **Map**, **Selection**, **Processing**,
**Layers**, and **Project & output**. English remains the source interface;
Chinese translates controls and system messages while preserving dataset names,
original fields, values, formats and technical names.

**Data & scope** provides the shared saved-area selector (the processing dialog
uses the same geometry controls for a separate operation boundary): current map view; a U.S. state or county; bounding-box coordinates;
an input polygon or boundary GeoJSON; another layer's extent; a loaded polygon
mask; or the last map selection boundary. State/county names and full boundaries
come from the U.S. Census Bureau TIGERweb State_County service (state layer 0,
county layer 1). These requests use public read-only endpoints. Administrative
coverage does not imply that a building provider covers every state or territory.

Manual box/polygon coordinates use the current **working CRS**, shown beside the
inputs. A box's edges are densified before reprojection. Boundary-file coordinates
also use that chosen CRS: select EPSG:4326 for ordinary longitude/latitude GeoJSON.
Invalid/crossing small polygon boundaries are rejected. Extents of tiled previews
use the published extent, rather than a recently cached original-data neighborhood.
A polygon mask uses up to 100 loaded polygons, retaining its license and partial
scope. Requested boundaries, CRS, administrative GEOID, retrieval source and
original-data lineage survive output export and Project save/restore.

Explicit area reads support USBF originals, GBA GeoParquet, and the DC/NYC original
footprint APIs. They create an independent fixed GeoJSON analysis layer without
changing the preview connection. Intersecting grid cells are read serially;
empty cells are checked, cross-cell copies of source records are removed, and
source publication/file provenance is retained. A browser request is bounded at
20,000 output records, 500,000 vertices, 64 cells and a 96 MiB read budget (an
individual source read can finish beyond the remaining byte budget). Provider
limits/timeouts still apply. A state/county request that exceeds a budget is
explicitly **partial**; selecting a state never promises a full state download.
Use regional original files or future server-side jobs for larger complete jobs.
Boundary input is limited to 12 MiB and 150,000 vertices. Table display limits
remain independent of processing limits.

**Selection** works on original source records, including distinct records with
duplicate source IDs. Click, drag a box, draw a polygon, select by attribute, or
select by location. Choose replace/add/remove/common selection; Shift adds and
Ctrl/Cmd toggles click selection. Attribute-table Ctrl/Cmd-click toggles rows and
Shift-click selects a range in the currently filtered/sorted table. Select all,
invert, clear and zoom-to-selection are available. A tiled USBF selection now opens explicit study-area/workset preparation; it never
silently downloads originals. Tile fragments never become
analytical building records. Up to 20,000 original records can be selected.
Selections are per-layer session state; output layers and their provenance are
saved in Projects. Replacing a viewport's source data invalidates its old selection.

Selected records can open in a **selected-only attribute table**, export as CSV
or GeoJSON, or become an independent layer. The complementary unselected records
can also become a layer. Exports describe their actual bulk-selection/search
scope and retain original attributes. Existing table search, field visibility,
sorting and pagination remain available.

**Processing** operates on all loaded, selected, or range-filtered originals:

- **Extract by box / Extract by mask** keeps complete original geometries that
  touch the boundary. **Clip** trims outlines; **Erase** subtracts a polygon mask.
- **Merge** appends multiple layers, retains overlaps/duplicate records, and adds
  a collision-safe source-layer field. **Dissolve** unions polygons, optionally
  grouped by one original attribute, and records a source-record count.
- Buffer, area/boundary-length fields, center points, multipart-to-singlepart,
  and exact-geometry duplicate removal create new layers. Duplicate removal keeps
  the first geometry's attributes; it does not combine later attribute values.
- Geometry-changing results are marked derived and do not automatically reuse
  source building-height values for 3D. Whole-outline extraction preserves source
  building semantics and recorded height eligibility.

Spatial overlay/buffer tools retain the existing 1,500-feature safety limit and
per-geometry vertex limits; dissolve and erase also accept at most 1,500 records.
Mask intersection/extraction supports the broader original-record budget.
Processing is cancellable between work units. Inputs remain intact; each result
is a new layer. These are browser vector tools, not an unbounded desktop-GIS or
server processing service.

**Layers** provides zoom, rename, duplicate, reorder, extent-to-polygon and removal
of the most recent generated output. Independent image and local PMTiles copies require reopening
the original file. Projects retain generated layers, exact requested ranges,
working CRS, source rights, lineage and partial-coverage status.

Validation: `tools/gis-core-qa.cjs`, `tools/gis-workflow-checks.cjs`, and
`tools/gis-range-loading-checks.cjs` cover actual Turf/projection operations,
record-identity selection, map drag selection, full-outline extraction, merge,
selected exports and Project restore. Range checks exercise real Census and DC
endpoints as well as real synthetic PMTiles/GeoParquet decoding. Existing
analysis-layer/attribute-table workflows remain regression checks.


### Explicit data and scope contract (v1.8)

This workflow supersedes implicit current-view loading in the earlier analysis,
download and model dialogs. It separates four things that must not be conflated:

| Object | Meaning | Changes with map movement? |
|---|---|---|
| Display connection | PMTiles/MVT or a live API/GeoParquet display cache | Yes, the visible/cache extent can change |
| Saved study area | Named immutable boundary, working-input CRS and provenance | No |
| Fixed analysis workset | Actual loaded full-source/derived vector records and their loading boundary | No |
| Tool input snapshot | All, selected, or saved-area-filtered records from a chosen workset | No; a later selection/area change requires fresh preparation |

The persistent context bar and **Data & scope** panel show these objects
separately. Contents shows fixed record counts, original transport/file format,
loaded GeoJSON format, actual loading area and coverage. An imported GeoParquet,
Shapefile or CSV may be represented as GeoJSON in browser memory; these are two
format facts, not interchangeable capability claims. Tiles can contain
attributes, but tile attributes do not establish original-geometry fidelity or
unique-building completeness.

**Prepare data explicitly:** choose a source, preview/save a study area, then
load a fixed workset. Reuse the exact same saved polygon across USBF, GBA and
DC/NYC adapters. Supported boundaries include a sampled map view, official Census
state/county, typed bounding box/polygon in the working CRS, GeoJSON boundary,
layer extent, polygon mask, selected-record extent, and hand-drawn box/polygon.
Multiple saved areas are normal GeoJSON boundary layers with `workspaceArea`
provenance; they restore with Projects. No source connection or processing tool
silently substitutes a new camera extent for a saved boundary.

**Choose processing records explicitly:** statistics, charts, processing,
workset attribute-table subsets, LoD1 and Composer data exports all use
`PortalDataWorkspace.capture(layer, {mode, signal})`. The allowed modes are all
fixed workset records, the exact bulk selection, or full records intersecting the
active saved study area. Existing selections are offered as a visible default
with their actual count; an empty selection never falls back to all records.
Duplicate IDs remain separate source rows. Display visibility, styling and map
filters do not filter analytical input; choose the record subset explicitly.
The original-data loading path also ignores display-only source/minimum-area
filters while honoring an adapter's intrinsic dataset definition.

`provenance.inputContract` identifies the workset, original/loaded formats, input
mode, exact record count, selected original row indexes when applicable, loading
area, processing area and partial status. Snapshots deep-copy original values.
Outputs retain contracts in their lineage, and statistics/charts/data exports
retain them directly. Partial sources stay partial after selecting a smaller
subset. Imported files without a verified geographic-coverage claim are described
as loaded records, rather than claiming every building in their bounding box.
A completed request is explicitly distinguished from provider coverage.

The operation mask is a different parameter from the input record scope. For
example, **all 800 loaded records** can be the input to Clip against a saved
county; **20 selected records** can be buffered without loading anything else.
Extract keeps entire intersecting records, while Clip changes geometry. Sources
remain intact and every generated layer records its lineage.

**Compose a visual map separately:** choose the current visual frame, frame a
saved area, or frame a workset's extent. Map output draws visible display and
analysis layers; it does not fetch/select analytical records. Its metadata marks
this as a visual frame and retains layer format, role, scope and coverage. Data
export uses the fixed-workset input contract instead of visual map filters.

Loading retains the 20,000-record / 500,000-vertex / 64-cell / 96-MiB budgets;
spatial overlays typically allow 1,500 input records. A saved state boundary is
not a promise of a complete state dataset. Cancellation prevents a late workset
from being added. Large complete regional jobs still require regional original
files or a server-side processing service.

Design references: [QGIS Processing inputs and selections](https://documentation.qgis.org/3.44/en/docs/user_manual/processing/toolbox.html),
[ArcGIS processing extent](https://doc.esri.com/en/arcgis-pro/latest/tool-reference/environment-settings/output-extent.html).
The portal makes selections and counts explicit for users without GIS experience;
it does not copy desktop defaults that would hide which records are processed.

Current acceptance entry points are `tools/data-scope-qa.cjs`,
`tools/data-scope-workflow-checks.cjs`, `tools/data-scope-adapters-checks.cjs`, and
`tools/data-scope-public-checks.cjs`. Historical browser cases that expect
per-tool implicit current-view loading are superseded by these scope cases.
The GIS regression, raw geometry, attributes, projection, source quality and
Project unit checks remain applicable.

### Local workspace, files and cache (v1.9)

Open **Files & device** in the header (also available from Tools and Settings),
then choose a parent folder. In browsers supporting the File System Access API,
the explicit folder picker grants access to this folder only. The portal creates
these siblings without moving or deleting any existing files:

```text
Your chosen USBF workspace/
  Projects/  portable .usbf.json project files
  Results/   explicitly saved data and PNG exports
  Files/     copies of files you add through the file manager
  Cache/     optional managed analysis snapshots
  Engine/    isolated native runtime, identity and task history
```

**Project Save** retains the existing browser backup and, when a workspace is
connected, writes the same revision to `Projects/<project-id>.usbf.json`.
A failed disk write is reported separately from a successful browser backup.
**Save project file to folder** creates a separate snapshot without advancing the
browser revision. Existing project revision checks remain active; an unfamiliar
or newer disk file is never silently overwritten. Projects can be opened from
the file manager through the same validation and unsaved-change guard as imports.
Changing or disconnecting the parent folder leaves its files in place. Reconnect
is explicit if the browser no longer grants access.

The file manager lists names, types, sizes and modified dates, with breadcrumbs,
search and sorting. It supports creating folders, copying user-selected files,
downloading, renaming and confirmed individual-file deletion. Original input
files currently referenced by a layer/model must be detached before rename or
deletion. There is no recursive folder deletion. `Engine` is read-only, and the
managed cache directory uses its dedicated cleanup action. Adding a local data
file to the map still presents the import options for format and coordinate
system; it does not guess that every file is longitude/latitude GeoJSON.

**Storage & cache** distinguishes renderer/worker memory cache from disk cache.
Disk caching is opt-in and stores fixed analysis worksets as GeoJSON snapshots
under `Cache/browser-v1/`; it is not a general PMTiles, HTTP or GeoParquet cache.
The snapshot wrapper allows at most 64 MiB per file, with a 256 MiB aggregate
managed-cache budget. Ownership-authenticated metadata, sizes and modified dates
restrict cleanup to unchanged files created by this browser. Unrecognized or
externally modified files are preserved, along with Projects, Results and Files.
Losing browser storage can leave orphaned cache files that require manual review;
it never authorizes deleting an arbitrary Cache directory. Clearing memory cache
does not remove project backups or browser HTTP cache. Opening a cached snapshot
copies its source bytes into the loaded layer, so clearing disk cache cannot
break a later portable Project save.

**Save data to Results** uses the same explicit workset/scope contract as Download;
**Save PNG to Results** writes the current composed visual map. Both await the
actual file write before reporting success. Standard imports and downloads remain
available when direct directory access is unsupported (use desktop Chrome/Edge
for this workflow). The site cannot infer an absolute OS path or silently assign
a folder without the browser's user-initiated picker.

The device overview labels browser, native and cloud execution separately.
The native preview now provides a real independent DuckDB Spatial runtime,
paired loopback API, desktop installer and data-preserving uninstall. Available
packages and their SHA256 values come from `data/engine-releases.json`; no
unverified download links are invented. The desktop runtime keeps its own Python,
DuckDB, Spatial/GDAL and certificate store under `Engine`, without changing
existing GIS installations. Cloud hosting supplies source files; it does not
provide a cloud computation service.

Native tasks support scoped loading, extraction, merge, geodesic measurements and
projected metre buffers. Tasks record planned/actual counts, source identities,
failed parts and durable checkpoints. Cancellation, interrupted jobs and partial
results stay distinct from successful completion. The browser file manager keeps
`Cache/native-jobs` read-only so cache cleanup cannot destroy resumable work.
A bounded display preview is labelled separately from its full GeoParquet result;
native reprocessing uses the full file, and its paginated attribute table does
not require loading the whole result into the browser. See
[desktop setup](desktop-engine/README.md) and [API and limits](native-engine/README.md).

New Project v2 files distinguish pinned USBF releases from an explicit latest
policy and preserve verified native-file dependencies. Share creates readonly
interactive links or portable HTML using the online renderer. The reader runs in
an opaque sandbox, supports navigation/layers/attributes, and cannot access the
author's Project library, engine credentials or connected files. Native files
are represented by explicitly labelled bounded previews when shared. Cloud
accounts, simultaneous editing and offline renderer bundles remain outside this
release. See [implementation and acceptance](docs/engine-sharing-acceptance.md).

Validation: `tools/local-files-qa.cjs` covers permission, persistence, project
revisions, collisions, ownership and deletion boundaries. The browser workflow in
`tools/local-workspace-workflow-checks.cjs` exercises actual File System Access,
IndexedDB, project/result/cache writes and file-manager interactions. Automation
substitutes only the directory picker with an isolated browser-owned filesystem
directory; native OS picker dialogs and OS-specific permissions still require
manual acceptance. Interface translations remain separate from file names, data
values, fields and technical formats.

### Basemaps, interface layout and interactive map design (v1.10)

**Basemap** offers Light canvas, OpenStreetMap, Satellite imagery, Dark canvas,
USGS Topo, Terrain relief and Blank canvas. Blank starts with a white background
and makes no reference-tile requests; data layers remain available. Switching
basemaps changes only reference sources and preserves the MapLibre style,
analytical records, selection and local models.

**Custom web tiles** accepts a public HTTPS XYZ template with `{z}`, `{x}` and
`{y}`, tile size, zoom range, XYZ/TMS scheme, name and source attribution.
**Upload basemap** accepts a PNG, JPG or WebP image with an explicit EPSG:4326
rectangle, or a USBF XYZ configuration JSON. The current-view placement button
fills that rectangle; it stretches the image to the entered extent and does not
infer georeferencing. This basemap entry does not import general MapLibre vector
styles or GeoTIFF. Images are limited to 16 MiB, 8,192 pixels per edge and 24
megapixels, with an additional device texture-size check. Files stay in the
browser. A portable Project embeds the exact original image, bounds, attribution
and name, or the XYZ metadata. Custom basemaps reopen from Project files; a map
view link alone opens a blank background with an explanation.

The **Interface** toolbar group manages panel and map-tool visibility, the active
Layers/Models contents tab, contents width and comfortable/compact density.
Close controls hide panels without removing data, clearing selected records or
cancelling analysis. Contextual controls such as drawing or selection reappear
when they have content and are enabled. Focus on map keeps a route back through
Interface; Restore default layout restores the standard workspace. Source
attribution remains available. Preferences are remembered locally and included
in Project presentation metadata; old Projects remain readable.

**Create map** opens a modeless map designer alongside the actual MapLibre map.
Pan, zoom and layer editing remain available. A lightweight live paper guide
responds to layout and view changes; it does not create another map or download
analytical data. The final PNG preview remains an explicit capture and is marked
stale when inputs change. PNG/PDF export regenerates the actual map using the
current settings, source attribution and existing frame/partial-coverage rules.
The data-download tab retains its explicit workset and record-scope contract.
This is an interactive authoring workspace; exported PNG/PDF files remain static.

Portable design checks are in `tools/design-project-qa.cjs`; browser integration
is covered by `tools/design-workflow-checks.cjs` and the basemap, interface and
composer checks. They exercise real MapLibre source changes, original image
bytes, Project restoration and panel interactions, including phone layouts.
