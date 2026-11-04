"""Validate immutable job descriptions and workspace-local paths."""
from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import os
import re
import socket
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse

FOLDERS = ("Projects", "Results", "Files", "Cache", "Engine")
FORMATS = {"parquet", "geoparquet", "geojson", "json", "gpkg", "fgb", "shp"}
OPERATIONS = {"load", "extract-box", "extract-mask", "merge", "measure", "buffer"}
HOSTS = {"data.source.coop", "data.source.cooperative", "data.sourcecooperative.org",
         "raw.githubusercontent.com", "feng96.github.io", "opendata.arcgis.com", "maps2.dcgis.dc.gov",
         "services.arcgis.com", "data.cityofnewyork.us", "s3.amazonaws.com"}
MAX_SPEC_BYTES = 16 * 1024 * 1024


def clone(value):
    return json.loads(json.dumps(value, allow_nan=False))


def digest_json(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def safe_name(value):
    if not isinstance(value, str) or not value or len(value) > 180 or value != value.strip() or value.startswith(".") or re.search(r'[\\/:*?"<>|\x00-\x1f]', value) or value in {"..", "."} or re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", value, re.I):
        raise ValueError("Choose a valid local filename.")
    return value


def workspace_path(root: Path, value: str, *, roots=("Files", "Results", "Cache"), exists=True):
    if not isinstance(value, str) or len(value) > 1000 or "\\" in value:
        raise ValueError("Use a relative workspace path.")
    parts = value.split("/")
    if len(parts) < 2 or parts[0] not in roots or any(not p or p in {".", ".."} or p.startswith(".") for p in parts):
        raise ValueError("Choose a file inside the connected workspace.")
    for part in parts: safe_name(part)
    path = root.joinpath(*parts)
    # Resolve every existing parent: a symlink must never escape the selected root.
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("The path leaves the connected workspace.")
    if exists and not path.is_file():
        raise FileNotFoundError("The selected workspace file does not exist.")
    return path


def public_url(value, *, resolve=True):
    if not isinstance(value, str) or len(value) > 4000 or any(c.isspace() for c in value):
        raise ValueError("Use a public HTTPS source URL.")
    url = urlparse(value)
    host = (url.hostname or "").lower()
    allowed = host in HOSTS or host.endswith(".source.coop") or host.endswith(".s3.amazonaws.com") or host.endswith(".blob.core.windows.net")
    if url.scheme != "https" or not allowed or url.username or url.password or url.fragment or url.port not in (None, 443):
        raise ValueError("This native source needs an approved public HTTPS host without credentials.")
    if resolve:
        for address in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM):
            if not ipaddress.ip_address(address[4][0]).is_global:
                raise ValueError("Private-network source addresses are not allowed.")
    return value


def scope_geometry(scope):
    if scope is None:
        return None
    if not isinstance(scope, dict) or scope.get("crs", "EPSG:4326") != "EPSG:4326":
        raise ValueError("Native task boundaries use EPSG:4326 longitude and latitude.")
    geom = scope.get("geometry")
    if not isinstance(geom, dict) or geom.get("type") not in {"Polygon", "MultiPolygon"}:
        raise ValueError("Choose a Polygon or MultiPolygon task boundary.")
    count = 0

    def visit(value):
        nonlocal count
        if not isinstance(value, list) or not value:
            raise ValueError("The task boundary is invalid.")
        if isinstance(value[0], (float, int)):
            if len(value) < 2 or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in value) or abs(value[0]) > 180 or abs(value[1]) > 90:
                raise ValueError("The task boundary is outside longitude / latitude.")
            count += 1
            if count > 100_000:
                raise ValueError("The task boundary has too many vertices.")
        else:
            for child in value:
                visit(child)
    visit(geom.get("coordinates"))
    return clone(geom)


def bounds(geom):
    points = []
    def visit(v):
        if isinstance(v[0], (int, float)):
            points.append(v)
        else:
            for c in v:
                visit(c)
    visit(geom["coordinates"])
    return [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]


def intersects(a, b):
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def normalize_spec(value):
    if not isinstance(value, dict) or len(json.dumps(value, allow_nan=False).encode()) > MAX_SPEC_BYTES:
        raise ValueError("The native task description exceeds 16 MiB.")
    allowed = {"schema", "operation", "inputs", "scope", "parameters", "release", "inputContract", "name"}
    if set(value) - allowed or value.get("schema", 1) != 1 or value.get("operation") not in OPERATIONS:
        raise ValueError("This native task operation or schema is unsupported.")
    inputs = value.get("inputs")
    if not isinstance(inputs, list) or not 1 <= len(inputs) <= 64 or not all(isinstance(i, dict) for i in inputs):
        raise ValueError("Choose one to 64 native input sources.")
    scope_geometry(value.get("scope"))
    if value["operation"] in {"extract-box", "extract-mask"} and value.get("scope") is None:
        raise ValueError("Extraction needs a fixed task boundary.")
    if not isinstance(value.get("parameters", {}), dict) or len(json.dumps(value.get("parameters", {}))) > 65536:
        raise ValueError("The task parameters are invalid.")
    params = value.get("parameters", {})
    if set(params) - {"distanceMetres", "measurementCRS", "outputCRS"}:
        raise ValueError("Unsupported native parameters cannot be executed.")
    if value["operation"] == "buffer":
        distance = params.get("distanceMetres")
        crs = params.get("measurementCRS")
        if not isinstance(distance, (int, float)) or not math.isfinite(distance) or abs(distance) > 1_000_000 or not isinstance(crs, str) or not re.fullmatch(r"EPSG:\d{4,6}", crs) or not (crs in {"EPSG:5070", "EPSG:6933", "EPSG:3035"} or re.fullmatch(r"EPSG:(326|327)(0[1-9]|[1-5][0-9]|60)", crs)):
            raise ValueError("Buffer needs a finite metre distance and a suitable projected measurement CRS.")
    if params.get("outputCRS", "EPSG:4326") != "EPSG:4326":
        raise ValueError("Native v0.1 output geometry uses EPSG:4326.")
    if len(json.dumps(value.get("inputContract", {}), allow_nan=False).encode()) > 1024 * 1024:
        raise ValueError("The input contract exceeds its 1 MiB budget.")
    return clone(value)


def json_exact(value):
    """Do not round source BIGINTs merely because the consumer is JavaScript."""
    if isinstance(value, int) and not isinstance(value, bool) and abs(value) > 2**53 - 1:
        return str(value)
    if isinstance(value, dict):
        return {str(k): json_exact(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_exact(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value
