/* Independent OSM provider acceptance. Real upstream TileJSON and building tiles. */
module.exports = async qa => {
  const fs = require('fs'), { page: p, ok } = qa;
  if (process.env.PORTAL_OSM_LIVE_URL) { qa.base = process.env.PORTAL_OSM_LIVE_URL; qa.fixtures = false; }
  else await p.route('https://tiles.openfreemap.org/**', route => route.continue());
  const requests = [], forbidden = [];
  p.on('request', r => { if (r.url().startsWith('https://tiles.openfreemap.org/')) requests.push(r.url()); if (r.url().includes('/USBF_v1/') || r.url().includes('/vida/')) forbidden.push(r.url()); });
  await qa.open('?empty=1');
  await p.locator('[data-add-data]').first().click(); await p.locator('#catalog-search').fill('OSM');
  ok((await p.locator('#data-catalog-cards').innerText()).includes('OpenStreetMap buildings · OpenFreeMap'), 'Add Data search finds the independent OSM building layer');
  ok((await p.locator('#data-catalog-cards').innerText()).includes('VIDA US · OpenStreetMap subset'), 'The VIDA subset remains a separate explicitly named source');
  ok((await p.locator('#catalog-resources').innerText()).includes('OpenStreetMap · Original building data'), 'Raw OSM building geometry and tags have their own original-data entry');
  await p.locator('#close-data-dialog').click();
  const id = await p.evaluate(async () => { const c = PortalLayers.catalog.find(c => c.id === 'osm-buildings'); const l = await PortalLayers.add(c, { throwOnError: true }); return l.id; });
  const waitBuildings = () => p.waitForFunction(id => { const l = PortalLayers.layers.get(id); return portal.map.isSourceLoaded(id) && portal.map.queryRenderedFeatures({ layers: l.renderIds }).length > 0; }, id, { timeout: 90000 });
  await waitBuildings();
  ok(await p.evaluate(id => { const l = PortalLayers.layers.get(id); return l.cfg.sourceLayer === 'building' && l.cfg.tilejson === true && !l.cfg.fixedSource && portal.map.getSource(id).type === 'vector'; }, id), 'OSM is a direct TileJSON building source without a VIDA filter');
  ok(await p.evaluate(() => portal.map.getZoom() >= 13), 'Adding OSM from a national overview opens a neighborhood with visible buildings');
  const cities = [];
  for (const [name, lng, lat] of [['Washington, DC', -77.071, 38.912], ['New York', -73.9857, 40.7484], ['Los Angeles', -118.25, 34.05]]) {
    await p.evaluate(([lng, lat]) => { portal.map.jumpTo({ center: [lng, lat], zoom: 16.5, pitch: 0 }); }, [lng, lat]); await waitBuildings();
    const count = await p.evaluate(id => portal.map.queryRenderedFeatures({ layers: PortalLayers.layers.get(id).renderIds }).length, id); cities.push({ name, displayedFragments: count });
    ok(count > 0, name + ' renders actual independent OSM building tiles');
  }
  ok(forbidden.length === 0, 'Loading OSM never fetches VIDA or original USBF data');
  ok(await p.evaluate(id => { const l = PortalLayers.layers.get(id); return l.heightField === null && l.cfg.allowHeight === false && !l.renderIds.some(id => portal.map.getLayer(id)?.type === 'fill-extrusion'); }, id), 'Cartographic render heights are not promoted to measured heights or 3D buildings');
  ok(await p.evaluate(id => { const c = PortalAnalysisData.capabilities(PortalLayers.layers.get(id)); return c.attributePreview && !c.geometryAnalysis; }, id), 'Clipped OSM map tiles cannot masquerade as full analytical geometry');
  const project = await p.evaluate(async () => (await PortalProject.collect('Independent OSM map')).project);
  ok(project.layers.length === 1 && project.layers[0].kind === 'catalog' && project.layers[0].catalogId === 'osm-buildings', 'Project files preserve the independent OSM connection');
  await p.evaluate(async project => { await PortalProject.restore(await PortalProject.prepare(project)); }, project);
  await p.waitForFunction(() => { const l = PortalLayers.active; return l?.cfg.id === 'osm-buildings' && portal.map.isSourceLoaded(l.id) && portal.map.queryRenderedFeatures({ layers: l.renderIds }).length > 0; }, null, { timeout: 90000 });
  ok(await p.evaluate(() => PortalLayers.active.cfg.tilejson === true && !PortalLayers.active.cfg.fixedSource), 'Reopening the project reconnects direct OSM without converting it to a subset');
  await p.locator('#interface-language').selectOption('zh-CN');
  await qa.screenshot('independent-osm-desktop.png');
  await p.setViewportSize({ width: 390, height: 844 });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The independent OSM map fits the phone viewport');
  await qa.screenshot('independent-osm-phone.png');
  ok(requests.some(url => url.includes('/planet/latest')) && requests.some(url => url.endsWith('.pbf')), 'The provider serves real TileJSON and MVT requests');
  ok(!qa.errors.length, 'Independent OSM workflows have no uncaught application errors');
  fs.writeFileSync(qa.out + '/independent-osm.json', JSON.stringify({ passed: true, checks: qa.checks, cities, providerRequests: requests.length, forbiddenRequests: forbidden.length, directPublicSite: !!process.env.PORTAL_OSM_LIVE_URL }, null, 2));
};
