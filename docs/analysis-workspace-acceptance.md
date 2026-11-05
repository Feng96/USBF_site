# Analysis workspace 1.14 / native engine 0.4 preview

## Data identity and cache

Original-source metadata/footer and selected-row-group materializations use the
existing managed `Cache/native-sources-v1` store. Identity includes URL, strong
ETag or Last-Modified plus object size, and publication release where supplied.
Every mutable object receives a new range validation for each request. Cached
materializations are SHA256 checked before reuse. Source changes invalidate
reuse; missing validators are not guessed. Footer planning uses six bounded
workers. Source geometry intersection and attribute types remain unchanged.

Measured request: a 25-record saved-area extraction on this machine. Output
Arrow values and types match the trusted uncached result exactly.

| Provider | Previous cold | Updated cold | Updated warm | Warm HTTP payload |
|---|---:|---:|---:|---:|
| OSM Layercake | 45.2 s | 45.2 s | 1.6 s | 16 bytes, 2 validation requests |
| GBA USA | 296.9 s | 71.5 s | 38.4 s | 1,512 bytes, all 189 source identities checked |

Cold OSM transferred 35,052,670 bytes; cold GBA transferred 43,499,542 bytes.
Cache does not remove first-download cost or prove real-world coverage. GBA warm
latency includes validation of every source file. Files & device exposes cache
metadata/materialization bytes and hits through the shared maintenance manager.

## Complete native charts

`resultCharts:true` advertises `POST /v1/jobs/{id}/chart` for `schema`,
`histogram`, `category` and `grouped`. Chart requests bind the complete original
result SHA and optional immutable `selectionId`. Saved areas create the same
native selections used by other GIS operations. Geometry measurements use the
existing WGS84 spheroidal methods; originals retain their schema and values.
Only bounded aggregate rows reach the browser. Numerical aggregates use double
precision; null, invalid and optionally excluded nonpositive counts are explicit.
Category counts retain null, empty string, zero, false and exact identifiers.
The bounded Other group recomputes statistics from its actual input records.

`POST /v1/jobs/{id}/chart-cancel` targets a UUID for exactly one job/request;
it cannot interrupt unrelated tasks. Scatter plots require a browser workset.
The existing Charts UI, scope picker and SVG/CSV/PNG exporters are shared.

## Building correspondence

`resultMatching:true` advertises `POST /v1/matches`. Both original sources and
optional immutable selections are SHA bound to a common saved study area.
Known compatible provenance IDs take priority; unrelated generic IDs cannot
force a pair. Actual Layercake OSM type/id and versioned Overture OSM references
are recognized without changing their raw values. Spatial candidates use
EPSG:6933 equal-area intersections. Default acceptance is IoU >= 0.5 OR either
source coverage >= 0.8. Touching outlines alone do not imply a match.

The connected correspondence graph preserves one-to-one, one-to-many,
many-to-one, ambiguous, unmatched-left/right and invalid-left/right cases.
No greedy one-to-one assignment or accuracy claim is made. A two-million
candidate budget asks the user to reduce the study area instead of silently
sampling. Matching uses existing native task history, cancellation and resume.
Publication never replaces an unfamiliar report; crash recovery requires a
complete receipt with the same request/sources and verified report SHA/count.

`POST /v1/jobs/{id}/matches` pages the durable report; `match-selection` creates
ordinary immutable source selections. `GET .../match-export?format=csv|json`
exports full pair references. Original attributes remain accessible through
the common source attribute table/export, and category layers use the same
ordinary native layer pipeline. Browser originals stage through the existing
native import with an explicit 15 MiB limit. Report pages are capped at 16 MiB.

## Interface and verification

Seven dropdown groups preserve all 65 original action selectors and the shared
layer operation registry. Keyboard navigation, one-open-menu behavior, Escape,
outside click and focus restoration are verified. Desktop, tablet, phone and
200% reflow were checked in English and Chinese. Interface/system text is
translated; source names, fields, identifiers, category values and GIS formats
remain original.

Acceptance includes real native chart fidelity/cancellation/auth tests,
matching graphs/provenance/publication/recovery tests, actual native browser
flows with 2,507 complete records and a one-record preview, full CSV/SVG/PNG
downloads, ordinary selection/layer actions, and unchanged input SHA256 values.
Real-browser suites passed 35 chart checks and 16 matching checks. Toolbar
checks passed 84 action/keyboard and 73 layout cases. The native release workflow
also tests actual installers, bundled computations, GUI startup and uninstall
on Linux x64, Windows x64 and both macOS architectures before publication.

The preview runtime remains isolated from system GDAL/DuckDB installations and
has no publisher code signing or Apple notarization.

## Verified release source

[Native workflow 42078924920](https://github.com/Feng96/USBF_site/actions/runs/42078924920)
verified source `ebc1d1927b5b956eb01a9a00b290417926df6a41`, tree
`e67164e49cd4480ad09de103ad4f716c9dc1f533`. Linux x64, Windows x64, macOS
Apple Silicon and macOS Intel each passed 24 installation-lifecycle tests,
113 native tests and 33 actual installer/runtime/UI/uninstall checks.

The [0.4 preview release](https://github.com/Feng96/USBF_site/releases/tag/engine-v0.4.0-preview.1-r1)
contains those four tested packages. The website uses the actual published
manifest after checking every package size and SHA256 against GitHub asset
metadata. Installer self-test reports are retained with build artifacts.
CI handles temporary Windows status-file sharing locks and bounded macOS DMG
detach exit16 retries while preserving every installation/runtime assertion.

Additional final frontend checks passed: 226 unit checks, 16 GIS browser workflow
checks and 13 Chinese-interface/original-value checks. Provider benchmarking,
chart and matching browser evidence described above remains separate from
cross-platform installation acceptance and real-world completeness claims.
