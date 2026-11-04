# Engine, reproducible Projects and interactive sharing

Development evidence recorded on 2026-11-04. Deployment and installer verification are recorded separately below when performed.

## Data versions and Project behavior

- The USBF registry contains the actual public `USBF_v1` publication updated `2026-10-27T22:25:21.308964+00:00`: 150,261,726 source records in 3,522 Parquet shards.
- Original manifest SHA256: `f496596a4a78e1dbbae1db41e76cac6e7524ceb4ee0b6cfa75b7b26d6ab3e8d1`. Display manifest SHA256: `a2f7afa583c7f9f6136bae9e82eacb89ba978b6055d750315c95fba52eed4d22`. The display manifest explicitly references that original manifest hash, publication date and counts.
- Hash-named snapshots retain the exact upstream manifest, schema and component license bytes. Per-record ODbL / CC BY-NC component terms remain in force. This is not a blanket unrestricted data license. No permanent identifier is invented.
- New Projects use format version 2 and explicitly store pinned/latest policy. Pinned catalog connections verify their saved snapshots before replacement and never poll or silently substitute the latest publication. Earlier version 1 Projects remain readable and warn when following latest USBF data.
- Saving a pinned snapshot does not mutate an already-live connection. Its saved Project restores the captured pin. A live publication/archive identity or connection policy change marks the current Project unsaved; a transient polling warning does not.
- Upstream original files use flat keys that may be overwritten. A manifest snapshot freezes expected identities, not permanent remote file availability. Browser pinned reads verify complete shard bytes against SHA256 before decoding; shards beyond the 32 MiB browser budget require the local engine. Native planning receives exact selected file identities and expected checksums.
- Native Project references retain workspace ID, relative result path, record count, release and optional SHA256. Missing/wrong-workspace/changed files produce dependency warnings; a saved bounded display preview may reopen, but cannot silently become a browser analytical workset.
- Source-part request completion is separate from provider completeness. Browser ownership-coordinate subsets, native geometry intersection, and uncertified full-geometry index bounds are described separately.

## Sharing behavior

- Share freezes the selected visible map, title, layers, styles, raw embedded records, basemap images, legend and attribution. Hidden layers/models are excluded before source/file reads by default; users can explicitly include them.
- Small maps receive compressed fragment URLs; encoded payloads are capped at 24,000 characters. Larger maps use a downloadable HTML file. Shared documents are capped at 64 MiB. This process does not upload a map or invent a cloud URL.
- Downloaded HTML embeds its map payload and uses the online USBF renderer/public sources. It requires internet access; it is not a fully offline renderer package.
- The recipient renderer runs in an iframe with `sandbox="allow-scripts"` and no `allow-same-origin`. Message exchange validates the exact frame and a random nonce. The reader supports navigation, layer visibility and attribute inspection while lacking author Project storage, native pairing and file-handle authority.
- Shared control metadata removes native private paths, workspace/task pointers and credentials. Public source URLs are checked, including nested provenance URLs. Raw feature fields named `token` or `path`, long identifiers, null/false values, filenames and technical terms stay unchanged. Bounded native previews remain labelled after reader validation.
- SHA256 detects changed content; it is not a publisher identity signature. Sharing a readonly view does not make published source code or downloadable data copy-proof.
- Narrow-screen source review fixed intrinsic-width risks in share title inputs, headings and reader layer selectors. Runtime phone acceptance is reported separately.

## Completed automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Release/share contracts | 24 passed | `node tools/releases-sharing-qa.cjs` |
| Real worker with PyArrow ZSTD/WKB fixtures | 24 passed | `node tools/usbf-analysis-worker-qa.mjs <fixture-directory>` |
| USBF latest/pinned update behavior | 36 passed | `node tools/usbf-update-qa.cjs` |
| Existing Project core regression | 23 passed | `node tools/project-qa.cjs` |
| Basemap/interface Project contracts | 12 passed | `node tools/design-project-qa.cjs` |
| Project release dirty tracking | 5 passed | `node tools/project-release-dirty-qa.cjs` |
| Release/share and workflow script syntax | 13 files passed | Node `vm.Script` parse checks |

