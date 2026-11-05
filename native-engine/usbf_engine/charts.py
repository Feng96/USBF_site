"""Bounded chart aggregates over complete original records or frozen selections."""
from __future__ import annotations

import math
import re
import time
import uuid

from .results import GEOM
from .runtime import ident
from .validation import json_exact


def scalar(kind):
    return not any(part in kind.upper() for part in ("STRUCT", "MAP", "BLOB", "GEOMETRY", "[]", "LIST", "UNION", "ARRAY"))


def numeric(kind):
    return bool(re.match(r"^(?:U?HUGEINT|U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|FLOAT|DOUBLE|DECIMAL|REAL)", kind.upper()))


def request_uuid(value):
    if not isinstance(value, str):
        raise ValueError("Choose a valid chart request identifier.")
    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError):
        raise ValueError("Choose a valid chart request identifier.") from None


def category_label(value):
    if value is None:
        return "Not provided"
    if value == "":
        return "Empty string"
    if isinstance(value, bool):
        return str(value).lower()
    return str(value)


class ChartsMixin:
    def _chart_registry(self):
        with self.mutex:
            if not hasattr(self, "_chart_connections"):
                self._chart_connections = {}
                self._chart_cancelled = {}
            now = time.monotonic()
            self._chart_cancelled = {key: stamp for key, stamp in self._chart_cancelled.items() if now - stamp < 300}
            return self._chart_connections

    def cancel_chart(self, job_id, value):
        if not isinstance(value, dict) or set(value) != {"requestId"}:
            raise ValueError("Choose an active chart request.")
        request_id = request_uuid(value["requestId"])
        self.get_job(job_id)
        registry = self._chart_registry()
        key = (job_id, request_id)
        with self.mutex:
            self._chart_cancelled[key] = time.monotonic()
            connection = registry.get(key)
            if connection is not None:
                connection.interrupt()
        return {"cancelled": True, "active": connection is not None}

    def result_chart(self, job_id, value):
        allowed = {"kind", "field", "group", "bins", "maxGroups", "selectionId", "positiveOnly", "requestId"}
        if not isinstance(value, dict) or set(value) - allowed:
            raise ValueError("Unsupported chart options.")
        kind = value.get("kind", "histogram")
        if kind not in {"schema", "histogram", "category", "grouped"}:
            raise ValueError("Choose a distribution, category count or grouped mean chart for complete native results.")
        bins, maximum = value.get("bins", 10), value.get("maxGroups", 10)
        if isinstance(bins, bool) or not isinstance(bins, int) or not 2 <= bins <= 30:
            raise ValueError("Choose between 2 and 30 chart groups.")
        if isinstance(maximum, bool) or not isinstance(maximum, int) or not 2 <= maximum <= 30:
            raise ValueError("Choose between 2 and 30 category groups.")
        positive = value.get("positiveOnly", False)
        if not isinstance(positive, bool):
            raise ValueError("The positive-value option must be true or false.")
        if kind == "category" and positive:
            raise ValueError("Positive-only filtering applies to numerical charts.")
        request_id = request_uuid(value["requestId"]) if value.get("requestId") else str(uuid.uuid4())
        key, registry = (job_id, request_id), self._chart_registry()
        job = self.get_job(job_id)
        with self.mutex:
            if key in self._chart_cancelled:
                raise ValueError("Chart calculation cancelled.")
        with self._indexed_result(job_id) as (connection, info):
            columns = {col["name"]: col["type"] for col in info["columns"]}
            schema = [{"name": name, "type": dtype, "scalar": scalar(dtype), "numeric": numeric(dtype)} for name, dtype in columns.items()]
            if kind == "schema":
                return {"kind": kind, "columns": schema, "records": info["recordCount"], "sourceSha256": info["sourceSha256"],
                        "execution": "native-full-result", "chartKinds": ["histogram", "category", "grouped"]}
            field, group = value.get("field"), value.get("group")
            virtual = field in {"$area_m2", "$length_m"}
            if not virtual and (field not in columns or not scalar(columns[field])):
                raise ValueError("Choose an original scalar field for this chart.")
            if kind == "category" and virtual:
                raise ValueError("Choose an original category field.")
            if kind == "grouped" and (group not in columns or not scalar(columns[group])):
                raise ValueError("Choose an original scalar category field.")
            expression = "f." + ident(field) if not virtual else (
                "CASE WHEN ST_GeometryType(f." + ident(GEOM) + ") IN ('POLYGON','MULTIPOLYGON') THEN ST_Area_Spheroid(f." + ident(GEOM) + ") END" if field == "$area_m2" else
                "CASE WHEN ST_GeometryType(f." + ident(GEOM) + ") IN ('POLYGON','MULTIPOLYGON') THEN ST_Perimeter_Spheroid(f." + ident(GEOM) + ") ELSE ST_Length_Spheroid(f." + ident(GEOM) + ") END")
            where = self._selection_clause(job_id, value["selectionId"], info) if value.get("selectionId") else "true"
            number = "TRY_CAST(" + expression + " AS DOUBLE)"
            valid = "isfinite(v)" + (" AND v>0" if positive else "")
            group_expression = "f." + ident(group) if kind == "grouped" else "NULL"
            base = "WITH vals AS (SELECT " + expression + " AS original," + number + " AS v," + group_expression + " AS g FROM native_result.features f WHERE " + where + ") "
            with self.mutex:
                if key in self._chart_cancelled:
                    raise ValueError("Chart calculation cancelled.")
                if key in registry:
                    raise ValueError("This chart request is already running.")
                registry[key] = connection
            try:
                row = connection.execute(base + "SELECT count(*),count(*) FILTER (WHERE original IS NULL),count(*) FILTER (WHERE original IS NOT NULL AND (v IS NULL OR NOT isfinite(v))),count(*) FILTER (WHERE isfinite(v) AND v<=0),count(*) FILTER (WHERE " + valid + "),min(v) FILTER (WHERE " + valid + "),max(v) FILTER (WHERE " + valid + ") FROM vals").fetchone()
                records, missing, invalid, nonpositive, valid_count, low, high = row
                result = {"kind": kind, "field": field, "records": records, "sourceTotal": info["recordCount"], "missing": missing,
                          "invalid": invalid if kind != "category" else 0, "excludedNonpositive": nonpositive if positive else 0,
                          "valid": valid_count if kind != "category" else records-missing, "positiveOnly": positive,
                          "execution": "native-full-result", "sourceSha256": info["sourceSha256"], "requestId": request_id,
                          "selectionId": value.get("selectionId"), "coverage": job.get("coverage", {}),
                          "numericEncoding": "Derived numerical bins and statistics use double precision; original source attributes remain unchanged.",
                          "provenance": {"release": job.get("release"), "scope": job.get("scope"), "sourceSha256": info["sourceSha256"],
                                         "inputContract": job.get("inputContract"), "featureCount": records}}
                if kind == "histogram":
                    result["rows"] = []
                    if valid_count:
                        if low == high:
                            padding = max(abs(low)*.05, 1)
                            low, high = low-padding, high+padding
                        step = (high-low)/bins
                        if not math.isfinite(step) or step <= 0:
                            raise ValueError("Values exceed the supported chart range.")
                        counts = dict(connection.execute(base + "SELECT least(?,greatest(0,CAST(floor((v-?)/?) AS BIGINT))) AS bucket,count(*) FROM vals WHERE " + valid + " GROUP BY bucket", [bins-1, low, step]).fetchall())
                        result["rows"] = [{"low": low+step*i, "high": low+step*(i+1), "count": counts.get(i, 0)} for i in range(bins)]
                elif kind == "category":
                    query = "WITH categories AS (SELECT " + expression + " AS category FROM native_result.features f WHERE " + where + ") SELECT category,count(*) AS n FROM categories GROUP BY category ORDER BY n DESC,CAST(category AS VARCHAR) ASC NULLS LAST LIMIT ?"
                    grouped = connection.execute(query, [maximum+1]).fetchall()
                    extra = len(grouped) > maximum
                    chosen = grouped[:maximum-1] if extra else grouped
                    result["rows"] = [{"value": item, "label": category_label(item), "count": count, "missing": item is None, "empty": item == ""} for item, count in chosen]
                    if extra:
                        result["rows"].append({"label": "Other categories", "count": records-sum(count for _,count in chosen), "other": True})
                else:
                    groups = connection.execute(base + "SELECT g,count(*) AS observations,count(*) FILTER (WHERE " + valid + "),avg(v) FILTER (WHERE " + valid + "),median(v) FILTER (WHERE " + valid + "),sum(v) FILTER (WHERE " + valid + "),min(v) FILTER (WHERE " + valid + "),max(v) FILTER (WHERE " + valid + ") FROM vals GROUP BY g ORDER BY observations DESC,CAST(g AS VARCHAR) ASC NULLS LAST LIMIT ?", [maximum+1]).fetchall()
                    extra = len(groups) > maximum
                    chosen = groups[:maximum-1] if extra else groups
                    result.update(valueField=field, groupField=group)
                    result["rows"] = [{"value": g, "label": category_label(g), "observations": observations, "valid": count, "missing": observations-count, "mean": mean, "median": median, "sum": total, "min": minimum, "max": maximum_value} for g,observations,count,mean,median,total,minimum,maximum_value in chosen]
                    if extra:
                        clauses, parameters = [], []
                        for item in chosen:
                            if item[0] is None:
                                clauses.append("g IS NOT NULL")
                            else:
                                clauses.append("g IS DISTINCT FROM ?")
                                parameters.append(item[0])
                        others = connection.execute(base + "SELECT count(*),count(*) FILTER (WHERE " + valid + "),avg(v) FILTER (WHERE " + valid + "),median(v) FILTER (WHERE " + valid + "),sum(v) FILTER (WHERE " + valid + "),min(v) FILTER (WHERE " + valid + "),max(v) FILTER (WHERE " + valid + ") FROM vals WHERE " + " AND ".join(clauses), parameters).fetchone()
                        observations,count,mean,median,total,minimum,maximum_value = others
                        result["rows"].append({"label":"Other categories", "other":True, "observations":observations,"valid":count,"missing":observations-count,"mean":mean,"median":median,"sum":total,"min":minimum,"max":maximum_value})
                if any(isinstance(value, float) and not math.isfinite(value) for item in result["rows"] for value in item.values()):
                    raise ValueError("Values exceed the supported chart range.")
                with self.mutex:
                    if key in self._chart_cancelled:
                        raise ValueError("Chart calculation cancelled.")
                return json_exact(result)
            except Exception:
                with self.mutex:
                    cancelled = key in self._chart_cancelled
                if cancelled:
                    raise ValueError("Chart calculation cancelled.") from None
                raise
            finally:
                with self.mutex:
                    registry.pop(key, None)
                    self._chart_cancelled.pop(key, None)
