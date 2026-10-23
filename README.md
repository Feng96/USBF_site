# US Buildings — Open GIS workspace

A static MapLibre workspace for public building data and local GeoJSON.
**Add Data** is the first toolbar action. The source manager offers a catalog,
a public URL connection and a local-file picker. Added layers have visibility,
opacity, extent, source details and removal controls.

## Connected catalog

| Layer | Endpoint | Vector source layer |
|---|---|---|
| VIDA Buildings — US | `https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/by_country/country_iso=USA/USA.pmtiles` | `USA` |
| VIDA Buildings — global | `https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles` | `goog_msft_osm_building_footprints` |
| USGS Orthoimagery | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}` | Raster tiles |

VIDA combines Google, Microsoft and OpenStreetMap footprints. These are **not
three independent original datasets**. The repository offers a global single
layer, a global archive with country layers, and individual country archives.
The alternative global archive is `pmtiles/goog_msft_osm_country_layers.pmtiles`,
with country codes such as `USA` as source-layer names. When using that archive
through From URL, enter the desired country layer explicitly.

PMTiles is read by HTTP byte ranges; the app does not download the entire
archive. Header and metadata probes verified the US layer (zoom 0–14), the
global layer (zoom 0–15), and cross-origin range support on October 23, 2026.
The US and global products overlap; they are alternatives, not independent
observations. Coverage and source composition vary geographically. Inspect
`bf_source` for the supplied feature provenance. Missing attributes stay missing.

USGS imagery includes NAIP and other sources; acquisition dates and coverage
vary. It is reference imagery, not automatically contemporaneous roof truth.

- [VIDA dataset, methodology and ODbL license](https://source.coop/vida/google-microsoft-osm-open-buildings)
- [USGS service details and attribution](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer)

## Add your own data

- **PMTiles URL:** HTTPS vector archive. The source layer is detected for a
  single-layer archive; specify a layer name for multi-layer archives.
- **GeoJSON URL or local file:** WGS84 longitude/latitude, maximum 20 MB,
  50,000 features and one million coordinate positions. Polygon, line, point,
  multi-geometries and geometry collections are supported. Local files are
  processed in the browser and are never uploaded.
- **XYZ raster URL:** public HTTPS template containing `{z}`, `{x}`, `{y}`.
  Servers must allow browser cross-origin requests; PMTiles also needs ranges.

Click an added feature to inspect source attributes. Local/remote GeoJSON can
be exported unchanged. Display tiles can be clipped or generalized, so full
building geometries should be downloaded from the original source.

Share URLs preserve catalog layers, visibility and opacity alongside camera
and basemap state. Custom URLs and local files are intentionally not embedded
in share URLs; reconnect them after refresh. This avoids sharing private or
signed URLs inadvertently. No authentication or backend is configured.

## Existing research and demonstrations

The original synthetic layers remain available in collapsed **Demo layers**
groups, initially off. Adding real data switches demo overlays off. Synthetic
heights remain a LoD1 extrusion demonstration, not actual roof LoD2.
USBF production data and LoD2 roof models are not yet connected to this map;
the catalog retains a link to the existing LoD2 research viewer. The separate
`data-adapter.js` remains the synthetic provider only.

The attribute table is explicitly the **Demo footprints** table. Added-data
attributes are available by clicking individual features. Height, identity
and geometry fields are never fabricated for external data.

## Development and verification

Run `python3 -m http.server 8080` and open the local URL. No build is required.
GitHub Pages serves `main` at the repository root with `.nojekyll`.

- `tools/browser-qa.cjs`: regression checks for the original map interactions.
- `tools/data-qa.cjs`: real PMTiles/imagery loading, source inspection, sharing,
  local import/export, errors, layer controls and desktop/mobile checks.

Set `PLAYWRIGHT_PATH` to an existing playwright-core runtime and
`PORTAL_QA_OUTPUT` to bulk storage. Set `PORTAL_LIVE_URL` to test a deployment.

## Libraries, design references and licenses

MapLibre GL JS 5.6.2 is pinned with subresource integrity. The PMTiles 4.3.0
browser bundle is vendored with its BSD-3-Clause license in `vendor/`.
Application code and synthetic examples remain MIT licensed. This does not
license external datasets; their providers retain their respective terms.

The data manager follows the familiar catalog / URL / file entry pattern:
[QGIS Data Source Manager](https://docs.qgis.org/3.44/en/docs/user_manual/managing_data_source/opening_data.html)
and [ArcGIS Map Viewer layers](https://doc.arcgis.com/en/arcgis-online/create-maps/add-layers-mv.htm).
PMTiles integration follows the [official MapLibre guide](https://docs.protomaps.com/pmtiles/maplibre).
