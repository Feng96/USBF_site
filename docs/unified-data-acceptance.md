# Unified objects and source interfaces: acceptance

This update connects existing building displays to original-data workflows and
uses one layer-operation registry across the sidebar, ribbon and scoped workspace.
The tested source contract is documented in [unified-data-workflow.md](unified-data-workflow.md).

## Source and browser validation

| Check | Result |
| --- | --- |
| Complete native regression, including the new providers and comparisons | 81 passed |
| New provider fixtures, checked ranges, row groups, UTC timestamps, empty results and conservative bbox padding | 11 passed |
| Complete native comparison, selections beyond the preview and independent geodesic references | 3 passed |
| Shared layer action vocabulary, capability decisions and explicit targets | 48 passed |
| Real sidebar/ribbon operation parity, Chinese/English, phone layout | 15 passed |
| Actual full native Statistics, explicit targets/scopes and certified full extent | 11 passed |
| Existing browser GIS selection, extraction, merge and Project workflow | 16 passed |
| Real browser/native comparison of 2,507 complete records with a one-record preview | 16 passed |
| Browser comparison including a genuine empty AOI | 15 passed |
| Shared original-data source descriptors and old-engine/mobile handling | 19 passed |
| Native task identity, release metadata and readonly guards | 21 passed |
| Paired local-engine client and browser permission handling | 22 passed |
| Fixed scope, saved boundaries and raw attribute integrity | 15 + 36 + 50 passed |
| Actual source desktop self-test through the paired local HTTP API | 21 passed |
| Actual website workflow through OSM and Overture providers, metadata and readonly | 14 passed |

Native area calculations for asymmetric DC and Los Angeles polygons exactly match
independent PyProj/GeographicLib WGS84 reference values. The pinned DuckDB runtime
reports `geometry_always_xy = true`; no axis flip is applied. Browser spherical
and native ellipsoidal area methods remain separately identified.

## Actual public providers

All five online source tests completed their request with
`providerCompleteness: null`. Counts describe the exact tested request, not
provider accuracy or geographic completeness.

| Provider | Original result rows | Actual transport |
| --- | --- | --- |
| OSM Layercake | 25 | 35,052,662 checked range bytes; 3 of 5,793 groups from a 46,201,191,041-byte file |
| Overture `2026-10-21.0` | 25 | 4,009,834 checked range bytes; 1 of 256 groups from a 688,493,792-byte file |
| GBA USA `2025-09` | 25 | 43,499,542 checked range bytes; 3 of 18,569 groups across all 189 candidate files |
| DC official API | 26 | Planned IDs and exposed source revision checked against every returned page |
| NYC official API | 3 | Exact source-ID pages; original JSON strings retained without numeric/date coercion |

GBA's conservative first-read scan took about 297 seconds on the test connection.
This protects against excluding whole buildings with nominal tile bounds; it is
not an instantaneous-loading claim. Source request timing and byte counts depend
on connection, provider conditions and geometry complexity. Live APIs do not
provide transactional snapshot isolation.

The four-platform native build passed in
[run 42058541626](https://github.com/Feng96/USBF_site/actions/runs/42058541626),
from exact source revision `4a7819c890547047a429bfcc6066dcbe6f1005ae`.
Each target passed 21 installation lifecycle tests, 81 native source tests and
25 actual installer/runtime/UI/uninstall checks. The public
[0.3 preview release](https://github.com/Feng96/USBF_site/releases/tag/engine-v0.3.0-preview.1-r1)
manifest is SHA256
`3f0e61b1c09c9054a4561fdcb1c8489a8a3766d259fccf46add66a3a052c48a4`.
All four public package sizes and digests match GitHub release assets and the
built-and-tested package logs. The real browser Data & scope workflow completed
both OSM and Overture tasks with 25 original records each, preserving the exact
saved AOI after map movement, original attributes, release/terms and HTTP validator
provenance. Old-engine update guidance prevented unsupported requests; readonly
execution made zero private engine requests. No uncaught browser errors occurred.
Pages publication and final deployed resource identities are recorded in the
local publication receipt after deployment.

## Remaining boundaries

Microsoft/Esri and VIDA original adapters are future work; their existing display
connections and original-file import remain available. Comparison reports aggregate
counts, whole-polygon area and supplied-height availability. It does not match
individual footprints or establish independent accuracy. Native chart creation
still requires a browser workset; the complete native summary/comparison paths
do not sample preview rows.

The earlier USBF immutable original archive remains pending valid Source
Cooperative upload authorization. No original archive writes were made in this
update. The native preview remains without publisher signing or Apple notarization.