The real-worker fixtures were generated in isolated scratch storage outside the repository. Tests decoded actual Parquet bytes, verified pinned SHA256, rejected changed bytes, enforced the browser budget, preserved original attributes/component terms and exercised cancellation/cache behavior. The 33.96 GB PMTiles archive was not downloaded or rehashed; its expected checksum is preserved from its verified publication manifest.

Browser acceptance entries are `tools/releases-sharing-workflow-checks.cjs` and `tools/native-project-workflow-checks.cjs`; they use the parent harness's existing browser session. Full browser completion, native cross-platform packaging, actual installer execution and live deployment results must be appended only after their receipts exist.

## Integration results

- Parent browser suite: **46 checks passed, no uncaught browser errors**. Actual loopback pairing, a 25,001-record result, full-result GIS measurement retaining all 25,001 records, bounded previews, paginated tables, reload/disconnect, browser load/cancel/history, native Project restoration, opaque readonly HTML/URL readers, original attributes and Chinese interface were exercised.
- Basemap/interface/portable Project regression: **17 browser checks passed**, including actual image upload and phone-width Interface controls.
- Native API/SQL/launcher/TLS: **29 tests passed**, covering complete results, checksums, CRS, exact attribute types, cancel/restart/resume, atomic receipts, unknown estimates, certificate independence, CLI failures, 17 MiB values and complex geometries under bounded-preview rules.
- Filesystem ownership/checkpoint protection: **28 checks passed**; installer ownership/data-preserving removal and workspace process locking: **9 passed, 3 platform-specific checks deferred to Windows CI**.
- Final source self-test: **10 checks passed**, including verified HTTPS to the actual public USBF publication. The final API implementation passed an 18-check native browser workflow after the byte-budget and TLS changes, including exact original values in the rendered attribute table.

- Four native target builds and acceptance gates passed in [workflow run 41918264258](https://github.com/Feng96/USBF_site/actions/runs/41918264258): Windows x64, Linux x64, macOS Apple Silicon and macOS Intel. Each package passed 13 installer/runtime checks, including real setup/engine windows, paired API/SQL, original values, external HTTPS with host CA paths disabled, and data-preserving uninstall. Windows additionally passed actual PowerShell ownership and runtime self-removal regressions.
- Preview installers are published in [engine-v0.1.0-preview.1-r6](https://github.com/Feng96/USBF_site/releases/tag/engine-v0.1.0-preview.1-r6), built from `d0e8989b45537e91bf547821651cf486921c5a6c`. All four package sizes and SHA256 values match GitHub's independent asset digests. The website consumes that published manifest; publisher code signing and Apple notarization are not claimed.
- The desktop process lock prevents duplicate workers for one workspace. The browser table renders the backend's original property objects, preserving identifiers, zero, false and null instead of showing missing-field placeholders.

Website publication is recorded in [Pages deployment history](https://github.com/Feng96/USBF_site/actions). Final production acceptance and exact revision are also retained in the local publication receipt.


## Production acceptance

The deployed application passed **38 real browser checks**: all four download links, versioned public manifests, real PMTiles buildings in Washington/DC, New York, Los Angeles and Boston, bounded HTTP Range reads, zero original-data reads during repeated zooms, explicit saved-area original loading, exact selected IDs/heights/licenses, readonly URL/downloaded HTML, opaque authority boundaries, Chinese interface and phone layout. The updated public test follows the current saved-area workflow; the earlier single-record auto-load expectation was obsolete.

One actual public USBF shard (29,754 bytes, expected SHA256 `17d027d23bdc90036b4be4235fa87e0aaea25fd11e4a6ad1cc7d2b6491a7f155`) also passed the native engine: 2 source rows produced 2 complete output rows, 67 ordinary attribute names/types and all values were retained, geometries were valid, and exact attribute/canonical WKB comparison found no differences. An all-null secondary `original_geometry` column retains its null values while DuckDB omits its spatial annotation; the primary geometry remains correctly tagged.

Production checks can be run through `tools/engine-sharing-public-checks.cjs` with the existing browser harness. UI/native tests and the immutable native release remain attached to the implementation commit; the final documentation/test update changes no application code.
