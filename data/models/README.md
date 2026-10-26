# Display samples

This small display collection contains eight existing US experimental cases
and twenty actual roof meshes selected from the frozen 20,000-building training
roster, two per each of ten Dutch source cities. It is not a national inventory.

`manifest.json` lists every sample and SHA-256 of its model file. Model files
are loaded on demand and checked before rendering. No new model training or
scientific reconstruction was performed for the website.

US data preserves the guarded-input comparison's existing mesh coordinates,
roof masks, ground display offsets, method identity and edge-check outcomes.
An edge-check pass is not independent roof accuracy or certified solid validity.
The DL view is an experimental candidate, including its failed checks. These
IDs are not asserted to match VIDA tile features. Original experiment:
https://feng96.github.io/research-daily/lod2/paper/

Training files preserve the original roof triangles in provenance, native
EPSG:7415 coordinates, source mesh/response hashes and frozen roster membership.
Display coordinates transform RD New XY to local east/north metres at each
geographic anchor, and subtract the recorded ground from NAP Z. Only roof
surfaces were used in that training collection; no walls are invented. These
are automatic 3DBAG references, not independent measured ground truth or US
production models. Attribution: 3DBAG by the 3D geoinformation research group
and 3DGI, CC BY 4.0: https://docs.3dbag.nl/en/copyright/

Model data retains its source terms and attribution. The application MIT
license does not replace dataset terms. US samples retain the underlying
NAIP/USGS 3DEP and GBA/OSM source lineage documented by the original experiment.
OBJ exports include the collection attribution and local coordinate anchor;
JSON exports retain method and provenance metadata.

The exporter is `tools/export-model-samples.py`. It reads frozen inputs only,
verifies selected training mesh hashes and never starts training/production.
