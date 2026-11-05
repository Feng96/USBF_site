/* Source access is independent of map format and bounded preview attributes. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const checks=[],ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
let state={supported:true,connected:false,information:null};
const context={console,PortalNativeEngine:{status:()=>state},PortalAnalysisData:{capabilities:l=>({geometryAnalysis:!!l?.original})},PortalLayerPurpose:{format:l=>l?.cfg?.type==='pmtiles'?'PMTiles':l?.cfg?.type||'Data'}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../public-sources.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../data-sources.js'),'utf8'),context);
const S=context.PortalDataSources,layer=id=>({cfg:context.PortalPublicSources.catalog.find(c=>c.id===id)});
for(const id of ['osm-buildings','overture-buildings']){
 const d=S.describe(layer(id));ok(d.originalAvailable&&d.nativeLoad&&!d.browserLoad&&d.format==='GeoParquet',id+' exposes original GeoParquet through the common native loading contract');
}
ok(S.describe(layer('overture-buildings')).releaseId==='2026-10-21.0','The original Overture reader uses the exact existing display release');
const missing={cfg:{id:'overture-buildings',type:'pmtiles',url:'https://example.org/display.pmtiles'}};
ok(!S.describe(missing).originalAvailable&&!S.describe(missing).nativeLoad,'A display without a matching release cannot silently read latest analytical data');
for(const id of ['gba-usa','dc-government','nyc-government']){
 const d=S.describe(layer(id));ok(d.browserLoad&&d.nativeLoad&&d.originalAvailable,id+' retains its browser reader and shares the common native provider interface');
}
ok(S.describe({cfg:{driver:'usbf',type:'viewport'}}).browserLoad&&S.describe({cfg:{driver:'usbf',type:'viewport'}}).nativeLoad,'USBF retains its versioned browser and native connection');
for(const id of ['microsoft-usa','vida-us','unknown']){
 const l=id==='microsoft-usa'?layer(id):{cfg:{id,type:'pmtiles'}};
 ok(!S.describe(l).originalAvailable&&!S.describe(l).nativeLoad,'A '+id+' tile display is not advertised as an implemented original-data reader');
}
ok(S.describe({cfg:{type:'geojson'},original:true}).kind==='workset','Verified fixed vector worksets keep the common analytical operation path');
ok(!S.describe({cfg:{type:'geojson'}}).originalAvailable,'A GeoJSON container alone never certifies original analytical geometry');
assert.throws(()=>S.providerInput(layer('osm-buildings')),/Connect the local engine/);ok(true,'An unpaired original-data operation gives a connection reason before task execution');
state={supported:true,connected:true,information:{capabilities:{}}};
assert.throws(()=>S.providerInput(layer('osm-buildings')),/Update the local engine/);ok(true,'A paired older engine is not assumed to implement new provider readers');
state.information.capabilities.originalDataProviders=['osm-buildings','overture-buildings','gba-usa','dc-government','nyc-government'];
const osm=S.providerInput(layer('osm-buildings')),overture=S.providerInput(layer('overture-buildings'));
ok(osm.kind==='provider'&&osm.providerId==='osm-buildings'&&!osm.releaseId,'Latest OSM requests carry a provider identity without inventing an immutable release');
ok(overture.providerId==='overture-buildings'&&overture.releaseId==='2026-10-21.0'&&Object.keys(overture).length===3,'Native requests carry declarative provider and release identities, without arbitrary endpoints or SQL');
state.supported=false;assert.throws(()=>S.providerInput(layer('osm-buildings')),/desktop computer/);ok(true,'A mobile browser explains the desktop requirement before making a provider task');
const ref={cfg:{type:'geojson',nativeSource:{format:'GeoParquet',path:'Results/sample.parquet'}}};
ok(S.describe(ref).kind==='native-result'&&S.describe(ref).nativeLoad&&!S.describe(ref).browserLoad,'Complete native files never become analytical browser previews through their GeoJSON fallback');
console.log(JSON.stringify({passed:true,checks:checks.length}));
