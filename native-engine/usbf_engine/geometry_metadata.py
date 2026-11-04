"""Keep genuine zero-row outputs valid GeoParquet without adding any features."""
from __future__ import annotations

import json
import os
from pathlib import Path

from .runtime import sqlstr


def empty_metadata(column):
    # EPSG:4326 PROJJSON, matching the original USBF publication. Storing this
    # declaration needs no placeholder geometry and preserves longitude/latitude
    # coordinates under the engine's explicit always_xy convention.
    members = [("Transit", 1166), ("G730", 1152), ("G873", 1153), ("G1150", 1154),
               ("G1674", 1155), ("G1762", 1156), ("G2139", 1309), ("G2296", 1383)]
    crs = {"$schema": "https://proj.org/schemas/v0.7/projjson.schema.json", "type": "GeographicCRS", "name": "WGS 84",
           "datum_ensemble": {"name": "World Geodetic System 1984 ensemble",
                              "members": [{"name": "World Geodetic System 1984 (" + name + ")", "id": {"authority": "EPSG", "code": code}} for name, code in members],
                              "ellipsoid": {"name": "WGS 84", "semi_major_axis": 6378137, "inverse_flattening": 298.257223563},
                              "accuracy": "2.0", "id": {"authority": "EPSG", "code": 6326}},
           "coordinate_system": {"subtype": "ellipsoidal", "axis": [
               {"name": "Geodetic latitude", "abbreviation": "Lat", "direction": "north", "unit": "degree"},
               {"name": "Geodetic longitude", "abbreviation": "Lon", "direction": "east", "unit": "degree"}]},
           "scope": "Horizontal component of 3D system.", "area": "World.",
           "bbox": {"south_latitude": -90, "west_longitude": -180, "north_latitude": 90, "east_longitude": 180},
           "id": {"authority": "EPSG", "code": 4326}}
    return {"version": "1.1.0", "primary_column": column,
            "columns": {column: {"encoding": "WKB", "geometry_types": [], "crs": crs}}}


def preserve_empty_geoparquet(connection, path, column="__usbf_geometry"):
    """DuckDB omits automatic geo metadata for zero rows; repair only that case.

    All original field schemas and zero records are retained. Nonempty outputs
    never enter this rewrite. The metadata describes an empty WKB geometry
    column, not an invented geometry, extent, or bounding box.
    """
    path = Path(path)
    if connection.execute("SELECT count(*) FROM read_parquet(?)", [str(path)]).fetchone()[0] != 0:
        return False
    if connection.execute("SELECT count(*) FROM parquet_kv_metadata(?) WHERE key='geo'", [str(path)]).fetchone()[0]:
        return False
    temporary = path.with_name(path.name + ".geo.writing")
    temporary.unlink(missing_ok=True)
    try:
        metadata = json.dumps(empty_metadata(column), separators=(",", ":"))
        connection.execute("COPY (SELECT * FROM read_parquet(" + sqlstr(path) + ")) TO " + sqlstr(temporary)
                           + " (FORMAT PARQUET,COMPRESSION ZSTD,KV_METADATA {geo:" + sqlstr(metadata) + "})")
        os.replace(temporary, path)
        return True
    finally:
        temporary.unlink(missing_ok=True)
