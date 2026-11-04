/* Actual deployed release, public building data, opaque sharing and phone controls. */
const fs=require('fs');
module.exports=async qa=>{
 qa.fixtures=false;qa.base=process.env.PORTAL_PUBLIC_URL||'https://feng96.github.io/USBF_site/';process.env.PORTAL_PM_LIVE_URL=qa.base;
 await qa.open('?empty=1&acceptance=1.12#base=blank');
 await qa.page.evaluate(()=>PortalDeviceSettings.open('engine'));
 qa.ok(await qa.page.locator('.device-engine-downloads a').count()===4,'The live website exposes all four published preview installers');
 const manifest=await qa.page.evaluate(()=>fetch('data/engine-releases.json',{cache:'no-store'}).then(r=>r.json()));
 qa.ok(manifest.version==='0.2.0-preview.1'&&/^[a-f0-9]{40}$/.test(manifest.revision)&&Object.keys(manifest.platforms).length===4&&Object.values(manifest.platforms).every(p=>p.testedChecks>=22&&/^[a-f0-9]{64}$/.test(p.sha256)&&p.bytes>1000000),'The live download manifest references only the tested native release');
 await qa.page.locator('[data-ds-action=close]').first().click();
 await qa.run('tools/usbf-public-pmtiles-checks.cjs');
 await qa.run('tools/releases-sharing-workflow-checks.cjs');
 await qa.page.setViewportSize({width:390,height:844});
 await qa.page.locator('#interface-language').selectOption('zh-CN');
 await qa.page.locator('[data-task-center]').first().click();
 qa.ok(await qa.page.locator('#task-center-dialog').isVisible()&&await qa.page.evaluate(()=>document.querySelector('#task-center-dialog').getBoundingClientRect().right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth),'The live Chinese task center fits a phone and remains accessible');
 await qa.page.locator('[data-task-action=close]').click();
 await qa.screenshot('public-engine-sharing-phone.png');
 qa.ok(!qa.errors.length,'The final live map, native settings and readonly sharing have no uncaught browser errors');
 fs.writeFileSync(qa.out+'/engine-sharing-public-final.json',JSON.stringify({passed:true,checks:qa.checks,errors:qa.errors,base:qa.base,release:manifest.tag},null,2));
};
