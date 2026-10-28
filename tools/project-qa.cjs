const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),{webcrypto}=require('crypto'),{File}=require('buffer');
const context={URL,crypto:webcrypto,File,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../map-project-core.js'),'utf8'),context);const A=context.PortalProjectCore,checks=[];
const ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);},copy=x=>JSON.parse(JSON.stringify(x));
const style={color:'#287f76',opacity:.43,visible:false,colorMode:'height',sourceFilter:'osm',minArea:0,heightField:'height_m'};
const data={type:'FeatureCollection',provenance:{spatialEligible:true,geometryQuality:'derived-source-geometry',limited:true,licenses:['Source rights'],lineage:[{release:'old-release'}]},features:[{type:'Feature',id:'00012',properties:null,geometry:{type:'Point',coordinates:[-77,39]}},{type:'Feature',properties:{missing:null,recorded:false,zero:0,id:'9007199254740993123'},geometry:{type:'Point',coordinates:[-77.1,39]}}]};
const fixture=()=>({format:'USBF map',version:1,name:'Saved neighborhood',place:'Washington, DC',view:{center:[-77,39],zoom:16,pitch:45,bearing:-20,view3d:true,basemap:'light',crs:'EPSG:32618'},active:'layer-1',layers:[{key:'layer-1',name:'Original records',kind:'vector',data:copy(data),meta:{allowHeight:false,sourceUrl:'https://example.org/source.geojson'},asset:null,style:copy(style)}],models:[],assets:[],order:[['layer-1','circle']],research:null});
(async()=>{
 const p=fixture(),before=JSON.stringify(p);A.validate(p);ok(JSON.stringify(p)===before,'Validation leaves original feature IDs, nulls, missing values, flags and lineage unchanged');
 ok(p.layers[0].meta.allowHeight===false&&p.layers[0].data.provenance.limited,'Saved derived data keeps its height restriction and partial-source scope');
 for(const kind of ['vector','connection','raster','image-preview']){
  const x=fixture(),l=x.layers[0];l.kind=kind;l.meta.page='javascript:alert(1)';if(kind==='connection')l.connection={type:'raster',url:'https://example.org/{z}/{x}/{y}.png'};if(kind==='raster')l.import={type:'geotiff',url:'https://example.org/a.tif'};if(kind==='image-preview')l.coordinates=[[-77,39],[-76,39],[-76,38],[-77,38]];
  assert.throws(()=>A.validate(x),/HTTPS/);ok(true,'Unsafe source links cannot enter '+kind+' layer details');
 }
 for(const patch of [{zoom:99},{center:[500000,4000000]},{pitch:85},{basemap:'unknown'}]){const x=fixture();Object.assign(x.view,patch);assert.throws(()=>A.validate(x),/map position/);}
 ok(true,'Invalid cameras and unknown basemaps are rejected before restoring a map');
 const duplicate=fixture();duplicate.layers.push(copy(duplicate.layers[0]));assert.throws(()=>A.validate(duplicate),/saved layer is invalid/);ok(true,'Duplicate layer keys cannot overwrite the wrong layer');
 const order=fixture();order.order=[['layer-2','circle']];assert.throws(()=>A.validate(order),/layer order/);ok(true,'Missing layer references cannot corrupt saved rendering order');
 const connection=fixture();connection.layers[0]={key:'layer-1',name:'Tiles',kind:'connection',connection:{type:'pmtiles',url:'https://name:secret@example.org/a.pmtiles'},style};assert.throws(()=>A.validate(connection),/credentials/);ok(true,'Web connections cannot embed account credentials in a saved map');
 const budget=fixture();budget.layers=Array.from({length:25},(_,i)=>({...copy(p.layers[0]),key:'layer-'+i}));assert.throws(()=>A.validate(budget),/too many/);ok(true,'The project layer limit is checked before any map changes');
 const small=await A.encodeAsset(new File([Buffer.from('café model\n')],'café.obj',{type:'text/plain'}),'file-1'),assets=fixture();assets.assets=[small];A.validate(assets);const files=await A.decodeAssets(assets);ok(await files.get('file-1').text()==='café model\n'&&files.get('file-1').name==='café.obj','Embedded original files retain exact bytes and Unicode filenames');
 const corrupt=copy(assets);corrupt.assets[0].base64=Buffer.from('changed byte').toString('base64');corrupt.assets[0].bytes=12;await assert.rejects(A.decodeAssets(corrupt),/does not match/);ok(true,'Every embedded original file is checked against its saved SHA256');
 for(const bad of ['====','ab=c','a===','ab==cd==','!!!!']){const x=copy(assets);x.assets[0].base64=bad;assert.throws(()=>A.validate(x),/file stored/);}
 ok(true,'Invalid base64 padding and characters are rejected');
 const largeBytes=Buffer.alloc(8*1024*1024,37),large=await A.encodeAsset(new File([largeBytes],'neighborhood.tif'),'file-1'),big=fixture();big.assets=[large];A.validate(big);const decoded=await A.decodeAssets(big);ok(Buffer.from(await decoded.get('file-1').arrayBuffer()).equals(largeBytes),'A real 8 MB attachment validates and decodes without regular-expression stack overflow');
 let read=false;await assert.rejects(A.encodeAsset({name:'large.tif',size:33*1024*1024,arrayBuffer(){read=true;throw Error('must not read');}},'file-1'),/too large/);ok(!read,'Oversized files are rejected before allocating their bytes');
 const model=fixture();model.assets=[small];model.models=[{asset:'file-1',placement:{geometryBaked:true},visible:true}];assert.throws(()=>A.validate(model),/original geometry/);ok(true,'A baked model export cannot be reapplied with the original placement transforms');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
