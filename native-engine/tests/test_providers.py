"""Unified native provider fixtures: real typed Parquet and checked HTTP ranges."""
import io
import json
import os
import re
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock
from urllib.parse import parse_qs, urlparse

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine import Engine
from usbf_engine import providers
from usbf_engine.providers import HTTPRangeFile, candidate_row_groups, provider_url
from usbf_engine.runtime import Runtime
from usbf_engine.validation import public_url
from test_engine import wait

BOX = [-.1, -.1, .1, .1]
POLYGON = {"type":"Polygon", "coordinates":[[[-.05,-.05],[1,-.05],[1,.05],[-.05,.05],[-.05,-.05]]]}
SCOPE = {"label":"Corner intersects; centroid outside", "crs":"EPSG:4326", "geometry":{"type":"Polygon", "coordinates":[[[-.1,-.1],[.1,-.1],[.1,.1],[-.1,.1],[-.1,-.1]]]}}


class Response(io.BytesIO):
    def __init__(self, raw, status=206, headers=None):
        super().__init__(raw); self.status=status; self.headers=headers or {}


class ProviderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = tempfile.TemporaryDirectory(prefix="usbf-providers-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        cls.extension = os.environ.get("USBF_SPATIAL_EXTENSION")
        if not cls.extension:
            runtime=Runtime(Path(cls.base.name)/"runtime"); runtime.information()
            cls.extension=str(next(runtime.extension_dir.rglob("spatial.duckdb_extension")))

    @classmethod
    def tearDownClass(cls): cls.base.cleanup()

    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(dir=self.base.name)
        self.engine=Engine(self.directory.name,extension_path=self.extension)
        self.requests=[]; self.tag='"fixture-v1"'; self.files={}
        self.transport=mock.patch.object(providers,"provider_open",self.open); self.transport.start()
        self.validation=mock.patch.object(providers,"public_url",lambda value:public_url(value,resolve=False));self.validation.start()

    def tearDown(self):
        self.engine.close();self.validation.stop();self.transport.stop();self.directory.cleanup()

    def open(self,url,*,headers=None):
        data=self.files[url]; match=re.fullmatch(r"bytes=(\d+)-(\d+)",headers["Range"])
        start,end=map(int,match.groups());self.requests.append((url,start,end))
        return Response(data[start:end+1],headers={"Content-Range":f"bytes {start}-{end}/{len(data)}","ETag":self.tag,"Last-Modified":"Thu, 05 Nov 2026 12:00:00 GMT"})

    def parquet(self, *, null_bbox=False):
        # Three groups, one full crossing outline; exact BIGINT, nested list,
        # strings, boolean and explicit all-null DOUBLE remain unchanged.
        with self.engine.runtime.connection() as c:
            geometry=c.execute("SELECT ST_AsWKB(ST_GeomFromGeoJSON(?))",[json.dumps(POLYGON)]).fetchone()[0]
        bbox_type=pa.struct([("xmin",pa.float64()),("ymin",pa.float64()),("xmax",pa.float64()),("ymax",pa.float64())])
        schema=pa.schema([("id",pa.int64()),("height",pa.string()),("flag",pa.bool_()),("missing",pa.float64()),("nested",pa.list_(pa.string())),("region",pa.string()),("timestamp",pa.timestamp("us",tz="UTC")),("bbox",bbox_type),("geometry",pa.binary())],metadata={b"geo":json.dumps({"version":"1.1.0","primary_column":"geometry","columns":{"geometry":{"encoding":"WKB","geometry_types":["Polygon"]}}}).encode()})
        rows=[]
        for i,b in enumerate([[10,10,11,11],[-.05,-.05,1,.05],[20,20,21,21]]):
            rows.append({"id":9007199254740993120+i,"height":"33.4900000000000000000001","flag":False,"missing":None,"nested":["x","y"],"region":"USA","timestamp":datetime(2026,11,1,14,35,59,tzinfo=timezone.utc),"bbox":None if null_bbox else dict(zip(("xmin","ymin","xmax","ymax"),b)),"geometry":geometry})
        output=io.BytesIO();pq.write_table(pa.Table.from_pylist(rows,schema=schema),output,row_group_size=1,compression="zstd")
        return output.getvalue()

    def spec(self,provider,**extra):
        return {"schema":1,"operation":"extract-mask","inputs":[{"kind":"provider","providerId":provider}],"scope":SCOPE,**extra}

    def test_range_pruning_exact_whole_geometry_original_fields_and_operations(self):
        self.files[providers.OSM]=self.parquet()
        result=wait(self.engine,self.engine.create_job(self.spec("osm-buildings",operation="measure")))
        self.assertEqual(result["status"],"completed",result["error"])
        self.assertEqual(result["result"]["rows"],1)
        part=result["parts"][0];self.assertEqual(part["transport"]["selectedRowGroups"],1)
        self.assertEqual(part["transport"]["totalRowGroups"],3)
        self.assertFalse(part["sourceRelease"]["immutable"])
        feature=self.engine.preview(result["id"])["features"][0]
        self.assertEqual(feature["geometry"],POLYGON)
        self.assertEqual(feature["properties"]["id"],"9007199254740993121")
        self.assertEqual(feature["properties"]["height"],"33.4900000000000000000001")
        self.assertIs(feature["properties"]["flag"],False)
        self.assertIsNone(feature["properties"]["missing"])
        self.assertEqual(feature["properties"]["nested"],["x","y"])
        self.assertEqual(feature["properties"]["timestamp"],"2026-11-01T14:35:59+00:00")
        self.assertGreater(feature["properties"]["_usbf_area_m2"],0)
        self.assertTrue(result["coverage"]["requestComplete"])
        self.assertIsNone(result["coverage"]["providerCompleteness"])
        with self.engine.runtime.connection() as c:
            fields=dict((r[0],r[1]) for r in c.execute("DESCRIBE SELECT * FROM read_parquet(?)",[str(self.engine.result_path(result["id"]))]).fetchall())
        self.assertEqual(fields["missing"],"DOUBLE");self.assertEqual(fields["id"],"BIGINT")

    def test_null_or_missing_bbox_statistics_never_skip_geometry(self):
        data=self.parquet(null_bbox=True);meta=pq.ParquetFile(io.BytesIO(data)).metadata
        self.assertEqual(candidate_row_groups(meta,BOX),[0,1,2])

    def test_float32_bbox_rounding_cannot_exclude_a_touching_outline(self):
        # -77.07 rounded to float32 lies east of the actual geometry edge.
        # The AOI stops between those values: exact geometry still intersects.
        kind=pa.struct([(name,pa.float32()) for name in ("xmin","ymin","xmax","ymax")])
        table=pa.table({"bbox":pa.array([{"xmin":-77.07,"ymin":38.9,"xmax":-77.06,"ymax":39.0}],type=kind)})
        output=io.BytesIO();pq.write_table(table,output)
        metadata=pq.ParquetFile(io.BytesIO(output.getvalue())).metadata
        self.assertEqual(candidate_row_groups(metadata,[-77.071,38.95,-77.0699999,38.96]),[0])

    def test_etag_change_refuses_mixed_release_and_can_resume_original_identity(self):
        self.files[providers.OSM]=self.parquet()
        self.engine.close();self.engine=Engine(self.directory.name,extension_path=self.extension,autostart=False)
        job=self.engine.create_job(self.spec("osm-buildings"));self.tag='"changed"'
        self.engine._execute(job);failed=self.engine.get_job(job["id"])
        self.assertEqual(failed["status"],"failed");self.assertFalse(failed["coverage"]["requestComplete"])
        self.assertIn("changed",failed["parts"][0]["error"])
        self.tag='"fixture-v1"'; resumed=self.engine.resume(job["id"]);self.engine._execute(resumed)
        self.assertEqual(self.engine.get_job(job["id"])["status"],"completed")

    def test_refused_range_never_reads_whole_body(self):
        response=mock.MagicMock();response.__enter__.return_value=response;response.status=200
        with self.assertRaisesRegex(ValueError,"whole file was refused"):
            HTTPRangeFile(providers.OSM,opener=lambda *a,**k:response)
        response.read.assert_not_called()

    def test_contract_scope_and_endpoint_allowlist(self):
        for bad in [{"kind":"provider","providerId":"unknown"},{"kind":"provider","providerId":"osm-buildings","url":"https://example.com/a"},{"kind":"provider","providerId":"osm-buildings","sql":"DROP TABLE source"}]:
            with self.assertRaises(ValueError): self.engine.plan({"operation":"load","inputs":[bad],"scope":SCOPE})
        with self.assertRaisesRegex(ValueError,"fixed area"):
            self.engine.plan({"operation":"load","inputs":[{"kind":"provider","providerId":"osm-buildings"}]})
        for url in ["https://data.openstreetmap.us/other.parquet","https://stac.overturemaps.org/../../catalog.json","https://data.cityofnewyork.us/resource/other.json","https://data.source.coop/other/bad.parquet"]:
            with self.assertRaises(ValueError): provider_url(url)
        self.assertEqual(self.engine.status()["capabilities"]["originalDataProviders"],list(providers.PROVIDER_IDS))

    def test_gba_uses_all_manifest_files_never_nominal_tile_exclusion(self):
        plan=self.engine.plan(self.spec("gba-usa"))
        manifest=json.loads(Path(providers.__file__).with_name("gba-usa-index.json").read_text())
        self.assertEqual(len(plan["parts"]),len(manifest["tiles"]))
        self.assertTrue(all(p["regionFilter"]=="USA" for p in plan["parts"]))
        self.assertTrue(all(p["geometryBoundsGuaranteed"] for p in plan["parts"]))

    def test_overture_stac_pins_requested_release_and_keeps_nested_attributes(self):
        url="https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=buildings/type=building/part-0.parquet"
        self.files[url]=self.parquet()
        index=io.BytesIO();pq.write_table(pa.Table.from_pylist([{"collection":"building","type":"Feature","bbox":dict(zip(("xmin","ymin","xmax","ymax"),BOX)),"assets":{"aws":{"href":url}}}]),index)
        self.files[providers.STAC+"/2026-10-21.0/collections.parquet"]=index.getvalue()
        self.engine._provider_json=lambda url:{"latest":"2026-10-21.0","links":[{"rel":"child","href":"https://stac.overturemaps.org/2026-10-21.0/catalog.json"}]}
        spec=self.spec("overture-buildings");spec["inputs"][0]["releaseId"]="2026-10-21.0"
        task=wait(self.engine,self.engine.create_job(spec));self.assertEqual(task["status"],"completed",task["error"])
        self.assertEqual(task["parts"][0]["sourceRelease"]["releaseId"],"2026-10-21.0")
        self.assertEqual(task["result"]["rows"],1)
        empty_spec=self.spec("overture-buildings")
        empty_spec["scope"]={"geometry":{"type":"Polygon","coordinates":[[[50,50],[51,50],[51,51],[50,51],[50,50]]]}}
        empty=wait(self.engine,self.engine.create_job(empty_spec))
        self.assertEqual(empty["status"],"completed",empty["error"])
        self.assertEqual(empty["result"]["rows"],0)
        self.assertIn({"name":"id","type":"BIGINT"},self.engine.table(empty["id"])["columns"])

    def api_fixture(self,provider,empty=False,omit=False):
        revision={"fields":[{"name":"OBJECTID","type":"esriFieldTypeOID"},{"name":"code","type":"esriFieldTypeSmallInteger"},{"name":"height","type":"esriFieldTypeDouble"},{"name":"capture","type":"esriFieldTypeDate"}],"objectIdField":"OBJECTID","editingInfo":None} if provider=="dc-government" else {"rowsUpdatedAt":123,"viewLastModified":123,"columns":[{"fieldName":"the_geom","dataTypeName":"multipolygon"},{"fieldName":"objectid","dataTypeName":"number"},{"fieldName":"height_roof","dataTypeName":"number"}]}
        self.engine._api_revision=lambda name:revision
        ids=[] if empty else [1,2] if provider=="dc-government" else ["row-a~b.c","row-d~e.f"]
        def respond(url):
            query=parse_qs(urlparse(url).query)
            if provider=="dc-government":
                if "returnIdsOnly" in query:return {"objectIds":ids,"objectIdFieldName":"OBJECTID"}
                features=[{"type":"Feature","id":i,"geometry":POLYGON,"properties":{"OBJECTID":i,"code":2000,"height":None,"capture":1743048000000}} for i in ids]
                return {"type":"FeatureCollection","features":features[:-1] if omit else features}
            if query.get("$select")==["count(*)"]:return [{"count":str(len(ids))}]
            if query.get("$select")==[":id"]:return [{":id":i} for i in ids]
            records=[{"the_geom":POLYGON,"objectid":str(i),"height_roof":"33.490000000000000000001","__usbf_snapshot_id":key} for i,key in enumerate(ids)]
            return records[:-1] if omit else records
        self.engine._provider_json=respond

    def test_official_apis_share_exact_geometry_typed_result_and_coverage(self):
        for provider in ["dc-government","nyc-government"]:
            with self.subTest(provider=provider):
                self.api_fixture(provider)
                task=wait(self.engine,self.engine.create_job(self.spec(provider)))
                self.assertEqual(task["status"],"completed",task["error"])
                self.assertEqual(task["result"]["rows"],2)
                self.assertTrue(task["coverage"]["requestComplete"])
                self.assertFalse(task["coverage"]["snapshotIsolation"])
                features=self.engine.preview(task["id"])["features"]
                self.assertEqual(features[0]["geometry"],POLYGON)
                if provider=="nyc-government":
                    self.assertEqual(features[0]["properties"]["height_roof"],"33.490000000000000000001")
                else:
                    self.assertIsNone(features[0]["properties"]["height"])
                    self.assertEqual(features[0]["properties"]["capture"],1743048000000)

    def test_api_missing_source_ids_fail_instead_of_publishing_incomplete_result(self):
        self.api_fixture("dc-government",omit=True)
        task=wait(self.engine,self.engine.create_job(self.spec("dc-government")))
        self.assertEqual(task["status"],"failed")
        self.assertFalse(task["coverage"]["requestComplete"])
        self.assertIsNone(task["result"])
        self.api_fixture("dc-government")
        done=wait(self.engine,self.engine.resume(task["id"]))
        self.assertEqual(done["status"],"completed",done["error"])

    def test_empty_api_result_retains_schema(self):
        self.api_fixture("dc-government",empty=True)
        task=wait(self.engine,self.engine.create_job(self.spec("dc-government")))
        self.assertEqual(task["status"],"completed",task["error"])
        self.assertEqual(task["result"]["rows"],0)
        self.assertTrue(task["coverage"]["requestComplete"])
        self.assertIn({"name":"height","type":"DOUBLE"},self.engine.table(task["id"])["columns"])

if __name__=="__main__":unittest.main()
