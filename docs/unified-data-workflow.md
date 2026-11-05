# Unified objects and original-data connections

Layers from the catalog, imported files, browser analyses and native results share
one layer manager. A source adapter supplies data and capabilities; it does not
create its own layer menu, selection model, analytical scope or export workflow.

`PortalLayerActions` defines each common operation once. The layer row, active
layer ribbon and scoped workspace use that definition and an explicit layer ID.
Unavailable operations retain a reason. Table, processing and export dispatch to
the appropriate browser/native implementation without treating display samples
as original analytical records. Shared-map restrictions apply before execution.
Study areas, Projects, tasks, files and models retain their respective managers;
they are not reclassified as buildings merely because they appear on the map.

## One source contract

`PortalDataSources` describes browser/native original-data access independently
from the display renderer. Capability detection uses the actual paired engine's
`originalDataProviders` list. An older engine receives update guidance; source
availability is not inferred from a file extension or the presence of tile fields.

| Dataset | Fast display | Saved-area original loading |
| --- | --- | --- |
| USBF | Existing versioned PMTiles | Existing browser and native verified publication readers |
| OpenStreetMap | Existing OpenFreeMap vector tiles | Native Layercake GeoParquet with original published columns |
| Overture | Existing release PMTiles | Native GeoParquet resolved from STAC for that exact display release |
| GBA USA | Existing neighborhood GeoParquet display | Existing bounded browser reader and new native USA source reader |
| DC and NYC | Existing official neighborhood APIs | Existing bounded browser reader and new ID-verified native readers |
| Microsoft / Esri and VIDA | Existing display tiles | No new automatic original-data adapter in this release; provider links and original-file import remain available |

Every source uses **saved study area → execution location → task plan → fixed
original workset → all / selected / saved-area records → table / analysis / export**.
Large original sources do not pass through a bounded browser preview first.
OSM and Overture original loading requires the desktop engine. Browser budgets
continue to apply to the existing bounded readers.

The native request is declarative:

```json
{
  "schema": 1,
  "operation": "load",
  "inputs": [{"kind": "provider", "providerId": "overture-buildings", "releaseId": "2026-10-21.0"}],
  "scope": {"crs": "EPSG:4326", "geometry": {"type": "Polygon", "coordinates": [[[-77.041, 38.897], [-77.039, 38.897], [-77.039, 38.899], [-77.041, 38.899], [-77.041, 38.897]]]}, "label": "Saved area"}
}
```

The scope is an explicitly saved WGS84 polygon. Browser requests
cannot supply SQL, arbitrary provider endpoints or machine paths. Normal paired
Origin, Host, token and read-only restrictions apply. All provider results enter
the same checkpoints, exact whole-geometry intersection, Results, full tables,
native selection, processing, Project dependencies and exports as local files.

## Identity, completeness and transport

Checked HTTPS ranges require exact `206` / `Content-Range` and stable size plus
HTTP validators. A server returning the whole file instead of the requested
range is refused. PyArrow retains original column schemas and GeoParquet metadata
while materializing candidate row groups. DuckDB performs the final exact saved
polygon intersection. Missing bbox statistics retain candidates; outward float32
padding protects touching geometries from quantized bbox values.

OSM latest, the GBA mirror and official APIs remain mutable sources. Task receipts
record the observed validators, release/revision information and actual transport.
The complete generated result has its own SHA256. A source request completing
does not establish real-world building completeness. Official APIs verify the
planned record IDs and exposed revision information, but do not claim transactional
snapshot isolation. GBA inspects all published USA candidate file footers rather
than excluding crossing buildings with nominal tile bounds.

Downloads, range reads and Arrow decoding run locally. DuckDB's memory target
governs its SQL execution; total process memory also includes source decoding.
Source row counts/download sizes that are unknown remain unknown in task plans.

## Same-area comparison

Compare sources uses two original polygon worksets and one saved study area.
Saved-area mode retains whole intersecting records. All/selected modes require
both inputs to refer to that same saved loading boundary. Native summaries query
the complete indexed file or an immutable selection, never the saved preview.

`POST /v1/jobs/{id}/comparison-summary` accepts `{selectionId?,heightField?}`;
availability is advertised as `resultComparisonSummary`. The summary reports
record counts, valid whole-polygon area and positive finite supplied height
availability. Rendering defaults and floor-based estimates are excluded. Native
area uses the WGS84 ellipsoid and browser area uses Turf's spherical method; mixed
method differences are labelled approximate. Overlapping records count separately.
The downloadable JSON receipt records data identity, scope, methods and coverage.
Aggregate agreement does not establish one-to-one building matches, independent
validation or source accuracy.

## Packaging and interface

The isolated desktop environment adds PyArrow and timezone support; it continues
to preserve the user's installed Python/GDAL/DuckDB environments. The new shared
provider capabilities require the updated native preview installer. English
remains primary. Chinese translates controls and system messages while source
names, fields, identifiers, geometry and raw attribute values remain unchanged.
