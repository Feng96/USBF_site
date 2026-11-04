/* Explicit interface bindings. Raw data nodes and exported artifacts are never translated. */
(function () {
  'use strict';
  const storageKey = 'usbf.interface-language';
  const supported = ['en', 'zh-CN'];
  const bindings = new WeakMap(), tracked = new Set();
  const attributeNames = ['title', 'aria-label', 'placeholder'];
  const selector = '[data-i18n],[data-i18n-system],' + attributeNames.map(name => '[data-i18n-' + name + ']').join(',');
  let locale = 'en', observer;
  try { const saved = localStorage.getItem(storageKey); if (supported.includes(saved)) locale = saved; } catch (_) {}

  // Interpolated values are copied verbatim, including field names, places and model names.
  const patterns = [
    [/^Loading area parts… (\d+) \/ (\d+)$/, m => '正在加载区域分块… ' + m[1] + ' / ' + m[2]],
    [/^Reading input (\d+) \/ (\d+)$/, m => '正在读取输入 ' + m[1] + ' / ' + m[2]],
    [/^([\d,]+) output records( · partial coverage)?$/, m => m[1] + ' 条输出记录' + (m[2] ? ' · 覆盖范围不完整' : '')],
    [/^([\d,]+) matching records$/, m => m[1] + ' 条匹配记录'],
    [/^(\d+) polygon corners$/, m => m[1] + ' 个多边形顶点'],
    [/^Revision (\d+)$/, m => '修订 ' + m[1]],
    [/^([\d,]+) loaded records( in the first ([\d,]+))?$/, m => m[1] + ' 条已加载记录' + (m[3] ? '（前 ' + m[3] + ' 条内）' : '')],
    [/^Loading buildings… ([\d,]+)( \/ ([\d,]+))?$/, m => '正在加载建筑… ' + m[1] + (m[3] ? ' / ' + m[3] : '')],
    [/^([\d,]+) buildings · partial coverage · zoom in$/, m => m[1] + ' 栋建筑 · 尚未完整加载 · 请放大'],
    [/^([\d,]+) buildings loaded nearby$/, m => '周边已加载 ' + m[1] + ' 栋建筑'],
    [/^Building coverage incomplete\. (.+)$/, m => '建筑尚未完整加载。' + t(m[1])],
    [/^(\d[\d,]*) buildings loaded( · zoom in to see more)?$/, m => '已加载 ' + m[1] + ' 栋建筑' + (m[2] ? ' · 放大以查看更多' : '')],
    [/^(\d+) added layers?$/, m => '已添加 ' + m[1] + ' 个图层'],
    [/^Added (.+)\.$/, m => '已添加 ' + m[1] + '。'],
    [/^(\d[\d,]*) (selected records|visible buildings|visible records)( in the first 20,000)?$/, m => m[1] + ({'selected records':' 条选中记录','visible buildings':' 栋可见建筑','visible records':' 条可见记录'})[m[2]] + (m[3] ? '（前 20,000 条内）' : '')],
    [/^(\d+)–(\d+) of ([\d,]+)$/, m => m[1] + '–' + m[2] + '，共 ' + m[3]],
    [/^0 records$/, () => '0 条记录'],
    [/^(.+) · (portrait|landscape) · (\d+) mm margins$/, m => m[1] + ' · ' + (m[2] === 'portrait' ? '纵向' : '横向') + ' · 页边距 ' + m[3] + ' mm'],
    [/^3D uses (.+) in metres\. (Inherited GBA height; nDSM input coverage is separate\. |Converted from the source’s roof height in feet\. )?Missing heights stay missing\.$/, m => '3D 使用 ' + m[1] + '（metres）。' + (m[2]?.startsWith('Inherited') ? '沿用 GBA 高度；nDSM 输入覆盖范围另行记录。' : m[2] ? '已从来源中以 feet 为单位的屋顶高度转换。' : '') + '缺失高度保持缺失。'],
    [/^Calculating… (.+)$/, m => '正在计算… ' + m[1]],
    [/^Reading and preparing (.+)$/, m => '正在读取并准备 ' + m[1]],
    [/^Map saved\. Open this file to continue on another day or device\.(.*)$/, m => '地图已保存。日后或在其他设备打开此文件即可继续。' + (m[1] ? '仅影像图层保留显示影像，不包含这些图层的原始 Raster 文件。' : '')],
    [/^Coordinate readouts and default exports now use (.+)\.$/, m => '坐标显示与默认导出现在使用 ' + m[1] + '。'],
    [/^Map position: (.+)$/, m => '地图位置：' + m[1]],
    [/^Show (.+)$/, m => '显示 ' + m[1]],
    [/^Remove (.+)$/, m => '移除 ' + m[1]],
    [/^Move (.+) up$/, m => '上移 ' + m[1]],
    [/^Move (.+) down$/, m => '下移 ' + m[1]],
    [/^(.+) opacity$/, m => m[1] + ' 不透明度'],
    [/^Connected · (.+)$/, m => '已连接 · ' + m[1]],
    [/^Model file returned HTTP (\d+)$/, m => '模型文件返回 HTTP ' + m[1]],
    [/^Model index returned HTTP (\d+)$/, m => '模型索引返回 HTTP ' + m[1]],
    [/^Page (\d+) of (\d+)$/, m => '第 ' + m[1] + ' 页，共 ' + m[2] + ' 页']
  ];
  function t(source, parameters) {
    source = String(source ?? '');
    const key = source.trim(), dictionary = window.PortalTranslations?.[locale];
    let result = source;
    if (dictionary && Object.prototype.hasOwnProperty.call(dictionary, key)) {
      result = source.slice(0, source.indexOf(key)) + dictionary[key] + source.slice(source.indexOf(key) + key.length);
    } else if (dictionary) {
      for (const [pattern, format] of patterns) { const match = key.match(pattern); if (match) { result = format(match); break; } }
    }
    if (parameters) result = result.replace(/\{(\w+)\}/g, (all, name) => Object.prototype.hasOwnProperty.call(parameters, name) ? String(parameters[name]) : all);
    return result;
  }
  function ignored(el) { return !!el.closest('[data-i18n-ignore],script,style,svg,canvas,pre,code'); }
  function translate(el) {
    if (!el.isConnected || ignored(el)) return;
    tracked.add(el);
    let state = bindings.get(el);
    if (!state) { state = { text: new WeakMap(), attributes: new Map() }; bindings.set(el, state); }
    if (el.hasAttribute('data-i18n') || el.hasAttribute('data-i18n-system')) {
      for (const node of el.childNodes) {
        if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
        let entry = state.text.get(node);
        if (!entry || node.nodeValue !== entry.rendered) entry = { source: node.nodeValue };
        entry.rendered = t(entry.source);
        state.text.set(node, entry);
        if (node.nodeValue !== entry.rendered) node.nodeValue = entry.rendered;
      }
    }
    for (const name of attributeNames) {
      if (!el.hasAttribute('data-i18n-' + name)) continue;
      const value = el.getAttribute(name); if (value === null) continue;
      let entry = state.attributes.get(name);
      if (!entry || value !== entry.rendered) entry = { source: value };
      entry.rendered = t(entry.source); state.attributes.set(name, entry);
      if (value !== entry.rendered) el.setAttribute(name, entry.rendered);
    }
  }
  function scan(root) {
    if (root.nodeType !== 1 || ignored(root)) return;
    if (root.matches(selector)) translate(root);
    for (const el of root.querySelectorAll(selector)) translate(el);
  }
  function update() {
    document.documentElement.lang = locale;
    for (const el of tracked) { if (el.isConnected) translate(el); else tracked.delete(el); }
    const control = document.querySelector('#interface-language'); if (control) control.value = locale;
  }
  function setLocale(value) {
    if (!supported.includes(value)) return false;
    locale = value;
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    update();
    document.dispatchEvent(new CustomEvent('portal-language-changed', { detail: { locale } }));
    return true;
  }
  function init() {
    scan(document.body); update();
    document.querySelector('#interface-language')?.addEventListener('change', e => setLocale(e.target.value));
    observer = new MutationObserver(records => {
      for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (!target || ignored(target)) continue;
        if (target.matches(selector)) translate(target);
        if (record.type === 'childList') for (const node of record.addedNodes) scan(node);
      }
      // Detached dialogs/rows must not remain retained by the language controller.
      for (const el of tracked) if (!el.isConnected) tracked.delete(el);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
  }
  window.PortalI18n = { t, setLocale, refresh: scan, get locale() { return locale; }, supported: Object.freeze(supported.slice()) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
