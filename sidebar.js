/* Shared panel visibility; opening the Models panel does not load a model. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const isOpen = () => innerWidth > 700 ? !document.body.classList.contains('sidebar-collapsed') : $('#sidebar').classList.contains('is-open');
  const currentTab = () => $('[data-tab][aria-selected=true]')?.dataset.tab || 'layers';
  function sync() {
    for (const [selector, tab] of [['[data-action=layers]', 'layers'], ['.models-tool[data-open-models]', 'models']]) {
      const button = $(selector), expanded = isOpen() && currentTab() === tab;
      button?.setAttribute('aria-expanded', String(expanded));
      button?.classList.toggle('active', expanded);
    }
  }
  function setOpen(visible) {
    if (innerWidth > 700) document.body.classList.toggle('sidebar-collapsed', !visible);
    else $('#sidebar').classList.toggle('is-open', visible);
    sync();
    requestAnimationFrame(() => window.portal?.map?.resize());
  }
  function open(tab = currentTab()) {
    if (tab !== currentTab()) $('[data-tab=' + tab + ']')?.click();
    setOpen(true);
  }
  function toggle(tab) { if (isOpen() && currentTab() === tab) setOpen(false); else open(tab); }
  function init() {
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    observer.observe($('#sidebar'), { attributes: true, attributeFilter: ['class'] });
    for (const tab of document.querySelectorAll('[data-tab]')) observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected'] });
    window.addEventListener('resize', sync); sync();
  }
  window.PortalSidebar = { open, close: () => setOpen(false), toggle, get isOpen() { return isOpen(); }, get tab() { return currentTab(); } };
  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
