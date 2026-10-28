/* Exercise the actual vendored PMTiles reader and native Blob range reads. */
const assert=require('assert'),fs=require('fs'),path=require('path'),{Blob}=require('buffer'),{buildPMTiles,library,writeFixtures,FixtureAbortController}=require('./pmtiles-fixtures.cjs');
const checks=[],results=[],ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
(async()=>{
 const pmtiles=library();for(const kind of ['vector','raster']){
  const fixture=buildPMTiles({kind}),file=new Blob([fixture.archive],{type:'application/vnd.pmtiles'});Object.defineProperty(file,'name',{value:'local-'+kind+'.pmtiles'});
  const reads=[],slice=file.slice.bind(file);file.slice=(start,end,type)=>{reads.push({start,end:Math.min(file.size,end),requestedEnd:end});return slice(start,end,type);};
  const source=new pmtiles.FileSource(file),archive=new pmtiles.PMTiles(source),header=await archive.getHeader(),metadata=await archive.getMetadata(),{z,x,y}=fixture.coordinate,tile=await archive.getZxy(z,x,y);
  ok(header.specVersion===3&&header.tileType===(kind==='raster'?2:1),'Actual '+kind+' FileSource parses the PMTiles v3 header');
  ok(metadata.name==='Synthetic QA '+kind&&(kind==='raster'||metadata.vector_layers[0].id==='fixture-buildings'),'Actual '+kind+' metadata identifies the archive source');
  ok(tile&&Buffer.from(tile.data).equals(fixture.tile),'Actual '+kind+' directory and tile lookup return the exact generated tile bytes');
  ok(reads.some(r=>r.start===fixture.tileDataOffset)&&reads.every(r=>r.end-r.start<file.size)&&reads.reduce((n,r)=>n+r.end-r.start,0)<file.size/2,'Actual '+kind+' FileSource reads metadata and selected tile ranges without loading the archive');
  const before=reads.length;ok(await archive.getZxy(z,x+1,y)===undefined&&reads.length===before,'Missing '+kind+' tiles are rejected using the cached directory');
  const protocol=new pmtiles.Protocol();protocol.add(archive);ok(protocol.get(source.getKey())===archive,'The map protocol retains the actual local '+kind+' archive');
  results.push({kind,bytes:file.size,tileBytes:fixture.tile.length,coordinate:fixture.coordinate,bounds:fixture.bounds,reads});
 }

 // Register the portal's real handler around the real PMTiles protocol. DOM/map
 // objects below only host the layer manager; archive reads use native Blob.
 const vm=require('vm'),nodes=new Map(),node=()=>({value:'',innerHTML:'',checked:false,hidden:false,classList:{toggle(){}},setAttribute(){},addEventListener(){},dispatchEvent(){},click(){},close(){}}),sources=new Map(),mapLayers=new Map();let registered;
 const map={addSource(id,s){sources.set(id,s);},getSource:id=>sources.get(id),addLayer(l){mapLayers.set(l.id,l);},getLayer:id=>mapLayers.get(id),getStyle:()=>({layers:Array.from(mapLayers.values())}),setPaintProperty(){},setLayoutProperty(){},setFilter(){},on(){}};
 const context={console,setTimeout,clearTimeout,URL,URLSearchParams,Map,Set,Object,CustomEvent:class{},document:{querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll:()=>[],createElement:node,addEventListener(){},dispatchEvent(){}},pmtiles,maplibregl:{addProtocol(name,handler){registered=handler;}},PortalLegend:{render(){},colorExpression:layer=>layer.color},PortalPublicSources:{catalog:[],resources:[],empty:()=>({type:'FeatureCollection',features:[]})},PortalUSBF:{entry:{id:'usbf-live',name:'USBF',type:'viewport',category:'Our USBF data',description:'',scope:''}}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','data-manager.js'),'utf8'),context);await context.PortalLayers.init({map,clearSelection(){},saveView(){},view3d:false},'');
 const fixture=buildPMTiles({kind:'raster'}),blob=new Blob([fixture.archive]);Object.defineProperty(blob,'name',{value:'regression-raster.pmtiles'});const archive=new pmtiles.PMTiles(new pmtiles.FileSource(blob));await context.PortalLayers.add({id:'regression-raster',name:'Sparse raster',type:'pmtiles',localArchive:archive},{restore:true,throwOnError:true});
 const {z,x,y}=fixture.coordinate,url='pmtiles://regression-raster.pmtiles/'+z+'/'+x+'/'+y;
 const image=await registered({type:'image',url},new FixtureAbortController());ok(Buffer.from(image.data).equals(fixture.tile),'The registered map protocol preserves a real raster tile response');
 await assert.rejects(registered({type:'image',url:'pmtiles://regression-raster.pmtiles/'+z+'/'+(x+1)+'/'+y},new FixtureAbortController()),e=>e.status===404);ok(true,'Sparse raster archive coordinates reject with 404 instead of leaving MapLibre image requests pending');
 const json=await registered({type:'json',url:'pmtiles://regression-raster.pmtiles'},new FixtureAbortController());ok(json.data.tiles[0].includes('{z}/{x}/{y}')&&json.data.minzoom===z,'The null-raster compatibility fix leaves real TileJSON metadata unchanged');
 if(process.env.PORTAL_QA_OUTPUT){const out=process.env.PORTAL_QA_OUTPUT;fs.mkdirSync(out,{recursive:true});writeFixtures(path.join(out,'pmtiles-fixtures'));fs.writeFileSync(path.join(out,'pmtiles.json'),JSON.stringify({passed:true,checks,results},null,2));}
 console.log(JSON.stringify({passed:true,checks:checks.length,results}));
})().catch(e=>{console.error(e.stack?.split('\n').slice(0,8).join('\n')||e);process.exitCode=1});
