/* Real DOM acceptance: locale boundaries, dynamic dialogs and sidebar state. */
module.exports = async qa => {
  const fs = require('fs'), { page, ok } = qa;
  if (process.env.PORTAL_I18N_LIVE_URL) { qa.fixtures = false; qa.base = process.env.PORTAL_I18N_LIVE_URL; }
  await qa.open();
  const panel = () => page.evaluate(() => ({ open: PortalSidebar.isOpen, tab: PortalSidebar.tab, expanded: document.querySelector('.models-tool').getAttribute('aria-expanded'), current: PortalModels.current?.id, camera: portal.map.getCenter().toArray(), zoom: portal.map.getZoom() }));
  const baseline = await panel();
  await page.locator('.models-tool').click();
  let state = await panel();
  ok(state.open && state.tab === 'models' && state.expanded === 'true', 'Models opens the models panel');
  ok(state.current === baseline.current && state.zoom === baseline.zoom && JSON.stringify(state.camera) === JSON.stringify(baseline.camera), 'Opening Models does not load a sample or change the camera');
  await page.locator('.models-tool').click();
  ok(!(await panel()).open && (await panel()).expanded === 'false', 'A second Models click collapses the panel');
  await page.locator('.models-tool').click();
  ok((await panel()).open, 'Models reopens a collapsed desktop sidebar');
  await page.locator('[data-action=layers]').click();
  ok((await panel()).open && (await panel()).tab === 'layers', 'Layers switches from Models to Layers');
  await page.locator('[data-action=layers]').click();
  ok(!(await panel()).open, 'A second Layers click collapses the panel');
  await page.locator('[data-action=layers]').click();

  await page.locator('#interface-language').selectOption('zh-CN');
  await page.waitForFunction(() => document.querySelector('[data-add-data] span:last-child').textContent === '添加数据');
  ok(await page.locator('.models-tool').innerText() === '3D 模型', 'Toolbar switches to Chinese without a page reload');
  ok(await page.evaluate(() => document.documentElement.lang === 'zh-CN' && localStorage.getItem('usbf.interface-language') === 'zh-CN'), 'Chinese language is accessible and persisted');
  const id = await page.evaluate(async fixture => {
    fixture.features[0].properties.label = 'Layers';
    fixture.features[0].properties.source = 'Download';
    fixture.features[0].properties.method = 'LoD2 / GeoJSON / EPSG:4326';
    const layer = await PortalLayers.addGeoJSON('Layers', fixture, { heightField: 'height_m', attribution: 'Source' });
    window.localeFixtureBefore = JSON.stringify(layer.data);
    return layer.id;
  }, JSON.parse(JSON.stringify(qa.buildings)));
  await page.waitForFunction(id => !!document.querySelector('[data-added-row="' + id + '"]'), id);
  ok(await page.locator('[data-layer-activate="' + id + '"]').innerText() === 'Layers', 'A data layer named Layers remains untranslated');
  await page.locator('[data-added-row="' + id + '"] summary').click();
  await page.waitForFunction(id => document.querySelector('[data-added-row="' + id + '"] summary').textContent === '图层设置', id);
  ok(await page.locator('[data-added-row="' + id + '"] [data-added-zoom]').innerText() === '定位图层', 'Dynamically created layer controls use Chinese');
  await page.evaluate(id => {
    const layer = PortalLayers.layers.get(id);
    PortalLayers.inspect(layer, layer.data.features[0]);
  }, id);
  ok((await page.locator('#properties-content').textContent()).includes('LoD2 / GeoJSON / EPSG:4326'), 'Feature properties retain technical terms verbatim');
  ok((await page.locator('#properties-content').textContent()).includes('Download'), 'A data attribute named Download is not translated');
  await page.evaluate(() => { portal.clearSelection(); });
  await page.evaluate(() => portal.toast('Model added. Use Download to save it with its location.'));
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('模型已添加'));
  ok(await page.locator('#toast').innerText() === '模型已添加。使用“下载”保存模型及其位置。', 'System notifications translate');

  for (const [api, close, marker, expected] of [
    ['PortalSettings', '[data-close-settings]', '#workspace-crs-form [type=submit]', '应用 CRS'],
    ['PortalAnalysis', '[data-analysis-close]', '#analysis-title', '统计与分析'],
    ['PortalComposer', '[data-close-composer]', '#map-composer-title', '保存地图'],
    ['PortalLocalModels', '[data-close-local-model]', '#local-model-dialog h2', '添加 3D 模型'],
    ['PortalProject', '[data-close-project]', '#project-dialog h2', '保存或打开地图']
  ]) {
    // Each API creates its dialog on demand, after the locale has changed.
    const exists = await page.evaluate(name => !!window[name]?.open, api);
    if (!exists) throw Error('Missing dialog API ' + api);
    await page.evaluate(name => { window[name].open(); }, api);
    await page.waitForTimeout(100);
    const headings = await page.locator('dialog[open]').innerText();
    ok(headings.includes(expected), api + ' creates a Chinese dialog');
    await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(el => el.close()); });
  }
  ok(await page.evaluate(id => JSON.stringify(PortalLayers.layers.get(id).data) === window.localeFixtureBefore, id), 'Dataset keys, values, geometry and numeric values are unchanged');
  await page.locator('#interface-language').selectOption('en');
  await page.waitForFunction(() => document.querySelector('.models-tool').textContent === '3D models');
  ok(await page.locator('[data-added-row="' + id + '"] summary').innerText() === 'Layer settings', 'Dynamically created UI switches back to English');
  ok(await page.locator('[data-layer-activate="' + id + '"]').innerText() === 'Layers', 'Data names survive both directions of locale switching');
  await page.evaluate(async () => { await PortalModels.open(PortalModels.manifest.models[0].id); });
  const selected = await page.evaluate(() => ({ id: PortalModels.current.id, method: PortalModels.method, enabled: PortalModels.enabled, data: JSON.stringify(PortalModels.current) }));
  await page.locator('.models-tool').click();
  ok(!(await panel()).open, 'Models collapses after opening a research sample directly');
  await page.locator('.models-tool').click();
  ok(await page.evaluate(before => PortalModels.current.id === before.id && PortalModels.method === before.method && PortalModels.enabled === before.enabled && JSON.stringify(PortalModels.current) === before.data, selected), 'Toggling retains the selected model, method and original model data');
  await page.locator('#interface-language').selectOption('zh-CN');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.portal?.ready && window.PortalModels?.ready);
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
  ok(await page.locator('#interface-language').inputValue() === 'zh-CN', 'Reload restores the saved Chinese preference');
  await qa.screenshot('chinese-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.models-tool').click();
  ok((await panel()).open && (await panel()).tab === 'models', 'Models opens on mobile');
  await page.locator('.models-tool').click();
  ok(!(await panel()).open && (await panel()).expanded === 'false', 'Models collapses on mobile');
  await page.waitForTimeout(250);
  ok(await page.locator('#sidebar').evaluate(el => el.getBoundingClientRect().right <= 1), 'The mobile panel actually leaves the visible map');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Chinese mobile layout has no horizontal overflow');
  await page.locator('.models-tool').click();
  await page.waitForTimeout(250);
  await qa.screenshot('chinese-mobile.png');
  ok(!qa.errors.length, 'No uncaught application errors');
  fs.writeFileSync(qa.out + '/i18n-acceptance.json', JSON.stringify({ passed: true, base: qa.base, fixtureNetwork: qa.fixtures, checks: qa.checks, errors: qa.errors }, null, 2));
};
