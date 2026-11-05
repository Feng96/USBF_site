"""Exercise the installed native HTTP/SQL runtime, never a browser fixture server."""
from __future__ import annotations
import json
from pathlib import Path
import time
import urllib.error
import urllib.request


def run(workspace: Path, report: Path) -> int:
    from launcher import backend, shutdown, build_info
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / 'Files').mkdir(exist_ok=True)
    features = []
    for index in range(3):
        x = -77.05 + index * 0.001
        features.append({'type': 'Feature', 'properties': {
            'original_id': '900719925474099312' + str(index + 3),
            'flag': False, 'missing_value': None}, 'geometry': {
            'type': 'Polygon', 'coordinates': [[[x, 38.9], [x + .0002, 38.9],
                [x + .0002, 38.9002], [x, 38.9002], [x, 38.9]]]}})
    source = workspace / 'Files' / 'packaging-fixture.geojson'
    source.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}), encoding='utf-8')
    engine, server = backend(workspace, 0, ['https://feng96.github.io'])
    base = 'http://127.0.0.1:' + str(server.server_address[1])
    token = None
    checks = []

    def request(method, path, data=None, origin='https://feng96.github.io', authenticated=True):
        headers = {'Origin': origin, 'Accept': 'application/json'}
        if data is not None:
            headers['Content-Type'] = 'application/json'
        if authenticated and token:
            headers['Authorization'] = 'Bearer ' + token
        item = urllib.request.Request(base + path, method=method, headers=headers,
            data=json.dumps(data).encode() if data is not None else None)
        with urllib.request.urlopen(item, timeout=60) as response:
            return json.load(response) if 'json' in response.headers.get('Content-Type', '') else response.read()

    def ok(condition, name):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    try:
        from usbf_engine.runtime import tls_context
        public_manifest = urllib.request.Request(
            'https://data.source.coop/opengeos/us-buildings/USBF_v1/manifest.json',
            headers={'User-Agent': 'USBF-Engine-acceptance/0.1'})
        with urllib.request.urlopen(public_manifest, context=tls_context(), timeout=60) as remote:
            publication = json.loads(remote.read(4 * 1024 * 1024))
        ok(publication.get('tiles', 0) > 0 and publication.get('buildings', 0) > 0,
           'The bundled certificate store verifies the real public USBF HTTPS source')
        ok(request('GET', '/v1/health', authenticated=False)['apiVersion'] == 1,
           'The packaged runtime serves the real loopback API')
        try:
            request('GET', '/v1/status', authenticated=False)
            raise AssertionError('Unpaired access succeeded')
        except urllib.error.HTTPError as error:
            ok(error.code == 401, 'Private status requires pairing')
        code = engine.pairing_code()
        if isinstance(code, dict):
            code = code['code']
        token = request('POST', '/v1/pair', {'code': code}, authenticated=False)['token']
        try:
            request('GET', '/v1/status', origin='https://untrusted.example')
            raise AssertionError('An untrusted website accessed the engine')
        except urllib.error.HTTPError as error:
            ok(error.code == 403, 'An untrusted origin cannot access the paired runtime')
        status = request('GET', '/v1/status')
        ok(bool(status), 'Paired status reports the actual runtime')
        ok(set(status['capabilities']['originalDataProviders']) >= {'osm-buildings', 'overture-buildings', 'gba-usa', 'dc-government', 'nyc-government'},
           'The installed runtime advertises its actual shared original-data provider readers')
        settings = request('GET', '/v1/maintenance')
        ok(settings['execution'] == 'local' and settings['automaticDeletion'] is False,
           'Native cache maintenance reports its real local data-preserving policy')
        configured = request('POST', '/v1/maintenance/settings', {'threads': 1, 'memoryMiB': 512})
        ok(configured['settings']['threads'] == 1 and configured['settings']['memoryMiB'] == 512,
           'Packaged runtime applies bounded native resource settings')
        diagnostics = request('GET', '/v1/diagnostics')
        ok(diagnostics['passed'] and not diagnostics['networkTested'],
           'Local diagnostics load the bundled spatial runtime and verify workspace/cache ownership')
        spec = {'schema': 1, 'operation': 'load',
                'inputs': [{'kind': 'file', 'path': 'Files/packaging-fixture.geojson'}],
                'scope': {'crs': 'EPSG:4326', 'label': 'Packaging test county',
                    'geometry': {'type': 'Polygon', 'coordinates': [[[-77.051, 38.899],
                        [-77.0485, 38.899], [-77.0485, 38.901], [-77.051, 38.901], [-77.051, 38.899]]]}}}
        plan = request('POST', '/v1/plan', spec)
        ok(bool(plan), 'Planning reads the actual source before execution')
        job = request('POST', '/v1/jobs', spec)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            job = request('GET', '/v1/jobs/' + job['id'])
            if job['status'] in ('completed', 'failed', 'partial', 'cancelled', 'interrupted'):
                break
            time.sleep(.1)
        ok(job['status'] == 'completed', 'Bundled DuckDB Spatial executes the geographic extraction')
        ok(job['result']['rows'] == 2, 'The output count matches the exact geographic mask')
        preview = request('GET', '/v1/jobs/' + job['id'] + '/preview?limit=1')
        properties = preview['features'][0]['properties']
        ok(len(preview['features']) == 1 and properties['original_id'] == '9007199254740993123'
           and properties['flag'] is False and properties['missing_value'] is None,
           'Bounded previews preserve original long IDs, nulls and boolean values')
        table = request('GET', '/v1/jobs/' + job['id'] + '/table?offset=1&limit=1')
        ok(bool(table), 'The installed result exposes paginated attributes')
        import pyarrow.parquet as pq
        original = pq.read_table(workspace / job['result']['path'])
        ok(original.num_rows == 2 and original.column('original_id').to_pylist()[0] == '9007199254740993123'
           and original.column('flag').to_pylist() == [False, False],
           'Bundled Arrow reads genuine GeoParquet without changing long identifiers or booleans')
        comparison = request('POST', '/v1/jobs/' + job['id'] + '/comparison-summary', {})
        ok(comparison['records'] == 2 and comparison['geometry']['polygonRecords'] == 2
           and comparison['geometry']['areaM2'] > 0 and comparison['execution'] == 'native-full-result',
           'The installed comparison endpoint aggregates complete original geometries')
        metadata = request('GET', '/v1/jobs/' + job['id'] + '/map')
        ok(metadata['recordCount'] == 2 and metadata['spatialIndex'] == 'DuckDB RTree',
           'The installed engine indexes every result record for full viewport browsing')
        condition = {'filters': [{'field': 'original_id', 'op': 'eq', 'value': '9007199254740993123'}]}
        matching = request('POST', '/v1/jobs/' + job['id'] + '/query', condition)
        ok(matching['total'] == 1 and matching['rows'][0]['properties']['flag'] is False,
           'Full native attribute queries preserve exact identifiers and original values')
        selected = request('POST', '/v1/jobs/' + job['id'] + '/selection', {'mode': 'replace', 'query': condition})
        ok(selected['count'] == 1, 'Native selection stores full-record query membership outside the preview')
        tile = request('GET', '/v1/jobs/' + job['id'] + '/tiles/0/0/0.pbf')
        ok(isinstance(tile, bytes) and len(tile) > 0, 'The packaged engine produces real MapLibre MVT bytes')
        cleanup = request('POST', '/v1/maintenance/cleanup', {'dryRun': True, 'allUnused': True})
        ok(cleanup['dryRun'] and cleanup['userDataKept'] and cleanup['unfinishedTasksKept'],
           'Packaged native cleanup previews disposable files without deleting user data')
        result = {'passed': True, 'checks': checks, 'build': build_info(),
                  'resultRows': job['result']['rows']}
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        return 0
    except Exception as error:
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps({'passed': False, 'checks': checks,
                                     'error': str(error)}, indent=2) + '\n', encoding='utf-8')
        raise
    finally:
        shutdown(engine, server)
