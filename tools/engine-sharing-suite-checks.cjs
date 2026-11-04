/* One browser session, real loopback service, then portable readonly recipients. */
const fs=require('fs');
module.exports=async qa=>{
 const value=JSON.parse(fs.readFileSync(qa.out+'/native-ready.json','utf8'));
 qa.nativeEndpoint=value.endpoint;qa.nativePairingCode=value.code;qa.nativeSpec=value.spec;qa.nativeExpectedRows=25001;qa.nativeExpectedProperties={original_id:"9007199254740993123",zero:0,flag:false,missing:null};
 await qa.run('tools/task-engine-workflow-checks.cjs');
 await qa.run('tools/task-browser-workflow-checks.cjs');
 await qa.run('tools/native-project-workflow-checks.cjs');
 await qa.run('tools/releases-sharing-workflow-checks.cjs');
 fs.writeFileSync(qa.out+'/engine-sharing-suite.json',JSON.stringify({passed:true,checks:qa.checks,errors:qa.errors},null,2));
};
