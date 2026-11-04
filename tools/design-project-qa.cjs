/* Portable custom-basemap and interface contracts, independent of the DOM. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),{webcrypto}=require('crypto'),{File}=require('buffer');
const context={URL,crypto:webcrypto,File,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../map-project-core.js'),'utf8'),context);
const A=context.PortalProjectCore,checks=[],copy=v=>JSON.parse(JSON.stringify(v)),ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);};
const fixture=()=>({format:'USBF map',version:1,name:'Layers',place:'Washington, DC',view:{center:[-77,39],zoom:15,pitch:0,bearing:0,view3d:false,basemap:'light',crs:'EPSG:4326'},active:null,layers:[],models:[],assets:[],order:[],research:null});
const xyz={version:1,type:'xyz',name:'Layers custom tiles',attribution:'Source owner / height_m',url:'https://tiles.example.org/{z}/{x}/{y}.png',tileSize:256,minzoom:0,maxzoom:19,scheme:'xyz'};
const ui={version:1,density:'compact',sidebarWidth:'wide',sidebarTab:'models',panels:{navigation:'hide',sidebar:'show',properties:'auto',dataWorkspace:'hide'}};
(async()=>{
 for(const basemap of ['light','streets','satellite','dark','topo','terrain','blank']){const p=fixture();p.view.basemap=basemap;A.validate(p);}
 ok(true,'All built-in basemaps, including blank, remain valid portable Project views');
 const p=fixture();p.view.basemap='custom';p.view.customBasemap=copy(xyz);const before=JSON.stringify(p);A.validate(p);ok(JSON.stringify(p)===before,'Custom tile names, attribution and URL templates survive validation unchanged');
 for(const url of ['javascript:alert(1)','http://tiles.example.org/{z}/{x}/{y}.png','https://name:secret@tiles.example.org/{z}/{x}/{y}.png','https://tiles.example.org/plain.png','https://tiles.example.org/{s}/{z}/{x}/{y}.png','https://tiles.example.org/{z}/{x}/{y}.png#fragment']){const x=copy(p);x.view.customBasemap.url=url;assert.throws(()=>A.validate(x));}
 ok(true,'Unsafe addresses, embedded credentials and missing tile coordinates are rejected');
 for(const patch of [{tileSize:1},{minzoom:20,maxzoom:10},{scheme:'unknown'},{maxzoom:23},{type:'style',layers:[]},{source:'injected'}]){const x=copy(p);Object.assign(x.view.customBasemap,patch);assert.throws(()=>A.validate(x));}
 ok(true,'Unsupported basemap types and malformed zoom, tile size and source settings are rejected');
 const ambiguous=copy(p);ambiguous.view.basemap='blank';assert.throws(()=>A.validate(ambiguous));ok(true,'A built-in view cannot silently carry an unrelated custom connection');
 const {buildPMTiles}=require('./pmtiles-fixtures.cjs'),bytes=buildPMTiles({kind:'raster'}).tile;
 const image=fixture();image.assets=[await A.encodeAsset(new File([bytes],'Layers basemap.png',{type:'image/png'}),'file-1')];image.view.basemap='custom';image.view.customBasemap={version:1,type:'image',name:'Layers',attribution:'Local field image',coordinates:[[-77,40],[-76,40],[-76,39],[-77,39]],asset:'file-1'};
 A.validate(image);const files=await A.decodeAssets(image);ok(Buffer.from(await files.get('file-1').arrayBuffer()).equals(bytes)&&files.get('file-1').name==='Layers basemap.png','Portable image basemaps retain the exact original filename and PNG bytes');
 const missing=copy(image);missing.assets=[];assert.throws(()=>A.validate(missing));ok(true,'A missing local image attachment fails before restoration can replace the map');
 for(const c of [ [[-77,90],[-76,90],[-76,39],[-77,39]], [[-76,40],[-77,40],[-77,39],[-76,39]], [[-77,40],[-76,41],[-76,39],[-77,39]] ]){const x=copy(image);x.view.customBasemap.coordinates=c;assert.throws(()=>A.validate(x));}
 ok(true,'Out-of-world, reversed and non-rectangular image bounds cannot shift a saved basemap');
 A.interfaceState(ui);ok(ui.panels.navigation==='hide'&&ui.sidebarTab==='models','A custom interface retains explicit visibility and sidebar choices');
 for(const patch of [{density:'tiny'},{sidebarWidth:'99999px'},{sidebarTab:'injected'},{panels:{attribution:'hide'}},{panels:{sidebar:true}},{selector:'#map'}])assert.throws(()=>A.interfaceState({...copy(ui),...patch}));
 ok(true,'Interface files cannot inject CSS selectors, hide mandatory attribution or use malformed policy values');
 const oldUI=copy(ui);delete oldUI.sidebarTab;A.interfaceState(oldUI);ok(true,'Earlier interface snapshots without a sidebar tab remain readable');
 const legacy=fixture();A.validate(legacy);ok(legacy.presentation===undefined&&legacy.view.customBasemap===undefined,'Existing Projects with no new design fields remain backward compatible');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
