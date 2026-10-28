# US Buildings

[Open the workspace](https://feng96.github.io/USBF_site/).

A map for the published USBF U.S. building inventory, comparison datasets and
research roof models. Search a place, inspect buildings, summarize an area and
save a map or data. Advanced controls stay in the tools and layer menus.

## Workspace 1.3

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
| Live USBF / GBA / government batch | Current neighborhood | Frozen actual loaded records, with bounds, timestamp, release, filters and any limit preserved |
| PMTiles / MVT | Fast, clipped/simplified tiles | Explicit field preview only; fragment observations are not unique building totals; geometry analysis and original-data exports are blocked |
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

A future USBF PMTiles publication can use this display path while the existing
GeoParquet reader supplies bounded analytical batches. Source version, stable
record identifiers, query scope and data licenses must remain associated; a
rendered tile alone is never an analytical original.

## Working with data

1. Choose **Add data** → Catalog, From URL or Local File. Declare the source CRS
   when the file does not embed it. CSV requires valid x/y columns; images need
   bounds or a world file. ZIPs need matching `.prj` files or a declared CRS.
2. Select a layer and open **Tools → Statistics**. The current area is summarized
   automatically. Choose the full loaded layer or one selected feature when
   needed. Change the area or source, then **Refresh data** for new statistics.
3. For a clip or zone summary, use the current map area or add/draw a complete
   polygon layer as a study area. The chosen source is frozen when each operation
   starts. Overlapping
   clip masks are unioned; intersection overlays and zone summaries explicitly
   describe how overlapping zones contribute.
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

## Live USBF and automatic updates (0.6)

The dataset entry is [opengeos/us-buildings](https://source.coop/opengeos/us-buildings).
The reader follows the stable `USBF_v1/manifest.json` URL at Source Cooperative;
no publication manifest or tile list is copied into this repository.

- Opening USBF fetches the current manifest with browser caching disabled and a
  fresh check URL. The manifest's tile bounds, filenames, sizes, checksums,
  publication date and counts drive the viewer.
- A visible layer in a visible browser tab checks every five minutes. Returning
  to a foreground tab checks again if the last check was over 30 seconds ago.
  Hidden layers and background tabs pause automatic checks.
- **Check updates** checks immediately and reloads the current neighborhood.
  A changed manifest automatically refreshes the view and coverage grid while
  retaining the camera, layer styles and opacity.
- Data URLs include each tile's current SHA256 as a cache version. File-length
  and exposed ETag changes during a range read reject mixed publication bytes.
  SHA256 is a cache version, not a whole-file integrity verification: the viewer
  reads only selected byte ranges.
- A failed update check retains the last successfully loaded view, displays its
  original publication date and shows an explicit warning. It does not label
  old data as the new release.

Shared USBF links follow the current publication; they do not freeze a data
snapshot. Record the publication date and selected tile checksums for citations.

Future data updates need **no website push** when publication keeps the same
manifest URL and layout. Publish accepted tile files first, update each file's
size/checksum and the inventory counts, and publish the manifest last. New tile
names are discovered automatically. A different endpoint or incompatible schema
needs a viewer adapter change. The viewer does not alter the publication
pipeline, running production, source objects or scientific outputs.

At national zoom the map shows a labelled **publication grid**, not building
polygons or proof of completed refinement. At zoom 14+ it loads buildings whose
published `cx`/`cy` ownership coordinates lie in the map extent plus a 0.002-degree
buffer. Full polygons are retained; this is an ownership-view selection, not an
exhaustive intersection query for very large buildings centered outside that
buffer. Actual per-file bounds select candidate files, including grid-edge
footprints. Requests are capped at nine files, 32 MiB of ranges and 12,000
features; zoom in if a view exceeds those limits.

The worker reads the core identity, source, state, inherited height, edit,
coverage, snapshot and component-license fields. It does not download the large
`original_geometry` column or all production diagnostic columns on every pan;
the full published schema and source downloads remain linked. Table records,
identification and exports recover full loaded source features by `usbf_id`,
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
- `usbf-source.js` / `usbf-worker.js`: live publication and bounded source reads.

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
