/* Standalone real-engine driver; all workspaces, browser caches and exports use scratch. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
require('./overnight-browser.cjs');const qa=global.qa;
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let service,log;
(async()=>{try{
 await qa.ready;
 const stamp=Date.now(),receipt=path.join(qa.out,'native-chart-fixture-'+stamp+'.json'),workspace=path.join(qa.out,'workspace-'+stamp);
 log=fs.openSync(path.join(qa.out,'native-chart-fixture.log'),'a');
 service=spawn(process.env.PORTAL_NATIVE_PYTHON||'/lustre/isaac24/scratch/yfeng21/usbf_engine_20261104/venv/bin/python',[path.join(__dirname,'native-charts-native-fixture.py'),workspace,receipt,'--origin',new URL(qa.base).origin],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore',log,log]});
 const deadline=Date.now()+180000;
 while(!fs.existsSync(receipt)){if(service.exitCode!==null)throw Error('Native chart fixture exited: '+fs.readFileSync(path.join(qa.out,'native-chart-fixture.log'),'utf8'));if(Date.now()>deadline)throw Error('Native chart fixture startup timed out.');await new Promise(resolve=>setTimeout(resolve,100));}
 qa.nativeCharts=JSON.parse(fs.readFileSync(receipt,'utf8'));
 await require('./native-charts-workflow-checks.cjs')(qa);
 qa.ok(digest(qa.nativeCharts.sourcePath)===qa.nativeCharts.sourceSha256&&digest(qa.nativeCharts.resultPath)===qa.nativeCharts.resultSha256,'Charting and cancellation preserve both original input and complete result SHA256');
 qa.ok(!qa.nativeChartIssues?.length,'Native chart controls have no unresolved acceptance issues');
 fs.writeFileSync(path.join(qa.out,'native-charts-browser.json'),JSON.stringify({passed:true,checks:qa.checks,errors:qa.errors,consoleErrors:qa.consoleErrors,sourceSha256:qa.nativeCharts.sourceSha256,resultSha256:qa.nativeCharts.resultSha256},null,2));
}catch(error){console.error(error);await qa.screenshot('native-charts-failure.png').catch(()=>{});fs.writeFileSync(path.join(qa.out,'native-charts-failure.json'),JSON.stringify({error:error.stack,checks:qa.checks,errors:qa.errors,consoleErrors:qa.consoleErrors,failedState:qa.nativeChartFailedState},null,2));process.exitCode=1;
}finally{await qa.close();if(service&&service.exitCode===null){service.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(resolve,10000);service.once('exit',()=>{clearTimeout(timer);resolve();});});if(service.exitCode===null)service.kill('SIGKILL');}if(log!==undefined)fs.closeSync(log);}})();
