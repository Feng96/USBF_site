# US Buildings — Open GIS workspace

A buildless, MapLibre GL JS GIS-style interface template for Yinan Feng’s USBF footprints,
building heights and LoD2 research. Version 0.1 contains **synthetic demo data
only**. It has no live building API, backend, upload endpoint or credentials.

## Run locally

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`. Deployment works at a GitHub Pages repository
root or under a subdirectory; all local asset paths are relative.

## What works

- Reference basemaps: Esri Light Gray Canvas, OpenStreetMap and Esri World Imagery.
- Four layer controls, footprint opacity and illustrative height coloring.
- Actual 2D / 3D switching with synthetic height extrusion (LoD1), pitch and rotation.
- Click-to-inspect feature details; synchronized attribute table and selection.
- Distance measurement, full extent, bookmarks and local demonstration search.
- GeoJSON export: selected feature, or all 240 generated features.
- Share URLs preserving view, basemap, layer visibility, opacity and selection.
- Responsive mobile layer drawer; keyboard controls and reduced-motion support.

The 3D control extrudes generated heights; it does not reconstruct roof LoD2.
The catalog links to existing LoD2 research. Demonstration shapes deliberately
do not claim to align with actual buildings. Reference basemaps need internet.
MapLibre GL JS 5.6.2 loads from unpkg with pinned URLs and SHA-384 subresource
integrity checks. No Mapbox token is needed. Rendering requires WebGL support;
the interface shows a readable error if the library or WebGL is unavailable.

## Phase 2: actual data

`data-adapter.js` is the current data-provider boundary. Replace its generated
FeatureCollection with accepted, **published** release-backed sources. Large
footprint visualization should use tiled data rather than loading a national
GeoJSON file. Add a separate tile/feature provider as part of that change.

The planned `connections.footprints`, `connections.heights`, and
`connections.lod2` values are `null`: they are not live or simulated endpoints.

Preserve stable identifiers, original/final geometry, source attributes,
missing values, product/version coverage, and component-specific licenses.
The legacy state-file schema and new component shards require explicit
normalization. Do not assume the LoD2 research identifiers already have a
verified one-to-one USBF mapping. Height extrusion is LoD1, not roof LoD2.
Neither modification flags nor closed meshes establish accuracy.

No running job, private transcript, source dataset, model weight, production
manifest, local filesystem path, or temporary credential is included here.

## GitHub Pages

Publish the files at the chosen repository root, then use Settings → Pages →
Deploy from a branch → `main` → `/(root)`. `.nojekyll` keeps this a plain static
site. No npm install, build job or GitHub Actions workflow is required.

## Attribution and licensing

Application source is MIT licensed; see `LICENSE`. Synthetic GeoJSON exports
are provided under the same license and are explicitly marked synthetic.
MapLibre GL JS is BSD-3-Clause licensed; its distributed library retains the
upstream license notice: https://github.com/maplibre/maplibre-gl-js/blob/v5.6.2/LICENSE.txt.
Reference map and imagery rights remain with their respective providers;
attributions are visible on the map. This template’s license does not assign
a license to any future USBF, height or LoD2 dataset.

The optional browser QA script is in `tools/browser-qa.cjs`. It uses an existing
Playwright runtime supplied through `PLAYWRIGHT_PATH`; no install is required.
Set `PORTAL_QA_OUTPUT` to a directory outside HOME for screenshots and reports.
