"""Complete original polygon summaries for explicit source comparisons.

This module deliberately does not pair footprints or assert independent
validation. Selections are the immutable complete-result selections managed by
ResultsMixin; bounded display previews are never read here.
"""
from __future__ import annotations

import math

from .results import GEOM
from .runtime import ident
from .validation import json_exact

HEIGHT_FIELDS = ("height_m", "height", "height_meters", "height_metres", "height_roof", "building:height")


class ComparisonMixin:
    def result_comparison_summary(self, job_id, value):
        if not isinstance(value, dict) or set(value) - {"selectionId", "heightField"}:
            raise ValueError("Unsupported source comparison options.")
        job = self.get_job(job_id)
        if job.get("operation") == "buffer":
            raise ValueError("Choose original polygon worksets for source comparison. Buffered geometry is derived.")
        with self._indexed_result(job_id) as (c, info):
            names = {column["name"] for column in info["columns"]}
            field = value.get("heightField")
            if field is not None and (field not in HEIGHT_FIELDS or field not in names):
                raise ValueError("Choose an original supplied height field; rendering heights and building levels are excluded.")
            if field is None:
                field = next((name for name in HEIGHT_FIELDS if name in names), None)
            where = self._selection_clause(job_id, value["selectionId"], info) if value.get("selectionId") else "true"
            geom = "f." + ident(GEOM)
            polygon = "ST_GeometryType(" + geom + ") IN ('POLYGON','MULTIPOLYGON')"
            valid = "(" + polygon + ") AND ST_IsValid(" + geom + ") AND NOT ST_IsEmpty(" + geom + ")"
            height = "TRY_CAST(f." + ident(field) + " AS DOUBLE)" if field else "NULL::DOUBLE"
            row = c.execute(
                "SELECT count(*),count(*) FILTER (WHERE " + polygon + "),"
                "count(*) FILTER (WHERE " + geom + " IS NOT NULL AND NOT (" + polygon + ")),"
                "count(*) FILTER (WHERE " + geom + " IS NULL OR NOT ST_IsValid(" + geom + ") OR ST_IsEmpty(" + geom + ")),"
                "count(*) FILTER (WHERE " + valid + "),"
                "coalesce(sum(CASE WHEN " + valid + " THEN ST_Area_Spheroid(" + geom + ") END),0),"
                "count(*) FILTER (WHERE isfinite(" + height + ") AND " + height + ">0),"
                "min(ST_XMin(" + geom + ")),min(ST_YMin(" + geom + ")),"
                "max(ST_XMax(" + geom + ")),max(ST_YMax(" + geom + "))"
                " FROM native_result.features f WHERE " + where
            ).fetchone()
            area = row[5]
            if not math.isfinite(area):
                raise ValueError("The source polygon area exceeds the supported numeric range.")
            return json_exact({
                "records": row[0], "sourceTotal": info["recordCount"],
                "geometry": {"polygonRecords": row[1], "nonPolygonRecords": row[2], "invalidRecords": row[3],
                             "areaRecords": row[4], "areaM2": area,
                             "areaRule": "Sum of valid whole polygon areas; overlapping records count separately.",
                             "measurement": "WGS84 ellipsoid (DuckDB ST_Area_Spheroid), square metres"},
                "height": {"field": field, "available": row[6] if field else None,
                           "unavailable": row[0] - row[6] if field else row[0],
                           "rule": "Positive finite original supplied height values only; no rendering defaults or floor-based estimates.",
                           "meaning": "Source supplied values may themselves be estimates; field presence does not establish measured height."},
                "extent": list(row[7:11]) if all(x is not None and math.isfinite(x) for x in row[7:11]) else None,
                "coverage": job.get("coverage", {}), "execution": "native-full-result",
                "provenance": {"sha256": info["sourceSha256"], "operation": job.get("operation"),
                               "release": job.get("release"), "scope": job.get("scope"),
                               "inputContract": job.get("inputContract")},
            })
