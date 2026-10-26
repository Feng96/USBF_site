# US Buildings — inventory and roof-model workspace

[Open the website](https://feng96.github.io/USBF_site/).

VIDA is the current working footprint provider while the USBF integration is
prepared. Names, provenance and licenses remain VIDA's. The same layer,
attribute and height interfaces are designed to accept the future USBF release.
US LoD2 results remain experimental. The site does not reconstruct new roofs.

## What changed in 0.4

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

## Data catalog

| Provider | Coverage / role | Source |
|---|---|---|
| VIDA US | Working US footprints | `https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/by_country/country_iso=USA/USA.pmtiles`, vector layer `USA` |
| VIDA global | Optional global footprint comparison | `https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles`, vector layer `goog_msft_osm_building_footprints` |
| USGS imagery | Reference orthoimagery, largely NAIP in CONUS | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}` |
| 3DBAG training subset | Twenty Dutch reference footprints and derived roof-above-ground heights | Bundled frozen sample manifest; CC BY 4.0 |

VIDA combines Google, Microsoft and OSM footprints; the US/global archives are
alternative organizations of that merged product, not independent originals.
PMTiles uses HTTP range requests instead of downloading the full archive.
Provider coverage, source composition, resolution and observation dates vary.

Tiled features may be simplified or clipped. View exports are labelled
`visible-tile-fragments`, not complete source-building exports. The original
source download remains available. GeoJSON imports preserve source geometry,
properties and nulls; no height is assigned to a missing value.

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
- `inventory.js`: active-layer records, table, exports and indexed navigation.
- `model-browser.js`: Three.js custom map layer and on-demand model selection.
- `tools/export-model-samples.py`: read-only exporter for frozen research assets.
- `tools/inventory-models-qa.cjs` / `tools/browser-qa.cjs`: full acceptance.
- `tools/data-qa.cjs`: connection, validation and import/export regression.

Browser QA uses an existing Playwright runtime via `PLAYWRIGHT_PATH` and writes
screenshots/reports to `PORTAL_QA_OUTPUT` on bulk storage. Set `PORTAL_LIVE_URL`
for published-site acceptance. Rendering, dataset identity, source filters,
all 44 model/method views, sample association, OBJ/CSV export, sharing and mobile
layout are checked with real browser execution.

MapLibre GL JS 5.6.2 is pinned with subresource integrity. Vendored PMTiles 4.3.0
and Three.js retain their licenses. Application MIT licensing does not replace
external dataset licensing. Source imagery/model terms and attribution remain
with their providers.
