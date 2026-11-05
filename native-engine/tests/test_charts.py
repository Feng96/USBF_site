"""Full native chart fidelity, complete selections and request isolation."""
from contextlib import contextmanager
import hashlib
import json
import math
import os
from pathlib import Path
import statistics
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine import Engine
from usbf_engine.runtime import Runtime, sqlstr
from usbf_engine.server import serve

COUNT = 2520
CATEGORIES = [None, "", "0", "false", "A", "B"]
HEIGHTS = [None, "", "bad", "NaN", "Infinity", "-1", "0", "3.5", "10", "2e1"]


class NativeChartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parent = tempfile.TemporaryDirectory(prefix="usbf-charts-", dir=os.environ.get("USBF_ENGINE_TEST_DIR"))
        cls.extension = os.environ.get("USBF_SPATIAL_EXTENSION")
        if not cls.extension:
            runtime = Runtime(Path(cls.parent.name)/"extension")
            runtime.information()
            cls.extension = str(next(runtime.extension_dir.rglob("spatial.duckdb_extension")))

    @classmethod
    def tearDownClass(cls):
        cls.parent.cleanup()

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(dir=self.parent.name)
        self.root = Path(self.folder.name)
        self.engine = Engine(self.root, extension_path=self.extension, autostart=False)
        self.source = self.root/"Files"/"charts.parquet"
        with self.engine.runtime.connection() as connection:
            connection.execute("COPY (SELECT i::BIGINT AS source_row,(9007199254740993000+i)::BIGINT AS original_id,false AS flag,0::INTEGER AS zero,NULL::DOUBLE AS missing,7.0::DOUBLE AS constant,1e308::DOUBLE AS huge,CASE i%6 WHEN 0 THEN NULL WHEN 1 THEN '' WHEN 2 THEN '0' WHEN 3 THEN 'false' WHEN 4 THEN 'A' ELSE 'B' END AS category,CASE i%10 WHEN 0 THEN NULL WHEN 1 THEN '' WHEN 2 THEN 'bad' WHEN 3 THEN 'NaN' WHEN 4 THEN 'Infinity' WHEN 5 THEN '-1' WHEN 6 THEN '0' WHEN 7 THEN '3.5' WHEN 8 THEN '10' ELSE '2e1' END AS height,ST_SetCRS(ST_MakeEnvelope(-77+(i%100)*.0002,39+floor(i/100)*.0002,-77+(i%100)*.0002+.0001,39+floor(i/100)*.0002+.0001),'EPSG:4326') AS geometry FROM range(?) t(i)) TO "+sqlstr(self.source)+" (FORMAT PARQUET)",[COUNT])
        job = self.engine.create_job({"operation":"load","inputs":[{"kind":"file","path":"Files/charts.parquet"}]})
        self.engine._execute(job)
        self.job = self.engine.get_job(job["id"])
        self.assertEqual(self.job["status"],"completed",self.job["error"])
        self.job_id = self.job["id"]
        self.original_hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in (self.source,self.engine.result_path(self.job_id))}

    def tearDown(self):
        try:
            for path,digest in self.original_hashes.items():
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),digest)
        finally:
            self.engine.close()
            self.folder.cleanup()

    def chart(self,kind="histogram",field="height",**options):
        return self.engine.result_chart(self.job_id,{"kind":kind,"field":field,**options})

    def test_complete_result_and_original_schema_exceed_preview(self):
        self.assertEqual(len(self.engine.preview(self.job_id)["features"]),2000)
        schema=self.chart("schema")
        self.assertEqual(schema["records"],COUNT)
        columns={item["name"]:item for item in schema["columns"]}
        self.assertEqual(columns["original_id"]["type"],"BIGINT")
        self.assertEqual(columns["flag"]["type"],"BOOLEAN")
        self.assertEqual(columns["height"]["type"],"VARCHAR")
        self.assertEqual(schema["execution"],"native-full-result")
        histogram=self.chart(field="source_row",bins=7)
        self.assertEqual(histogram["records"],COUNT)
        self.assertEqual(sum(row["count"] for row in histogram["rows"]),COUNT)
        self.assertEqual(histogram["rows"][0]["low"],0)
        self.assertEqual(histogram["rows"][-1]["high"],COUNT-1)
        self.assertEqual(schema["sourceSha256"],self.job["result"]["sha256"])

    def test_categories_keep_exact_ids_false_zero_null_and_empty_string(self):
        for field,value,label in [("flag",False,"false"),("zero",0,"0"),("missing",None,"Not provided")]:
            with self.subTest(field=field):
                result=self.chart("category",field)
                self.assertEqual(result["rows"][0]["value"],value)
                self.assertEqual(result["rows"][0]["label"],label)
                self.assertEqual(result["rows"][0]["count"],COUNT)
        ids=self.chart("category","original_id",maxGroups=3)
        self.assertEqual(ids["rows"][0]["value"],"9007199254740993000")
        self.assertEqual(ids["rows"][1]["value"],"9007199254740993001")
        self.assertEqual(ids["rows"][-1]["count"],COUNT-2)
        full=self.chart("category","category",maxGroups=10)
        by_value={row["value"]:row for row in full["rows"]}
        self.assertTrue(by_value[None]["missing"])
        self.assertTrue(by_value[""]["empty"])
        self.assertEqual(by_value[""]["label"],"Empty string")
        self.assertEqual({row["count"] for row in full["rows"]},{COUNT//6})
        top=self.chart("category","category",maxGroups=3)
        self.assertEqual(len(top["rows"]),3)
        self.assertTrue(top["rows"][-1]["other"])
        self.assertEqual(top["rows"][-1]["count"],COUNT*4//6)
        self.assertEqual(sum(row["count"] for row in top["rows"]),COUNT)

    def test_height_rules_bin_every_finite_value_once(self):
        result=self.chart(bins=6,positiveOnly=True)
        self.assertEqual(result["records"],COUNT)
        self.assertEqual(result["missing"],252)
        self.assertEqual(result["invalid"],1008)
        self.assertEqual(result["excludedNonpositive"],504)
        self.assertEqual(result["valid"],756)
        self.assertEqual(sum(row["count"] for row in result["rows"]),756)
        self.assertEqual(result["rows"][0]["low"],3.5)
        self.assertEqual(result["rows"][-1]["high"],20)
        all_finite=self.chart(bins=30)
        self.assertEqual(all_finite["valid"],1260)
        self.assertEqual(sum(row["count"] for row in all_finite["rows"]),1260)

    def test_grouped_other_recomputes_complete_valid_statistics(self):
        result=self.chart("grouped",group="category",maxGroups=3,positiveOnly=True)
        self.assertEqual(sum(row["observations"] for row in result["rows"]),COUNT)
        self.assertEqual(sum(row["valid"] for row in result["rows"]),756)
        chosen={row["value"] for row in result["rows"] if not row.get("other")}
        for row in result["rows"]:
            expected=[];observations=0
            for index in range(COUNT):
                category=CATEGORIES[index%6]
                included=category not in chosen if row.get("other") else category==row["value"]
                if included:
                    observations+=1
                    try: number=float(HEIGHTS[index%10])
                    except (TypeError,ValueError): continue
                    if math.isfinite(number) and number>0: expected.append(number)
            self.assertEqual(row["observations"],observations)
            self.assertEqual(row["valid"],len(expected))
            self.assertEqual(row["missing"],observations-len(expected))
            self.assertAlmostEqual(row["mean"],statistics.mean(expected))
            self.assertEqual(row["median"],statistics.median(expected))
            self.assertEqual(row["sum"],sum(expected))

    def test_constants_empty_values_and_nonfinite_aggregate_refusal(self):
        constant=self.chart(field="constant",bins=5)
        self.assertEqual(sum(row["count"] for row in constant["rows"]),COUNT)
        self.assertTrue(all(row["low"]<row["high"] for row in constant["rows"]))
        empty=self.chart(field="missing",bins=3)
        self.assertEqual(empty["rows"],[])
        self.assertEqual(empty["missing"],COUNT)
        selection=self.engine.result_selection(self.job_id,{"ids":[]})
        none=self.chart(selectionId=selection["selectionId"])
        self.assertEqual(none["records"],0)
        self.assertEqual(none["rows"],[])
        with self.assertRaisesRegex(ValueError,"supported chart range"):
            self.chart("grouped","huge",group="flag")

    def test_selection_and_saved_area_include_records_beyond_preview(self):
        selected=self.engine.result_selection(self.job_id,{"ids":[self.job_id+":2500",self.job_id+":2519"]})
        exact=self.chart(field="source_row",bins=3,selectionId=selected["selectionId"])
        self.assertEqual(exact["records"],2)
        self.assertEqual(exact["sourceTotal"],COUNT)
        self.assertEqual(sum(row["count"] for row in exact["rows"]),2)
        self.assertEqual((exact["rows"][0]["low"],exact["rows"][-1]["high"]),(2500,2519))
        scope={"crs":"EPSG:4326","geometry":{"type":"Polygon","coordinates":[[[-77.00005,39.00495],[-76.99605,39.00495],[-76.99605,39.00515],[-77.00005,39.00515],[-77.00005,39.00495]]]}}
        area=self.engine.result_selection(self.job_id,{"scope":scope})
        self.assertEqual(area["count"],20)
        for field in ("$area_m2","$length_m"):
            geometry=self.chart(field=field,bins=4,selectionId=area["selectionId"],positiveOnly=True)
            self.assertEqual(geometry["records"],20)
            self.assertEqual(geometry["valid"],20)
            self.assertEqual(sum(row["count"] for row in geometry["rows"]),20)
            self.assertGreater(geometry["rows"][0]["low"],0)
        self.engine.result_selection(self.job_id,{"mode":"clear"})
        self.assertEqual(self.chart(field="source_row",selectionId=selected["selectionId"])["records"],2)

    def test_invalid_options_and_sql_names_cannot_change_original_records(self):
        for options in [{"field":"height\";DROP TABLE features;--"},{"kind":"grouped","field":"height","group":"category;DROP TABLE features"},{"bins":True},{"bins":31},{"maxGroups":1},{"positiveOnly":"true"},{"sql":"SELECT 1"}]:
            with self.subTest(options=options),self.assertRaises(ValueError):
                self.engine.result_chart(self.job_id,{"field":"height",**options})
        self.assertEqual(self.chart(field="source_row")["records"],COUNT)

    def test_cancellation_is_scoped_to_one_actual_chart_request(self):
        request_a,request_b=str(uuid.uuid4()),str(uuid.uuid4())
        entered,finished=threading.Event(),threading.Event()
        original=self.engine._indexed_result
        outcome=[]
        class SlowConnection:
            def __init__(self,connection): self.connection=connection
            def interrupt(self): self.connection.interrupt()
            def execute(self,*args,**kwargs):
                entered.set()
                self.connection.execute("SELECT sum(sin(i::DOUBLE)) FROM range(1000000000) t(i)")
                return self.connection.execute(*args,**kwargs)
        @contextmanager
        def indexed(job_id):
            with original(job_id) as (connection,info):
                yield (SlowConnection(connection) if threading.current_thread().name=="cancel-chart-a" else connection),info
        def compute():
            try: outcome.append(self.chart(requestId=request_a))
            except Exception as error: outcome.append(error)
            finally: finished.set()
        with mock.patch.object(self.engine,"_indexed_result",indexed):
            thread=threading.Thread(target=compute,name="cancel-chart-a")
            thread.start()
            try:
                self.assertTrue(entered.wait(10))
                other=self.chart(field="source_row",requestId=request_b)
                self.assertEqual(other["records"],COUNT)
                cancelled=self.engine.cancel_chart(self.job_id,{"requestId":request_a})
                self.assertTrue(cancelled["active"])
                self.assertTrue(finished.wait(10))
                self.assertIsInstance(outcome[0],ValueError)
                self.assertIn("cancel",str(outcome[0]).lower())
                self.assertEqual(self.chart(field="source_row")["records"],COUNT)
            finally:
                self.engine.cancel_chart(self.job_id,{"requestId":request_a})
                thread.join(10)
        self.assertNotIn((self.job_id,request_a),self.engine._chart_connections)

    def test_http_chart_and_cancel_require_pairing_and_trusted_origin(self):
        server=serve(self.engine,0,origins=["http://localhost:8765"])
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base="http://127.0.0.1:"+str(server.server_port)
        def request(path,body,token=None,origin="http://localhost:8765"):
            headers={"Origin":origin,"Content-Type":"application/json"}
            if token: headers["Authorization"]="Bearer "+token
            return urllib.request.urlopen(urllib.request.Request(base+path,data=json.dumps(body).encode(),headers=headers),timeout=20)
        try:
            token=json.load(request("/v1/pair",{"code":self.engine.pairing_code()}))["token"]
            for route,body in [("chart",{"kind":"category","field":"flag"}),("chart-cancel",{"requestId":str(uuid.uuid4())})]:
                path="/v1/jobs/"+self.job_id+"/"+route
                with self.assertRaises(urllib.error.HTTPError) as caught: request(path,body)
                self.assertEqual(caught.exception.code,401)
                with self.assertRaises(urllib.error.HTTPError) as caught: request(path,body,token,origin="http://evil.example")
                self.assertEqual(caught.exception.code,403)
            result=json.load(request("/v1/jobs/"+self.job_id+"/chart",{"kind":"category","field":"original_id","maxGroups":3},token))
            self.assertEqual(result["records"],COUNT)
            self.assertEqual(result["rows"][0]["value"],"9007199254740993000")
            for body in ({"requestId":1},{"requestId":[]},{"requestId":"bad"},{}):
                with self.subTest(cancelBody=body),self.assertRaises(urllib.error.HTTPError) as caught:
                    request("/v1/jobs/"+self.job_id+"/chart-cancel",body,token)
                self.assertEqual(caught.exception.code,400)
            with self.assertRaises(urllib.error.HTTPError) as caught:
                request("/v1/jobs/"+self.job_id+"/chart",{"field":"height","requestId":1},token)
            self.assertEqual(caught.exception.code,400)
            request_id=str(uuid.uuid4())
            self.assertTrue(json.load(request("/v1/jobs/"+self.job_id+"/chart-cancel",{"requestId":request_id},token))["cancelled"])
            with self.assertRaises(urllib.error.HTTPError) as caught:
                request("/v1/jobs/"+self.job_id+"/chart",{"kind":"histogram","field":"source_row","requestId":request_id},token)
            self.assertEqual(caught.exception.code,400)
        finally:
            server.shutdown();server.server_close();thread.join(5)


if __name__=="__main__":unittest.main()
