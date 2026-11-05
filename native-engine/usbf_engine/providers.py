"""One original-data contract for allowlisted public building providers.

Providers resolve source identities and materialize resumable parts. The engine's
ordinary exact intersection, operations, checkpoints and results then apply to
all sources. No provider accepts browser SQL, endpoints or local filesystem paths.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlencode, urlparse

from .security import https_context
from .validation import bounds, digest_json, public_url, scope_geometry

PROVIDER_IDS = ("overture-buildings", "osm-buildings", "gba-usa", "dc-government", "nyc-government")
STAC = "https://stac.overturemaps.org"
OSM = "https://data.openstreetmap.us/layercake/buildings.parquet"
GBA = "https://data.source.coop/tge-labs/globalbuildingatlas-lod1/"
DC = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Facility_and_Structure/MapServer/1"
NYC = "https://data.cityofnewyork.us"
NYC_DATA = NYC + "/resource/5zhs-2jue"
MAX_METADATA = 32 * 1024 * 1024
MAX_API_PAGE = 32 * 1024 * 1024


def provider_url(value):
    """Narrower than generic source URLs; every redirect is checked again."""
    public_url(value)
    parsed = urlparse(value)
    allowed = ((parsed.netloc == "stac.overturemaps.org" and re.fullmatch(r"/(?:catalog\.json|[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+/(?:catalog\.json|collections\.parquet))", parsed.path))
               or value == OSM
               or (parsed.netloc == "data.source.coop" and re.fullmatch(r"/tge-labs/globalbuildingatlas-lod1/[ew][0-9]{3}_[ns][0-9]{2}_[ew][0-9]{3}_[ns][0-9]{2}\.parquet", parsed.path))
               or (parsed.netloc in {"overturemaps-us-west-2.s3.amazonaws.com", "overturemaps-us-west-2.s3.us-west-2.amazonaws.com"} and re.fullmatch(r"/release/[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+/theme=buildings/type=building/[^/]+\.parquet", parsed.path))
               or (value.split("?", 1)[0] in {DC, DC + "/query", NYC_DATA + ".json", NYC_DATA + ".geojson", NYC + "/api/views/5zhs-2jue.json"}))
    if not allowed:
        raise ValueError("The original-data provider returned an unapproved endpoint.")
    return value


class ProviderRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        provider_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def provider_open(url, *, headers=None):
    provider_url(url)
    opener = urllib.request.build_opener(ProviderRedirect(), urllib.request.HTTPSHandler(context=https_context()))
    return opener.open(urllib.request.Request(url, headers={"User-Agent": "USBF-Local-Engine/0.3", "Accept-Encoding": "identity", **(headers or {})}), timeout=30)


def read_json(url, maximum=MAX_METADATA):
    with provider_open(url) as response:
        raw = response.read(maximum + 1)
    if len(raw) > maximum:
        raise ValueError("The original-data provider response exceeds its page budget.")
    data = json.loads(raw)
    if isinstance(data, dict) and data.get("error"):
        raise ValueError("The original-data provider rejected this request.")
    return data


class HTTPRangeFile(io.RawIOBase):
    """Checked seekable HTTP file. A refused Range never downloads a whole file.

    Strong ETags use If-Match. Weak ETags additionally require Last-Modified.
    Every response must retain the pinned identity and exact Content-Range.
    """
    def __init__(self, url, *, identity=None, check=None, opener=None):
        super().__init__()
        self.url, self.position, self.network_bytes = url, 0, 0
        self.check = check or (lambda: None)
        self.opener = opener or provider_open
        self.identity = dict(identity or {})
        self._request(0, 8, initial=True)

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        position = offset if whence == io.SEEK_SET else self.position + offset if whence == io.SEEK_CUR else self.identity["bytes"] + offset if whence == io.SEEK_END else -1
        if position < 0:
            raise ValueError("Invalid provider byte position.")
        self.position = position
        return position

    def _request(self, start, size, *, initial=False):
        self.check()
        if size > 128 * 1024 * 1024:
            raise ValueError("A provider byte range exceeds the native memory budget.")
        headers = {"Range": f"bytes={start}-{start + size - 1}"}
        tag = self.identity.get("etag")
        if tag and not tag.startswith("W/"): headers["If-Match"] = tag
        elif self.identity.get("lastModified"): headers["If-Unmodified-Since"] = self.identity["lastModified"]
        with self.opener(self.url, headers=headers) as response:
            if response.status != 206:
                raise ValueError("The original-data provider did not honor byte-range access; the whole file was refused.")
            match = re.fullmatch(r"bytes ([0-9]+)-([0-9]+)/([0-9]+)", response.headers.get("Content-Range", ""))
            if not match or tuple(map(int, match.groups()[:2])) != (start, start + size - 1):
                raise ValueError("The original-data provider returned an incomplete byte range.")
            current = {"bytes": int(match[3]), "etag": response.headers.get("ETag"), "lastModified": response.headers.get("Last-Modified")}
            if not current["etag"] and not current["lastModified"]:
                raise ValueError("The original-data provider supplied no stable HTTP validator.")
            if current["etag"] and current["etag"].startswith("W/") and not current["lastModified"]:
                raise ValueError("The original-data provider supplied only a weak HTTP validator.")
            if self.identity and any(current.get(k) != v for k, v in self.identity.items() if k in current):
                raise ValueError("The original-data source changed after planning; create a new task.")
            self.identity = current
            raw = response.read(size + 1)
        self.check()
        if len(raw) != size:
            raise ValueError("The original-data provider returned an incomplete byte range.")
        self.network_bytes += len(raw)
        if initial and raw[:4] != b"PAR1":
            raise ValueError("The original-data source is not a Parquet file.")
        return raw

    def read(self, size=-1):
        if size is None or size < 0: size = self.identity["bytes"] - self.position
        size = min(size, self.identity["bytes"] - self.position)
        if size <= 0: return b""
        raw = self._request(self.position, size)
        self.position += len(raw)
        return raw

    def readinto(self, target):
        raw = self.read(len(target)); target[:len(raw)] = raw
        return len(raw)


def _outward_margin(value):
    # Providers publish bbox values as float32 even when geometry coordinates
    # are float64. Expand by one float32 ULP so rounded bounds cannot omit a
    # building touching the requested AOI.
    return abs(value) * 2**-23 + 2**-149


def candidate_row_groups(metadata, box):
    """Skip only groups proved disjoint by complete whole-geometry bbox stats.

    Missing/null/NaN statistics retain a group, preventing centroid or partial
    indexes from silently excluding buildings crossing the requested boundary.
    """
    groups = []
    for index in range(metadata.num_row_groups):
        group = metadata.row_group(index)
        stats = {}
        for col in range(group.num_columns):
            column = group.column(col)
            if column.path_in_schema not in {"bbox.xmin", "bbox.xmax", "bbox.ymin", "bbox.ymax"}: continue
            stat = column.statistics
            if stat and stat.has_min_max and stat.null_count == 0:
                low, high = stat.min, stat.max
                if isinstance(low, (int, float)) and isinstance(high, (int, float)) and math.isfinite(low) and math.isfinite(high):
                    stats[column.path_in_schema] = (low - _outward_margin(low), high + _outward_margin(high))
        if len(stats) == 4 and (stats["bbox.xmin"][0] > box[2] or stats["bbox.xmax"][1] < box[0] or stats["bbox.ymin"][0] > box[3] or stats["bbox.ymax"][1] < box[1]):
            continue
        groups.append(index)
    return groups


def _overture_asset_url(item):
    asset = item.get("assets", {}).get("aws", {})
    url = asset.get("href")
    if not url or url.startswith("s3://"):
        url = asset.get("alternate", {}).get("s3", {}).get("href", url)
        if url and url.startswith("s3://overturemaps-us-west-2/"):
            url = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/" + url[len("s3://overturemaps-us-west-2/"):]
    return provider_url(url)


def _where(box):
    w, s, e, n = box
    wkt = f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"
    return "intersects(the_geom,'" + wkt + "')"


def _api_url(provider, extra, box=None):
    if provider == "dc-government":
        params = {"f": "json", "where": "1=1"}
        if box:
            params.update(geometry=json.dumps({"xmin":box[0], "ymin":box[1], "xmax":box[2], "ymax":box[3], "spatialReference":{"wkid":4326}}), geometryType="esriGeometryEnvelope", inSR="4326", spatialRel="esriSpatialRelIntersects")
        return DC + "/query?" + urlencode({**params, **extra})
    return NYC_DATA + ".json?" + urlencode({**({"$where": _where(box)} if box else {}), **extra})


class ProvidersMixin:
    def _provider_json(self, url):
        return read_json(url)

    def _provider_identity(self, url):
        with HTTPRangeFile(url) as source:
            return source.identity

    def _provider_plan(self, source, scope, number):
        if set(source) - {"kind", "providerId", "releaseId"} or source.get("providerId") not in PROVIDER_IDS:
            raise ValueError("Choose a supported original-data provider; endpoints and SQL are not accepted.")
        if scope is None:
            raise ValueError("Original-data provider tasks need a fixed area of interest.")
        box = bounds(scope_geometry(scope))
        provider, requested = source["providerId"], source.get("releaseId")
        if requested is not None and (not isinstance(requested, str) or len(requested) > 80):
            raise ValueError("The original-data release identifier is invalid.")
        common = {"providerId": provider, "format": "geoparquet", "crs": "EPSG:4326", "crsExplicit": False,
                  "bytes": None, "rows": None, "sourceCandidateIndex": "whole-geometry-bbox-row-groups", "geometryBoundsGuaranteed": True,
                  "providerCompleteness": None, "scopeBounds": box}
        if provider == "overture-buildings":
            catalog = self._provider_json(STAC + "/catalog.json")
            release = requested or catalog.get("latest")
            if not isinstance(release, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+", release):
                raise ValueError("Choose a published Overture release.")
            published = {link.get("href", "").split("/")[-2] for link in catalog.get("links", []) if link.get("rel") == "child"}
            if release not in published:
                raise ValueError("That Overture release is not in the provider's current STAC catalog.")
            import pyarrow.parquet as pq
            index_url = STAC + "/" + release + "/collections.parquet"
            with HTTPRangeFile(index_url) as remote:
                if remote.identity["bytes"] > MAX_METADATA:
                    raise ValueError("The Overture STAC index exceeds its metadata budget.")
                table = pq.ParquetFile(remote).read().to_pylist()
                index_identity = remote.identity
            tiles = []
            for item in table:
                if item.get("collection") != "building" or item.get("type") != "Feature": continue
                bbox = item.get("bbox")
                if isinstance(bbox, dict): bbox = [bbox[k] for k in ("xmin", "ymin", "xmax", "ymax")]
                if not isinstance(bbox, (list, tuple)) or len(bbox) != 4: raise ValueError("The Overture STAC index has no usable geometry bounds.")
                if bbox[2] + _outward_margin(bbox[2]) < box[0] or bbox[0] - _outward_margin(bbox[0]) > box[2] or bbox[3] + _outward_margin(bbox[3]) < box[1] or bbox[1] - _outward_margin(bbox[1]) > box[3]: continue
                url = _overture_asset_url(item)
                tiles.append({"url": url, "sourceIdentity": self._provider_identity(url)})
            if not tiles:
                exemplar = next((item for item in table if item.get("collection") == "building" and item.get("type") == "Feature"), None)
                if exemplar is None: raise ValueError("The Overture release has no published building schema.")
                url = _overture_asset_url(exemplar)
                tiles = [{"url": url, "sourceIdentity": self._provider_identity(url), "emptySource": True}]
            release_info = {"providerId": provider, "releaseId": release, "immutable": True, "catalogUrl": index_url, "catalogIdentity": index_identity, "license": "Overture contributor licenses; ODbL building theme"}
        elif provider == "osm-buildings":
            if requested not in (None, "latest"):
                raise ValueError("Layercake exposes a mutable latest file, not an archived release identifier.")
            tiles = [{"url": OSM, "sourceIdentity": self._provider_identity(OSM)}]
            release_info = {"providerId": provider, "releaseId": "latest", "immutable": False, "license": "ODbL 1.0", "identity": tiles[0]["sourceIdentity"]}
        elif provider == "gba-usa":
            if requested not in (None, "2025-09"):
                raise ValueError("This GBA adapter uses the published 2025-09 USA manifest.")
            index_path = Path(__file__).with_name("gba-usa-index.json")
            raw = index_path.read_bytes()
            index = json.loads(raw)
            # Nominal tile bounds do not certify full building extents. Inspect
            # EVERY published USA candidate file's footer before excluding rows.
            tiles = [{"url": GBA + tile["file"], "originalBytes": tile["size"]} for tile in index["tiles"]]
            common["regionFilter"] = "USA"
            release_info = {"providerId": provider, "releaseId": "2025-09", "immutable": False, "manifestSha256": hashlib.sha256(raw).hexdigest(), "license": "GBA CC BY-NC 4.0 and ODbL components", "candidatePolicy": "All USA manifest files; whole-geometry row-group bounds, never nominal tile or centroid exclusion."}
        else:
            return self._provider_api_plan(provider, requested, common, number)
        return [{**common, **tile, "id": f"{number}.p{index}", "kind": "provider-parquet", "name": tile["url"].rsplit("/", 1)[-1], "sourceRelease": release_info} for index, tile in enumerate(tiles)]

    def _api_revision(self, provider):
        if provider == "dc-government":
            meta = self._provider_json(DC + "?f=json")
            return {"editingInfo": meta.get("editingInfo"), "fields": meta.get("fields"), "objectIdField": meta.get("objectIdField", "OBJECTID"), "sourceSpatialReference": meta.get("sourceSpatialReference"), "hasZ": meta.get("hasZ", False), "hasM": meta.get("hasM", False)}
        meta = self._provider_json(NYC + "/api/views/5zhs-2jue.json")
        return {"rowsUpdatedAt": meta.get("rowsUpdatedAt"), "viewLastModified": meta.get("viewLastModified"),
                "columns": [{k: column.get(k) for k in ("fieldName", "dataTypeName")} for column in meta.get("columns", []) if not str(column.get("fieldName", "")).startswith(":")]}

    def _provider_api_plan(self, provider, requested, common, number):
        if requested not in (None, "live"):
            raise ValueError("This official API exposes live records, not an archived release.")
        box = common["scopeBounds"]
        revision = self._api_revision(provider)
        if provider == "dc-government":
            data = self._provider_json(_api_url(provider, {"returnIdsOnly": "true"}, box))
            ids = data.get("objectIds")
            if not isinstance(ids, list) or data.get("exceededTransferLimit") or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids) or len(ids) != len(set(ids)):
                raise ValueError("The official API did not list every matching source ID.")
            identity_field = data.get("objectIdFieldName") or revision["objectIdField"]
        else:
            count_data = self._provider_json(_api_url(provider, {"$select": "count(*)"}, box))
            expected = int(count_data[0]["count"])
            if not 0 <= expected <= 50_000_000: raise ValueError("The official API returned an invalid count.")
            ids = []
            for offset in range(0, expected, 10000):
                page = self._provider_json(_api_url(provider, {"$select": ":id", "$order": ":id", "$limit": min(10000, expected-offset), "$offset": offset}, box))
                if not isinstance(page, list): raise ValueError("The official API did not return the matching record IDs.")
                ids.extend(row.get(":id") for row in page)
            if len(ids) != expected or len(set(ids)) != len(ids) or not all(isinstance(i, str) and re.fullmatch(r"[A-Za-z0-9_.~-]{1,128}", i) for i in ids):
                raise ValueError("The official API changed or did not list every unique matching source ID.")
            identity_field = ":id"
        if len(ids) > 50_000_000: raise ValueError("The official API returned too many source IDs.")
        if self._api_revision(provider) != revision:
            raise ValueError("The official source changed during planning. Plan a fresh task.")
        release = {"providerId": provider, "releaseId": "live", "immutable": False, "revision": revision, "plannedSourceIds": len(ids), "sourceIdsSha256": digest_json(ids), "snapshotIsolation": False}
        # Empty requests still publish a typed empty result and honest coverage.
        batches = [ids[i:i+500] for i in range(0, len(ids), 500)] or [[]]
        return [{**common, "id": f"{number}.p{i}", "kind": "provider-api", "name": provider + " original records " + str(i+1),
                 "sourceRelease": release, "sourceIds": batch, "identityField": identity_field,
                 "sourceCandidateIndex": "server-whole-geometry-intersects", "rows": len(batch)} for i, batch in enumerate(batches)]

    def _provider_materialize(self, part, directory, job_id):
        import pyarrow.parquet as pq
        destination = directory / (part["id"] + ".source.parquet")
        temporary = Path(str(destination) + ".writing")
        self._check(job_id)
        try:
            if part["kind"] == "provider-api":
                self._provider_api_materialize(part, temporary, job_id)
            else:
                with HTTPRangeFile(part["url"], identity=part.get("sourceIdentity"), check=lambda: self._check(job_id)) as remote:
                    part["sourceIdentity"] = remote.identity
                    if part.get("originalBytes") is not None and part["originalBytes"] != remote.identity["bytes"]:
                        raise ValueError("The GBA publication file size changed; update its manifest before reading.")
                    parquet = pq.ParquetFile(remote, pre_buffer=False)
                    groups = [] if part.get("emptySource") else candidate_row_groups(parquet.metadata, part["scopeBounds"])
                    with pq.ParquetWriter(temporary, parquet.schema_arrow, compression="zstd") as writer:
                        for batch in parquet.iter_batches(batch_size=8192, row_groups=groups, use_threads=False):
                            self._check(job_id)
                            writer.write_batch(batch)
                    part["transport"] = {"method": "checked-http-range", "networkBytes": remote.network_bytes, "sourceBytes": remote.identity["bytes"], "selectedRowGroups": len(groups), "totalRowGroups": parquet.metadata.num_row_groups, "wholeFileDownloaded": False}
            self._check(job_id)
            temporary.replace(destination)
            part["materializedSha256"] = self._hash_file(destination, job_id)
            return destination
        finally:
            temporary.unlink(missing_ok=True)

    def _provider_api_materialize(self, part, destination, job_id):
        import pyarrow as pa
        import pyarrow.parquet as pq
        provider, release = part["providerId"], part["sourceRelease"]
        if self._api_revision(provider) != release["revision"]:
            raise ValueError("The live official source changed after planning. Create a new task.")
        ids = part["sourceIds"]
        features, returned = [], []
        if provider == "dc-government":
            def batch(selected):
                self._check(job_id)
                data = self._provider_json(_api_url(provider, {"f": "geojson", "objectIds": ",".join(map(str, selected)), "outFields": "*", "outSR": "4326", "returnGeometry": "true", "returnZ": "true", "returnM": "true"}))
                if data.get("exceededTransferLimit") and len(selected) > 1:
                    middle = len(selected)//2; batch(selected[:middle]); batch(selected[middle:]); return
                if data.get("exceededTransferLimit") or not isinstance(data.get("features"), list):
                    raise ValueError("The official API returned an incomplete source page.")
                own = data["features"]
                actual = [f.get("properties", {}).get(part["identityField"], f.get("id")) for f in own]
                if len(actual) != len(selected) or set(map(str, actual)) != set(map(str, selected)):
                    raise ValueError("The official API changed or omitted planned source IDs.")
                features.extend(own); returned.extend(actual)
            if ids: batch(ids)
            fields = release["revision"]["fields"]
            types = {"esriFieldTypeOID": pa.int64(), "esriFieldTypeInteger": pa.int32(), "esriFieldTypeSmallInteger": pa.int16(), "esriFieldTypeSingle": pa.float32(), "esriFieldTypeDouble": pa.float64(), "esriFieldTypeDate": pa.int64(), "esriFieldTypeBigInteger": pa.int64()}
            schema = [(field["name"], types.get(field["type"], pa.string())) for field in fields if field["type"] != "esriFieldTypeGeometry"]
        else:
            if ids:
                where = ":id in(" + ",".join("'" + i + "'" for i in ids) + ")"
                records = self._provider_json(_api_url(provider, {"$where": where, "$select": "*, :id AS __usbf_snapshot_id", "$limit": len(ids), "$order": ":id"}))
                if not isinstance(records, list): raise ValueError("The official API returned an incomplete source page.")
                returned = [row.pop("__usbf_snapshot_id", None) for row in records]
                if len(returned) != len(ids) or set(returned) != set(ids):
                    raise ValueError("The official API changed or omitted planned source IDs.")
                features = [{"type":"Feature", "geometry": row.pop("the_geom", None), "properties": row} for row in records]
            # Socrata's JSON transport represents number/date/text values as exact
            # strings. Retain those strings, including decimal precision and nulls.
            schema = [(field["fieldName"], pa.bool_() if field["dataTypeName"] == "checkbox" else pa.string()) for field in release["revision"]["columns"] if field["fieldName"] != "the_geom"]
        if self._api_revision(provider) != release["revision"]:
            raise ValueError("The live official source changed while reading. Create a new task.")
        known = {name for name, _ in schema}
        if any(set(feature.get("properties", {})) - known for feature in features):
            raise ValueError("The official API returned undeclared source attributes. Refresh the task's field schema.")
        geometry_name = "geometry"
        while geometry_name in known: geometry_name += "_"
        feature_id = "_usbf_source_feature_id"
        while feature_id in known: feature_id += "_"
        has_id = any("id" in feature for feature in features)
        if has_id: schema.append((feature_id, pa.int64() if all(isinstance(feature.get("id"), int) or feature.get("id") is None for feature in features) else pa.string()))
        schema.append((geometry_name, pa.string()))
        arrow_schema = pa.schema(schema)
        rows = []
        for feature in features:
            row = dict(feature.get("properties", {}))
            if has_id: row[feature_id] = feature.get("id")
            row[geometry_name] = json.dumps(feature.get("geometry"), allow_nan=False) if feature.get("geometry") is not None else None
            rows.append(row)
        # Store source geometry JSON temporarily; DuckDB's ingest converts this
        # exact unsimplified outline into the shared geometry column.
        pq.write_table(pa.Table.from_pylist(rows, schema=arrow_schema), destination, compression="zstd")
        part["providerGeometryColumn"] = geometry_name
        part["verifiedSourceRows"] = len(returned)
        part["transport"] = {"method": "source-id-verified-api", "plannedSourceRows": len(ids), "returnedSourceRows": len(returned), "sourceRevisionChecked": True, "snapshotIsolation": False}
