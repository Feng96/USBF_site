/* Reuse the real 2,507-row chart fixture for native record-location acceptance. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
require('./overnight-browser.cjs');const qa=global.qa;let service,log;
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async()=>{try{
 await qa.ready;const stamp=Date.now(),receipt=path.join(qa.out,'native-locate-fixture-'+stamp+'.json'),workspace=path.join(qa.out,'workspace-'+stamp);
 log=fs.openSync(path.join(qa.out,'native-locate-fixture.log'),'a');service=spawn(process.env.PORTAL_NATIVE_PYTHON||'/lustre/isaac24/scratch/yfeng21/usbf_engine_20261104/venv/bin/python',[path.join(__dirname,'native-charts-native-fixture.py'),workspace,receipt,'--origin',new URL(qa.base).origin],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore',log,log]});
 const deadline=Date.now()+180000;while(!fs.existsSync(receipt)){if(service.exitCode!==null)throw Error('Native fixture exited early.');if(Date.now()>deadline)throw Error('Native fixture startup timed out.');await new Promise(resolve=>setTimeout(resolve,100));}qa.nativeCharts=JSON.parse(fs.readFileSync(receipt,'utf8'));
 const result=await require('./native-table-locate-workflow-checks.cjs')(qa);qa.ok(digest(qa.nativeCharts.sourcePath)===qa.nativeCharts.sourceSha256&&digest(qa.nativeCharts.resultPath)===qa.nativeCharts.resultSha256,'Record navigation preserves both source and complete-result SHA256');
 fs.writeFileSync(path.join(qa.out,'native-table-locate-browser.json'),JSON.stringify({passed:true,checks:qa.checks,errors:qa.errors,consoleErrors:qa.consoleErrors,requests:result.requests},null,2));
 }catch(error){console.error(error);await qa.screenshot('native-table-locate-failure.png').catch(()=>{});fs.writeFileSync(path.join(qa.out,'native-table-locate-failure.json'),JSON.stringify({error:error.stack,checks:qa.checks,errors:qa.errors,consoleErrors:qa.consoleErrors},null,2));process.exitCode=1;
 }finally{await qa.close();if(service&&service.exitCode===null){service.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(resolve,10000);service.once('exit',()=>{clearTimeout(timer);resolve();});});if(service.exitCode===null)service.kill('SIGKILL');}if(log!==undefined)fs.closeSync(log);}})();
