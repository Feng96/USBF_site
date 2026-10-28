/* Actual browser map capture and PDF download; independent parsing runs afterward. */
const fs=require('fs'),path=require('path');
module.exports=async qa=>{
 const p=qa.page,start=qa.checks.length;
 await qa.open();await qa.addBuildings();await p.evaluate(()=>{portal.setViewMode(true,false);portal.map.jumpTo({center:[-77.071,38.9121],zoom:18,pitch:45,bearing:-20});PortalComposer.open('map');});
 await p.locator('#composer-title').fill('Washington buildings');
 const letter=await qa.download(()=>p.locator('#composer-download-pdf').click(),'paper-browser-letter.pdf');
 qa.ok(fs.readFileSync(letter).subarray(0,8).toString().startsWith('%PDF-1.'),'The map dialog downloads a real paper-layout PDF');
 await p.locator('#composer-paper').selectOption('a4');await p.locator('#composer-orientation').selectOption('portrait');
 await p.locator('#composer-title').fill('Washington · 建筑');
 await qa.download(()=>p.locator('#composer-download-pdf').click(),'paper-browser-a4-unicode.pdf');
 qa.ok((await p.locator('#composer-page-summary').innerText()).includes('portrait'),'Paper size and orientation remain visible before download');
 await qa.download(()=>p.locator('#composer-download-png').click(),'paper-browser-map.png');
 qa.ok(fs.statSync(path.join(qa.out,'paper-browser-map.png')).size>10000,'PNG remains a downloadable image of the same map');
 await qa.screenshot('paper-browser-dialog.png');await p.locator('[data-close-composer]').click();
 const report={passed:true,checks:qa.checks.slice(start),files:['paper-browser-letter.pdf','paper-browser-a4-unicode.pdf','paper-browser-map.png']};fs.writeFileSync(path.join(qa.out,'paper-workflow.json'),JSON.stringify(report,null,2));return report;
};
