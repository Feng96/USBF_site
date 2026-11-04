"""Publish only tested native packages using this workflow's repository token."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request

repo = os.environ['GITHUB_REPOSITORY']
if repo != 'Feng96/USBF_site':
    raise RuntimeError('Release publication is restricted to the USBF repository.')
token = os.environ['GITHUB_TOKEN']
tag = os.environ.get('USBF_ENGINE_RELEASE_TAG', 'engine-v0.2.0-preview.1-r3')
root = Path(os.environ['USBF_RELEASE_ASSETS'])
base = 'https://api.github.com/repos/' + repo


def request(url, data, content_type='application/json'):
    item = urllib.request.Request(url, method='POST', data=data,
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                 'Content-Type': content_type, 'X-GitHub-Api-Version': '2022-11-28'})
    with urllib.request.urlopen(item, timeout=180) as response:
        return json.load(response)


packages = []
for metadata in sorted(root.glob('**/usbf-engine-*.json')):
    build = json.loads(metadata.read_text(encoding='utf-8'))
    acceptance = json.loads((metadata.parent / 'acceptance.json').read_text(encoding='utf-8'))
    if acceptance.get('passed') is not True:
        raise RuntimeError('A platform did not pass native acceptance.')
    asset = metadata.parent / build['asset']
    with asset.open('rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    if checksum != build['sha256'] or asset.stat().st_size != build['bytes']:
        raise RuntimeError('A package changed after testing.')
    packages.append((asset, build, acceptance))
expected = {('linux', 'x86_64'), ('windows', 'x86_64'), ('darwin', 'arm64'), ('darwin', 'x86_64')}
if {(b['platform'], b['architecture']) for _, b, _ in packages} != expected:
    raise RuntimeError('All four native targets must pass before publication.')
manifest = {'schema': 1, 'status': 'preview', 'version': packages[0][1]['version'],
            'revision': os.environ['GITHUB_SHA'], 'tag': tag,
            'message': 'Independent preview runtime. No publisher code signing or Apple notarization.',
            'platforms': {}}
for asset, build, acceptance in packages:
    system = {'darwin': 'macos'}.get(build['platform'], build['platform'])
    arch = {'x86_64': 'x64'}.get(build['architecture'], build['architecture'])
    key = system + '-' + arch
    manifest['platforms'][key] = {
        'label': {'linux': 'Linux x64', 'windows': 'Windows x64',
                  'macos': 'macOS ' + ('Apple Silicon' if arch == 'arm64' else 'Intel')}[system],
        'url': 'https://github.com/' + repo + '/releases/download/' + tag + '/' + asset.name,
        'sha256': build['sha256'], 'bytes': build['bytes'], 'signed': False,
        'signatureKind': build['signatureKind'], 'minimumOS': build['minimumOS'],
        'testedChecks': len(acceptance['checks'])}
document = root / 'engine-release-manifest.json'
document.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
notes = ('Self-contained preview runtime for large USBF tasks. Install into a chosen workspace; '
         'Projects, Results, Files, Cache and Engine share that parent. This release has no publisher '
         'code signing or Apple notarization. Each target passed its actual installer, Tk window, '
         'paired loopback API, geographic extraction, exact attributes, paginated table and '
         'data-preserving uninstall checks. See desktop-engine/README.md for requirements and limits.')
release = request(base + '/releases', json.dumps({'tag_name': tag, 'target_commitish': os.environ['GITHUB_SHA'],
                  'name': 'USBF Engine 0.2.0 preview · build ' + os.environ['GITHUB_RUN_NUMBER'],
                  'body': notes, 'draft': False, 'prerelease': True}).encode())
upload = release['upload_url'].split('{')[0]
for asset in [p[0] for p in packages] + [document]:
    request(upload + '?name=' + urllib.parse.quote(asset.name), asset.read_bytes(), 'application/octet-stream')
print(json.dumps({'release': release['html_url'], 'tag': tag, 'platforms': sorted(manifest['platforms'])}))
