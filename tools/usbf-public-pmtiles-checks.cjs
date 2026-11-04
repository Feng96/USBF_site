/* Public archive integration. Staging uses only a local copy of the real release manifest. */
module.exports = async qa => {
  const fs = require('fs'), path = require('path'), { page: p, ok } = qa;
  const direct = process.env.PORTAL_PM_LIVE_URL;
  const raw = [], tiles = [], measurements = [], urls = new Set();
  if (direct) { qa.base = direct; qa.fixtures = false; }
  else {
    const manifest = fs.readFileSync('/lustre/isaac24/scratch/yfeng21/usbf_display_20261028/national_repack_recovery001/DISPLAY_MANIFEST_PUBLIC.json', 'utf8');
    await p.route('https://data.source.coop/**', route => {
      if (route.request().url().includes('/USBF_display/manifest.json')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: manifest });
      return route.continue();
    });
  }
  p.on('request', request => {
    const url = request.url();
    if (url.includes('/USBF_v1/') && url.includes('.parquet')) raw.push(url);
    if (url.includes('/USBF_display/') && url.includes('.pmtiles')) { tiles.push({ url, range: request.headers().range }); urls.add(url); }
  });
  await qa.open('?empty=1');
  const id = await p.evaluate(async () => { const l = await PortalLayers.add(PortalLayers.catalog.find(c => c.id === 'usbf-live'), { restore: true, throwOnError: true }); return l.id; });
  ok(await p.evaluate(id => PortalLayers.layers.get(id).renderTiled && portal.map.getSource(id).type === 'vector', id), 'The real national USBF connection uses a vector PMTiles source');
  const waitBuildings = async () => {
    await p.waitForFunction(id => {
      const l = PortalLayers.layers.get(id);
      return portal.map.isSourceLoaded(id) && portal.map.queryRenderedFeatures({ layers: l.renderIds.filter(k => portal.map.getLayer(k)) }).some(f => typeof f.properties.usbf_id === 'string');
    }, id, { timeout: 90000 });
  };
  for (const city of [ ['Washington, DC', -77.071, 38.912], ['New York', -73.9857, 40.7484], ['Los Angeles', -118.25, 34.05], ['Boston', -71.06, 42.36] ]) {
    const started = Date.now(), before = tiles.length;
    await p.evaluate(city => { portal.map.jumpTo({ center: city.slice(1), zoom: 16.5, pitch: 0, bearing: 0 }); }, city);
    await waitBuildings();
    const rows = await p.evaluate(id => { const l = PortalLayers.layers.get(id), features = portal.map.queryRenderedFeatures({ layers: l.renderIds.filter(k => portal.map.getLayer(k)) }); return { uniqueBuildings: new Set(features.map(f => f.properties.usbf_id)).size, fields: Object.keys(features[0].properties), sourceRelease: l.displayRelease.updated }; }, id);
    measurements.push({ city: city[0], readyMs: Date.now() - started, tileRequests: tiles.length - before, ...rows });
    ok(rows.uniqueBuildings > 0 && rows.fields.includes('height_m'), city[0] + ' renders real building IDs and supplied heights from public PMTiles');
    ok(raw.length === 0, city[0] + ' browsing reads no original GeoParquet');
  }
  await p.evaluate(() => { portal.map.jumpTo({ center: [-77.071, 38.912], zoom: 12, pitch: 0 }); });
  await waitBuildings();
  ok(raw.length === 0, 'The PMTiles footprint map works below the old zoom-14 restriction');
  await p.evaluate(() => { portal.map.jumpTo({ center: [-77.071, 38.912], zoom: 17, pitch: 0 }); });
  await waitBuildings();
  for (const zoom of [18, 17.5, 16.5, 17]) {
    const start = Date.now(), before = tiles.length;
    await p.evaluate(zoom => { portal.map.jumpTo({ zoom }); }, zoom);
    await waitBuildings(); measurements.push({ warmZoom: zoom, readyMs: Date.now() - start, tileRequests: tiles.length - before });
  }
  ok(raw.length === 0, 'Repeated real-data zooming keeps original-data reads at zero');
  const preview = await p.evaluate(id => {
    const l = PortalLayers.layers.get(id), f = portal.map.queryRenderedFeatures({ layers: l.renderIds.filter(k => portal.map.getLayer(k)) }).find(f => f.properties.usbf_id);
    PortalLayers.inspect(l, f); return { id: f.properties.usbf_id, height: f.properties.height_m };
  }, id);
  ok(await p.locator('[data-explorer-load-building]').isVisible(), 'A real displayed building offers explicit access to its original record');
  await p.locator('[data-explorer-load-building]').click();
  await p.waitForSelector('#data-workspace-panel:not([hidden])');
  ok(raw.length === 0, 'Inspecting a display fragment opens explicit scope preparation without silently loading a changing map view');
  const original = await p.evaluate(async ({id, buildingId}) => {
    const l = PortalLayers.layers.get(id), selected = PortalLayers.selection.feature;
    const b = turf.bbox(selected), x = Number(selected.properties.cx), y = Number(selected.properties.cy);
    if (Number.isFinite(x) && Number.isFinite(y)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    const mask = turf.bboxPolygon([b[0]-.0002,b[1]-.0002,b[2]+.0002,b[3]+.0002]);
    const range = PortalGISRange.value(mask, 'Explicit original-building test area', {kind:'box',crs:'EPSG:4326'});
    await PortalDataWorkspace.saveArea(range, range.label);
    const workset = await PortalAnalysisLayers.load(l, {range});
    const f = workset?.data?.features.find(f => f.properties.usbf_id === buildingId);
    if (!workset) throw Error(PortalAnalysisLayers.message(l)?.text||l.analysisState?.error||'The explicit original workset failed to load.');if (!f) throw Error('The selected building was absent from the explicitly loaded original workset.');
    PortalLayers.selectLayer(workset.id);PortalLayers.inspect(workset,f);PortalDataWorkspace.hide();
    return {id:f.properties.usbf_id,height:f.properties.height_m,fields:Object.keys(f.properties),geometry:f.geometry.type,area:PortalExplorer.footprintArea(workset,f),workset:workset.id};
  }, {id,buildingId:preview.id});
  ok(raw.length > 0 && original.id === preview.id && original.height === preview.height && original.area > 0 && original.fields.includes('footprint_license') && original.fields.includes('height_license'), 'The saved-area browser workset retains the real selected ID, supplied height, full footprint and component licenses');
  ok(original.fields.length===69&&['engineering_policy','original_wkb_sha','height_coverage_pixels'].every(name=>original.fields.includes(name)), 'The real browser workset preserves all 67 ordinary original attributes plus its two labelled display aliases');
  await qa.screenshot('public-pmtiles-desktop.png');
  const beforeMove = raw.length;
  await p.evaluate(() => { portal.map.jumpTo({ zoom: 17.4 }); }); await waitBuildings();
  ok(raw.length === beforeMove, 'Browsing after a real original read still makes no automatic GeoParquet request');
  await p.setViewportSize({ width: 390, height: 844 });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The public-data map fits a phone viewport');
  await qa.screenshot('public-pmtiles-phone.png');
  ok(tiles.length > 0 && tiles.every(x => !!x.range), 'Public PMTiles is fetched using bounded HTTP Range requests');
  ok(qa.errors.length === 0, 'No uncaught application errors with the actual national release');
  fs.writeFileSync(path.join(qa.out, 'public-pmtiles.json'), JSON.stringify({ passed: true, directPublicSite: !!direct, stagingManifestOnly: !direct, checks: qa.checks, measurements, rawRequests: raw.length, tileRequests: tiles.length, archives: Array.from(urls), preview, original }, null, 2));
};
