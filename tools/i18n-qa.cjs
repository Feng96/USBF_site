/* Locale contracts independent of the browser, including opaque interpolations. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const checks = [];
const ok = (value, label) => { assert(value, label); checks.push(label); console.log('PASS', label); };
function load(saved, blocked = false) {
  const events = [], context = {
    window: {}, document: { readyState: 'loading', documentElement: {}, addEventListener() {}, querySelector() { return null; }, dispatchEvent(event) { events.push(event); } },
    localStorage: { getItem() { if (blocked) throw Error('storage unavailable'); return saved; }, setItem(_, value) { if (blocked) throw Error('storage unavailable'); saved = value; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  };
  vm.createContext(context);
  for (const file of ['i18n-zh.js', 'i18n-projects-zh.js', 'i18n-usbf-zh.js', 'i18n-gis-zh.js', 'i18n-scope-zh.js', 'i18n-device-zh.js', 'i18n-storage-zh.js', 'i18n.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  return { ...context, api: context.window.PortalI18n, events };
}
const c = load(null), i = c.api;
ok(i.locale === 'en' && i.t('Layers') === 'Layers', 'English is the default and remains the source text');
ok(!i.setLocale('unsupported') && i.locale === 'en', 'Unknown locales cannot enter the interface');
i.setLocale('zh-CN');
ok(i.t('Layers') === '图层' && i.t(' Models ') === ' 模型 ', 'Known interface copy translates while whitespace is retained');
ok(c.document.documentElement.lang === 'zh-CN', 'The document declares the active language');
ok(c.events[0].type === 'portal-language-changed', 'Other interface modules can subscribe to locale changes');
ok(i.t('GeoJSON') === 'GeoJSON' && i.t('LoD2') === 'LoD2' && i.t('height_m') === 'height_m', 'Unregistered technical names and field keys are opaque');
ok(i.t('Washington, DC') === 'Washington, DC', 'Place names are not translated');
ok(i.t('Added Layers.') === '已添加 Layers。', 'An interpolated data name matching a UI key stays opaque');
ok(i.t('3D uses height_m in metres. Inherited GBA height; nDSM input coverage is separate. Missing heights stay missing.').includes('height_m'), 'Height status keeps its source field name');
ok(i.t('Show Download') === '显示 Download', 'Action accessibility text preserves its data name');
ok(i.t('Model file returned HTTP 404').endsWith('HTTP 404'), 'System error translation retains technical status codes');
ok(i.t('Loading buildings… 1,000 / 15,277') === '正在加载建筑… 1,000 / 15,277', 'Pagination progress translates without changing its counts');
ok(i.t('50,000 buildings · partial coverage · zoom in').includes('尚未完整加载'), 'Partial source coverage has an explicit Chinese interface warning');
ok(i.t('Unknown system message') === 'Unknown system message', 'Unknown messages fall back to their original English');
ok(i.t('Value: {name}', { name: 'Layers <script>' }) === 'Value: Layers <script>', 'Parameter substitution does not recursively translate or interpret HTML');
ok(i.t('Project file saved to Projects/Layers.usbf.json. Browser project revision is unchanged.').includes('Projects/Layers.usbf.json'), 'Translated project-save status preserves the complete original filename');
ok(i.t('Saved to Results folder · 1,234 records. Some buildings in this area were unavailable. Data details include the area, date and source.').includes('1,234 条记录。此区域部分建筑不可用。'), 'Local result status translates counts and partial coverage without inventing completeness');
i.setLocale('en');
ok(i.t('Layers') === 'Layers', 'Switching back restores the English source copy');
ok(load('zh-CN').api.locale === 'zh-CN', 'A saved supported language is restored');
ok(load('bad').api.locale === 'en', 'Invalid stored preferences fall back to English');
const restricted = load(null, true);
ok(restricted.api.setLocale('zh-CN') && restricted.api.locale === 'zh-CN', 'Blocked browser storage does not break language switching');
const source = fs.readFileSync(path.join(__dirname, '..', 'i18n-zh.js'), 'utf8').split('Object.fromEntries(`')[1].split('`.trim()')[0].trim().split('\n');
ok(new Set(source.map(row => row.split('|')[0])).size === source.length, 'Every English interface key has exactly one Chinese translation');
ok(source.every(row => row.indexOf('|') > 0 && row.split('|').length === 2), 'Translation rows are complete and unambiguous');
console.log(JSON.stringify({ passed: true, checks: checks.length }));
