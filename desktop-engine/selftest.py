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
            return json.load(response)

    def ok(condition, name):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    try:
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
