# US Buildings — inventory and roof-model workspace

[Open the website](https://feng96.github.io/USBF_site/).

VIDA is the current working footprint provider while the USBF integration is
prepared. Names, provenance and licenses remain VIDA's. The same layer,
attribute and height interfaces are designed to accept the future USBF release.
US LoD2 results remain experimental. The site does not reconstruct new roofs.

## What changed in 0.5

- Searchable catalog with independent Microsoft tiles, US GBA footprints/heights,
  official DC and NYC APIs, pinned Overture tiles, and VIDA provenance subsets.
- Bounded, cancellable neighborhood queries; source versions, height units and
  download-only resources are stated explicitly.

## Inventory and models (0.4)

- A national entry map with VIDA loaded by default and Add Data first.
- The attribute table follows the active real dataset, with pagination, search,
  sorting, map selection/highlighting, source filters and CSV/GeoJSON exports.
- Counts describe visible loaded records, not nationwide building totals.
- Provenance coloring, minimum-area filtering and shareable catalog styles.
- LoD1 extrusions use supplied metre heights only. Missing heights retain their
  2D footprint. VIDA has no building-height field in these archives.
- Integrated model controls on the main map: eight existing US experiment cases
  with three methods each, and twenty actual 3DBAG training-roof references.
- Method, edge/roof display, model selection and camera restore from shared URLs.
  Models can be downloaded as local-coordinate OBJ or provenance-bearing JSON.
- An additional catalog layer links the twenty training-reference footprints
  and model-derived heights to their corresponding roof models.
- Indexed city, longitude/latitude and sample-ID navigation. This is not an
  address geocoder. Custom GeoJSON and PMTiles/XYZ URL connections remain.

## Data catalog (0.5)

| Provider | Coverage / role | Source |
|---|---|---|
| VIDA US | Combined footprints, with separate Microsoft / OSM subset entries | Source Cooperative PMTiles; provenance filters do not recreate the complete original sources |
| Microsoft US | Independent Microsoft / Esri legacy tiles | 125M snapshot; geometry-focused tiles with limited attributes, separate HDX mirror linked for newer files |
| GlobalBuildingAtlas US | US footprints, source codes, estimated heights and variance | Taylor Geospatial / Source Cooperative GeoParquet mirror, September 2025; current neighborhood queried directly in a worker |
| Overture Buildings | Global merged inventory including US | Official `2026-10-21.0` PMTiles, pinned release |
| DC government | Official OCTO footprints and capture metadata | DC GIS ArcGIS API, current view, maximum 2,000 returned features |
| NYC government | Official OTI footprints and roof heights above ground | NYC Open Data API, current view, maximum 5,000 returned features |
| VIDA global | Optional global footprint comparison | Source Cooperative PMTiles |
| USGS Orthoimagery | Reference imagery | The National Map XYZ tiles |
| 3DBAG samples | Twenty Dutch training-reference footprints and heights | Bundled frozen sample manifest, separate from US coverage |

VIDA combines Google, Microsoft and OSM footprints; the US/global archives are
alternative organizations of that merged product, not independent originals.
PMTiles uses HTTP range requests instead of downloading the full archive.
Provider coverage, source composition, resolution and observation dates vary.

Tiled features may be simplified or clipped. View exports are labelled
`visible-tile-fragments`, not complete source-building exports. The original
source download remains available. GeoJSON imports preserve source geometry,
properties and nulls; no height is assigned to a missing value.

### Source identity and bounded requests

The catalog contains eleven working map entries and two download resources. Its
search finds names, coverage, descriptions and source groups. Microsoft / OSM
subsets always retain their fixed VIDA provenance filter, including after share
restoration. They remain merged-release subsets. The independent Microsoft tile
layer is the older Esri snapshot linked by Microsoft's US repository; it does
not claim to show the latest GlobalMLBuildingFootprints release. The newer HDX
GeoParquet mirror is a download resource, not an implemented streaming source.

GBA and official APIs query at zoom 14+ and require a neighborhood-sized view.
On pan, hide, removal or a new request, previous work is cancelled. Previous
view data is cleared so exports do not include an obsolete request. Counts and
exports describe the loaded view, not the national inventory. Requests which hit
a feature cap are marked and users can zoom in. No backend or API key is needed.

GBA uses the 189-file geographic index in `data/sources/gba-usa-index.json`.
The worker reads only HTTP byte ranges, prunes row groups/pages using the
supplied bbox statistics, and filters `region = USA`. Each request is limited
to four files, 32 MiB of ranges and 12,000 displayed features. The 5-degree file
names may include neighboring countries; the per-record region filter is
required. The source geometry is decoded as WGS84 from the actual GeoParquet
metadata. Original `height`, `var`, `source`, `id` and `region` are preserved;
`height_m` accepts only positive supplied heights. No WFS service or whole-file
download is used.

NYC `height_roof` is the roof height **above ground**, in feet; `height_m` is
its positive value multiplied by 0.3048. Zero/null heights remain missing.
`shape_area` is retained as an original field, and is not converted to a claimed
ground area: current OTI documentation explicitly says not to use that generated
area field. DC footprints have no height attribute.

FEMA/ORNL USA Structures remains a clearly marked download resource. The official
catalog is available, but the public feature service returned an ArcGIS query
error during verification. It is not presented as a working map connection.

Source documentation:

- [Independent Microsoft US / Esri tiles](https://github.com/microsoft/USBuildingFootprints)
- [HDX Microsoft mirror](https://source.coop/hdx/microsoft-open-buildings)
- [Taylor Geospatial GBA mirror](https://source.coop/tge-labs/globalbuildingatlas-lod1)
- [Current GBA release and component licenses](https://github.com/zhu-xlab/GlobalBuildingAtlas)
- [NYC OTI field definitions](https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BuildingFootprints.md)
- [FEMA official catalog](https://gis-fema.hub.arcgis.com/pages/usa-structures)

GBA is a September 2025 merged mirror, preceding the current component split.
The original release terms include CC BY-NC 4.0 for LoD1/heights and ODbL source
components. The website does not relabel these data as CC BY or as USBF.

## Model collections

The eight US cases are the existing guarded-input paired experiment in
Georgetown, DC. Initial reconstruction, image-line adaptation and DL-assisted
local candidates retain their original geometry, methods and diagnostic
outcomes, including failed checks. An edge check does not certify roof accuracy.
No one-to-one match to a VIDA tile building is asserted.

The twenty Dutch examples are selected from the actual frozen training roster:
two examples per each of ten source cities. They preserve training mesh hashes,
source response hashes and roster membership. The training assets contain
**roof surfaces only**, not closed buildings. They are automatic 3DBAG teacher
geometry, not independent measured ground truth or US production models.
Their optional LoD1 layer uses maximum source roof Z minus recorded ground;
this derived height basis is retained in attributes.

Read [sample metadata and attribution](data/models/README.md). Each sample is
loaded on demand and SHA-256 checked. The whole display collection is under
1 MB of JSON. No raw experiment trees, weights or production outputs are copied.

[Original US experiment](https://feng96.github.io/research-daily/lod2/paper/) ·
[3DBAG terms](https://docs.3dbag.nl/en/copyright/) ·
[VIDA source / ODbL](https://source.coop/vida/google-microsoft-osm-open-buildings)

## Import and sharing

- Vector PMTiles: a direct public HTTPS file with range and CORS support.
  Multi-layer archives need a source-layer name.
- GeoJSON: WGS84 longitude/latitude, up to 20 MB, 50,000 features and one million
  coordinate positions. Files stay in the browser and are not uploaded.
- Raster XYZ: public HTTPS templates containing `{z}`, `{x}`, `{y}`.

Share links retain catalog layers, visibility, opacity, source/area/color
settings, camera and model selection. Custom URLs and local imports are
session-only and must be reopened; signed/private URLs are not embedded.
Optional synthetic UI examples remain explicitly labelled and initially off.

## Implementation and acceptance

No build is required: `python3 -m http.server 8080`. GitHub Pages serves `main`
at the repository root. `?empty=1` starts an empty workspace for import testing.

- `data-manager.js`: sources, real layer state, filtering and height rendering.
- `public-sources.js`: provider catalog, bounded API queries and cancellation.
- `gba-worker.js`: spatially filtered GeoParquet range reads off the UI thread.
- `inventory.js`: active-layer records, table, exports and indexed navigation.
- `model-browser.js`: Three.js custom map layer and on-demand model selection.
- `tools/export-model-samples.py`: read-only exporter for frozen research assets.
- `tools/catalog-qa.cjs`, `tools/inventory-models-qa.cjs` / `tools/browser-qa.cjs`: full acceptance.
- `tools/data-qa.cjs`: connection, validation and import/export regression.

Browser QA uses an existing Playwright runtime via `PLAYWRIGHT_PATH` and writes
screenshots/reports to `PORTAL_QA_OUTPUT` on bulk storage. Set `PORTAL_LIVE_URL`
for published-site acceptance. Rendering, dataset identity, source filters,
all 44 model/method views, sample association, OBJ/CSV export, sharing and mobile
layout are checked with real browser execution.

MapLibre GL JS 5.6.2 is pinned with subresource integrity. Vendored PMTiles 4.3.0, Three.js, hyparquet 1.31.5 (MIT) and fzstd 0.1.1 (MIT) retain their licenses. Application MIT licensing does not replace
external dataset licensing. Source imagery/model terms and attribution remain
with their providers.
