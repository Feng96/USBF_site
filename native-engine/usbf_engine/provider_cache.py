"""Validator-bound provider reuse through the engine's existing owned cache.

This module defines cache keys and size limits only. EngineMaintenance owns all
files, checksums, quota reporting and explicit cleanup.
"""
from __future__ import annotations

import hashlib
import json

MAX_FOOTER_BYTES = 32 * 1024 * 1024
MAX_MATERIALIZATION_BYTES = 128 * 1024 * 1024
CACHE_VERSION = "provider-whole-geometry-v1"


def source_binding(url, identity, release=None):
    """A weak ETag alone cannot identify reusable bytes."""
    size = identity.get("bytes")
    if type(size) is not int or size < 8:
        raise ValueError("The provider supplied an invalid source size.")
    tag = identity.get("etag")
    if isinstance(tag, str) and tag and not tag.startswith("W/"):
        validator = {"etag": tag, "bytes": size}
    elif identity.get("lastModified"):
        validator = {"lastModified": identity["lastModified"], "bytes": size}
    else:
        raise ValueError("The provider supplied no stable HTTP validator for reuse.")
    return {"version": CACHE_VERSION, "url": url, "identity": validator, "release": release}


def cache_key(binding, kind, selection):
    value = {"source": binding, "kind": kind, "selection": selection}
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


class ProviderCache:
    def __init__(self, maintenance, url, identity, job_id, release=None):
        self.maintenance, self.job_id = maintenance, job_id
        self.binding = source_binding(url, identity, release)
        self.range_hits = self.cached_bytes = 0

    def range_hit(self, start, size):
        key = cache_key(self.binding, "providerMetadata", [start, size])
        path = self.maintenance.provider_hit(key, self.job_id)
        if path is None:
            return None
        raw = path.read_bytes()
        if len(raw) != size:
            return None
        self.range_hits += 1
        self.cached_bytes += size
        return raw

    def range_store(self, start, raw):
        key = cache_key(self.binding, "providerMetadata", [start, len(raw)])
        self.maintenance.provider_store(key, "providerMetadata", raw, self.job_id)

    def materialization_key(self, groups):
        return cache_key(self.binding, "providerMaterialization", groups)
