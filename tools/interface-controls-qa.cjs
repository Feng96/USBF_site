/* Preferences are a strict project-safe value, independent of DOM side effects. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../interface-controls.js'),'utf8'),context);
const api=context.PortalInterfaceCore,checks=[],ok=(v,n)=>{assert(v,n);checks.push(n);console.log('PASS',n);};
const defaults=api.defaults();
ok(defaults.version===1&&Object.keys(defaults.panels).length===20,'Default layout covers every registered panel without changing contextual visibility');
ok(Object.values(defaults.panels).every(v=>v==='auto'),'Natural tool and data events remain enabled by default');
const custom=JSON.parse(JSON.stringify(defaults));custom.panels.attributes='hide';custom.panels.navigation='show';custom.density='compact';custom.sidebarWidth='wide';custom.sidebarTab='models';
const restored=api.validate(custom);ok(restored.panels.attributes==='hide'&&restored.panels.navigation==='show'&&restored.sidebarTab==='models','Project layout preserves hidden and shown panels and the selected sidebar');
restored.panels.attributes='show';ok(custom.panels.attributes==='hide','Validation returns an independent value and never mutates the saved project');
const previous=JSON.parse(JSON.stringify(custom));delete previous.sidebarTab;ok(api.validate(previous).sidebarTab==='layers','Older layout values without a sidebar tab remain compatible');
ok(api.validate(undefined).density==='comfortable','Opening an older project can restore defaults without a new schema requirement');
for(const patch of [{version:2},{density:'large'},{sidebarWidth:999},{sidebarTab:'<script>'},{unknown:true},{panels:{layers:'show'}},{panels:{sidebar:'false'}},{panels:[]}]){assert.throws(()=>api.validate({...custom,...patch}),/invalid/);}
ok(true,'Malformed layout values, unsupported panels and injected schema keys are rejected');
const partial={version:1,density:'comfortable',sidebarWidth:'normal',panels:{sidebar:'hide'}};ok(api.validate(partial).panels.search==='auto','A partial set of known panel preferences safely retains contextual defaults');
const older=JSON.parse(JSON.stringify(defaults));delete older.panels.nativeResults;ok(api.validate(older).panels.nativeResults==='auto','A project saved before native result controls receives their contextual default');
ok(api.panels.includes('nativeResults')&&api.validate({...defaults,panels:{nativeResults:'hide'}}).panels.nativeResults==='hide','Native result status participates in strict, portable panel preferences');
ok(!api.panels.includes('attribution'),'Mandatory source attribution cannot be suppressed by a layout value');
console.log(JSON.stringify({passed:true,checks:checks.length}));
