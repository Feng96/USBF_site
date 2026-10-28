/* Live, read-only USBF connection. The publication manifest is never bundled. */
(function(){
  'use strict';
  const base='https://data.source.coop/opengeos/us-buildings/USBF_v1/';
  const manifestURL=base+'manifest.json',pollMs=5*60*1000;
  const columns=['usbf_id','source','id','state','cx','cy','height','gba_var','modified','modification_type','added_area_m2','removed_area_m2','hollow_cut','shape_changed','possible_small_FP','height_coverage_status','height_valid_fraction','height_missing','height_incomplete','inference_input_mode','update_date','footprint_license','height_license','source_generation','source_identity_basis','release_status','processing_status','is_gba_only','height_source','geometry_fallback','gba_region','region','var'];
  const entry={id:'usbf-live',name:'USBF · U.S. Building Footprints',type:'viewport',driver:'usbf',fields:[...columns,'height_m','country_iso'],heightField:'height_m',color:'#287f76',category:'Our USBF data',recommended:true,description:'Our U.S. building footprints and available heights. Browse the map, then load original data when you analyze or download an area.',scope:'Our data · CONUS48 + DC',provider:'USBF / opengeos',page:'https://source.coop/opengeos/us-buildings',license:'Per-record ODbL 1.0 / CC BY-NC 4.0 components',attribution:'USBF / opengeos; upstream GBA, OpenStreetMap, Microsoft and Google · per-component ODbL / CC BY-NC 4.0',bounds:[[-125,24],[-66,50]],minViewZoom:14,sourceNote:'Full published polygons selected by source cx/cy ownership coordinates around the map view. height_m is a positive inherited GBA height; nDSM input coverage is separate. Original null flags and component licenses are retained.',links:[['Live release manifest',manifestURL],['Schema',base+'schema.json'],['Component licenses',base+'LICENSES.md']]};
  const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
  const validBox=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<=b[2]&&b[1]<=b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90;
  const empty=()=>({type:'FeatureCollection',features:[]});
  function parseManifest(data){
    if(data?.release!=='USBF_v1'||data.layout!=='flat_half_degree_geographic_tiles'||data.crs!=='EPSG:4326'||data.tile_degrees!==.5||data.scope!=='CONUS48+DC'||!Array.isArray(data.files)||data.files.length>100000)throw Error('The USBF publication format has changed. Open the source page for the latest download.');
    const seen=new Set(),tiles=[];let rows=0;
    for(const f of data.files){
      if(typeof f.path!=='string'||!/^USBF_x[+-]\d+_y[+-]\d+\.parquet$/.test(f.path))continue;
      if(seen.has(f.path)||!validBox(f.bbox)||!validBox(f.tile_bbox)||!Number.isSafeInteger(f.bytes)||f.bytes<=0||!Number.isSafeInteger(f.rows)||f.rows<0)throw Error('The USBF manifest contains an invalid tile entry.');
      if(typeof f.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(f.sha256))throw Error('USBF tile checksums are missing.');
      seen.add(f.path);rows+=f.rows;tiles.push({path:f.path,bytes:f.bytes,rows:f.rows,sha256:f.sha256.toLowerCase(),bbox:f.bbox.slice(),tile_bbox:f.tile_bbox.slice()});
    }
    if(!tiles.length||tiles.length!==data.tiles||rows!==data.buildings||!Number.isSafeInteger(rows)||!Number.isFinite(Date.parse(data.updated_utc)))throw Error('The USBF manifest counts or publication date are inconsistent.');
    return {release:data.release,updated:data.updated_utc,buildings:rows,count:tiles.length,tiles,signature:JSON.stringify([data.release,data.updated_utc,tiles.map(t=>[t.path,t.sha256,t.bytes,t.bbox])])};
  }
  function buffered(box){const padding=.002;return [Math.max(-180,box[0]-padding),Math.max(-90,box[1]-padding),Math.min(180,box[2]+padding),Math.min(90,box[3]+padding)];}
  const selectTiles=(manifest,box)=>manifest.tiles.filter(t=>intersects(t.bbox,buffered(box)));
  function tileURL(tile){if(!/^USBF_x[+-]\d+_y[+-]\d+\.parquet$/.test(tile.path)||!/^[a-f0-9]{64}$/.test(tile.sha256))throw Error('Invalid USBF tile address.');return base+encodeURIComponent(tile.path)+'?v='+tile.sha256;}
  function normalize(row,geometry){const properties={};for(const key of columns)if(Object.hasOwn(row,key)){const v=row[key];properties[key]=typeof v==='bigint'?String(v):v;}properties.height_m=typeof row.height==='number'&&Number.isFinite(row.height)&&row.height>0?row.height:null;properties.country_iso='USA';return {type:'Feature',geometry,properties};}
  const displayManifestURL='https://data.source.coop/opengeos/us-buildings/USBF_display/manifest.json';
  const aborted=()=>new DOMException('Cancelled.','AbortError');
  const clone=value=>JSON.parse(JSON.stringify(value));
  const contains=(outer,inner)=>validBox(outer)&&validBox(inner)&&outer[0]<=inner[0]&&outer[1]<=inner[1]&&outer[2]>=inner[2]&&outer[3]>=inner[3];
  function releaseOf(manifest){return {name:manifest.release,updated:manifest.updated,buildings:manifest.buildings,tiles:manifest.count};}
  async function readJSON(url,options={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    const signal=options.signal?AbortSignal.any([controller.signal,options.signal]):controller.signal;
    try{
      const response=await fetch(url,{cache:'no-store',credentials:'omit',signal});
      if(options.optional&&response.status===404)return null;
      if(!response.ok)throw Error('The source returned HTTP '+response.status+'.');
      const text=await response.text();if(text.length>20*1024*1024)throw Error('The publication index is too large.');
      return JSON.parse(text);
    }finally{clearTimeout(timer);}
  }
  function parseDisplay(data){
    if(!data)return null;
    const release=data.source_release,url=new URL(data.url);
    if(data.schema_version!==1||data.type!=='pmtiles'||data.benchmark===true||data.partial_display===true||data.input_buildings!==release?.buildings||url.origin!=='https://data.source.coop'||!url.pathname.startsWith('/opengeos/us-buildings/USBF_display/releases/')||!url.pathname.endsWith('.pmtiles')||url.username||url.password||url.search||url.hash||data.source_layer!=='usbf'||!/^[a-f0-9]{64}$/.test(data.sha256)||release?.name!=='USBF_v1'||!Number.isFinite(Date.parse(release.updated))||!Number.isSafeInteger(release.buildings)||release.buildings<1||!Number.isSafeInteger(release.tiles)||release.tiles<1||!validBox(data.bounds)||!Number.isInteger(data.minzoom)||!Number.isInteger(data.maxzoom)||data.minzoom<0||data.maxzoom>22||data.minzoom>data.maxzoom||!Array.isArray(data.fields)||data.fields.length>100||!data.fields.every(name=>typeof name==='string'&&/^[a-zA-Z_][a-zA-Z0-9_]{0,99}$/.test(name))||!['usbf_id','cx','cy','height_m'].every(name=>data.fields.includes(name)))throw Error('The building map publication is not supported.');
    return {...data,url:url.href+'?v='+data.sha256,source_release:clone(release)};
  }
  async function getDisplay(signal){const url=new URL(displayManifestURL);url.searchParams.set('_check',Date.now());return parseDisplay(await readJSON(url,{signal,optional:true}));}
  async function getPublication(signal){const url=new URL(manifestURL);url.searchParams.set('_check',Date.now());return parseManifest(await readJSON(url,{signal}));}
  async function prepare(l){
    let display=null,displayWarning='';
    try{display=await getDisplay();}catch(error){displayWarning=error.message;}
    const manifest=display?null:await getPublication();
    l.cfg.analysisMode='on-demand';l.renderTiled=!!display;l.displayMode=display?'pmtiles':'coverage';
    l.displayRelease=display?.source_release||null;l.release=display?.source_release||releaseOf(manifest);
    l.usbfConnection={display,manifest,displayWarning};
    if(display){l.cfg.sourceLayer=display.source_layer;l.cfg.displayTiles=true;l.fields=display.fields.slice();}
    return l.usbfConnection;
  }
  function attach(l,map,update){
    let connection=l.usbfConnection||{},manifest=connection.manifest||null,manifestAt=manifest?Date.now():0,manifestRequest=null;
    let stopped=false,worker=null,sequence=0,generation=0,lastCheck=Date.now(),checking=null;
    const jobs=new Map(),cache=new Map(),metadataWaits=new Set();let cacheSize=0;
    const coverageSource=l.id+'-publication',coverageLayer=l.id+'-publication-grid';
    l.cfg.analysisMode='on-demand';l.data=l.data||empty();l.featureById=new Map();l.analysisState={loading:false,cached:false,error:null,bounds:null};
    l.loaded=!!connection.display;l.viewLoading=false;l.error=false;
    function coverage(manifest){
      if(l.renderTiled)return;
      const data=manifest?{type:'FeatureCollection',features:manifest.tiles.map(tile=>{const [w,s,e,n]=tile.tile_bbox;return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}};})}:empty();
      if(!map.getSource(coverageSource)){
        map.addSource(coverageSource,{type:'geojson',data});
        map.addLayer({id:coverageLayer,type:'line',source:coverageSource,layout:{visibility:l.visible?'visible':'none'},paint:{'line-color':l.color,'line-width':.6,'line-opacity':l.opacity*.5}},'measure-line');
      }else map.getSource(coverageSource).setData(data);
    }
    function status(){
      l.viewNote=l.renderTiled?'Building map · original data loads when needed':l.data.features.length?'Original building outlines · loaded area':'Choose an area to load original buildings';
      const pub=document.querySelector('#usbf-publication');if(pub&&l.release)pub.textContent=l.release.buildings.toLocaleString()+' published buildings';
      update();
    }
    l.syncCoverageStyle=()=>{if(map.getLayer(coverageLayer)){map.setPaintProperty(coverageLayer,'line-color',l.color);map.setPaintProperty(coverageLayer,'line-opacity',l.opacity*.5);map.setLayoutProperty(coverageLayer,'visibility',l.visible?'visible':'none');}};
    function publishRaw(result){
      l.data=result.data;l.featureById=new Map(result.data.features.map(feature=>[String(feature.properties.usbf_id),feature]));
      l.fields=Array.from(new Set([...entry.fields,...result.fields]));l.analysisRelease=clone(result.release);
      l.analysisState={loading:jobs.size>0,cached:true,error:null,bounds:result.viewBounds.slice(),release:clone(result.release),loadedAt:result.viewLoadedAt};
      if(!l.renderTiled){l.displayMode='original';l.loaded=true;l.viewBounds=result.viewBounds.slice();l.viewLoadedAt=result.viewLoadedAt;l.viewBytes=result.viewBytes;l.viewLimited=result.viewLimited;l.viewSelection=result.viewSelection;l.setData?.(result.data);}
      l.onDataChanged?.();status();
    }
    function startWorker(){
      if(worker)return worker;
      worker=new Worker(new URL('./usbf-analysis-worker.js?v=1.4',document.baseURI),{type:'module'});
      worker.onmessage=event=>{
        const data=event.data,job=jobs.get(data.id);if(!job)return;
        if(data.progress){job.progress?.(data.progress.done,data.progress.total);return;}
        jobs.delete(data.id);job.cleanup();
        l.analysisState.loading=jobs.size>0;
        if(data.error){if(data.code==='RELEASE_CHANGED'){manifestAt=0;cache.clear();cacheSize=0;worker?.postMessage({type:'clear-cache'});}const error=Error(data.error);error.name=data.name||'Error';error.code=data.code;l.analysisState.error=error.message;job.reject(error);update();return;}
        if(stopped||job.generation!==generation){job.reject(aborted());return;}
        const result={data:data.data,fields:Array.from(new Set(data.data.features.flatMap(feature=>Object.keys(feature.properties||{})))),viewBounds:job.bounds.slice(),viewLimited:!!data.limited,viewLoadedAt:new Date().toISOString(),viewBytes:data.networkBytes??data.bytes,readBytes:data.bytes,release:clone(job.release),loaded:true,error:false,viewLoading:false,viewSelection:'Complete source polygons selected by published cx/cy ownership coordinates in the requested bounds plus a 0.002-degree buffer; not an exhaustive intersection query for large buildings centered outside that buffer.'};
        const size=JSON.stringify(result.data).length*2;
        if(size<=24*1024*1024){if(cache.has(job.key))cacheSize-=cache.get(job.key).size;cache.set(job.key,{result,size,featureId:job.featureId,signature:job.signature});cacheSize+=size;while(cache.size>3||cacheSize>24*1024*1024){const key=cache.keys().next().value;cacheSize-=cache.get(key).size;cache.delete(key);}}
        publishRaw(result);job.resolve(result);
      };
      worker.onerror=event=>{const error=Error(event.message||'Original building data could not load.');for(const job of jobs.values()){job.cleanup();job.reject(error);}jobs.clear();worker?.terminate();worker=null;l.analysisState.loading=false;l.analysisState.error=error.message;update();};
      return worker;
    }
    async function publication(signal,ownGeneration){
      if(!manifest||Date.now()-manifestAt>pollMs){
        // A shared metadata read does not belong to any one analytical operation.
        if(!manifestRequest)manifestRequest=getPublication().then(next=>{manifest=next;manifestAt=Date.now();l.release=releaseOf(next);l.displayStale=!!l.displayRelease&&l.displayRelease.updated!==next.updated;return next;}).finally(()=>{manifestRequest=null;});
        await new Promise((resolve,reject)=>{
          const cancel=()=>{cleanup();reject(aborted());};
          const cleanup=()=>{metadataWaits.delete(cancel);signal?.removeEventListener('abort',cancel);};
          metadataWaits.add(cancel);signal?.addEventListener('abort',cancel,{once:true});
          if(signal?.aborted||stopped||generation!==ownGeneration){cancel();return;}
          manifestRequest.then(value=>{cleanup();if(stopped||generation!==ownGeneration||signal?.aborted)reject(aborted());else resolve(value);},error=>{cleanup();reject(error);});
        });
      }
      if(signal?.aborted||stopped)throw aborted();return manifest;
    }
    function requestBounds(options){
      let bounds=options.bounds?.slice();
      if(options.scope==='selection'){
        const selected=options.selection,props=selected?.feature?.properties||{};
        if(selected?.layer!==l.id||typeof props.usbf_id!=='string'||!props.usbf_id)throw Error('Select a USBF building first.');
        const cx=props.cx,cy=props.cy;
        if(Number.isFinite(cx)&&Number.isFinite(cy))bounds=[cx-.000001,cy-.000001,cx+.000001,cy+.000001];
        else if(l.featureById.has(props.usbf_id)){const p=l.featureById.get(props.usbf_id).properties;bounds=[p.cx-.000001,p.cy-.000001,p.cx+.000001,p.cy+.000001];}
        else throw Error('This map record has no original-building location. Choose another building or download this map area.');
      }
      if(!bounds){const b=map.getBounds();bounds=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];}
      if(!validBox(bounds)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||(bounds[2]-bounds[0])*(bounds[3]-bounds[1])>.04)throw Error('Zoom into a neighborhood or choose a smaller study area before loading original buildings.');
      return bounds;
    }
    l.ensureData=async(options={})=>{
      if(stopped||options.signal?.aborted)throw aborted();
      const ownGeneration=generation,bounds=requestBounds(options),featureId=options.scope==='selection'?options.selection.feature.properties.usbf_id:undefined;
      options.onProgress?.(0,1);const current=await publication(options.signal,ownGeneration);
      if(stopped||generation!==ownGeneration||options.signal?.aborted)throw aborted();
      const tiles=selectTiles(current,bounds);
      if(tiles.length>9)throw Error('Choose a smaller area to load original buildings.');
      const key=JSON.stringify([current.updated,bounds,featureId||null,tiles.map(tile=>[tile.path,tile.sha256])]);
      let hit=cache.get(key);
      if(!hit&&!featureId)hit=Array.from(cache.values()).find(entry=>entry.featureId===undefined&&!entry.result.viewLimited&&entry.signature===current.signature&&contains(entry.result.viewBounds,bounds));
      if(hit){const found=Array.from(cache).find(([,value])=>value===hit);if(found){cache.delete(found[0]);cache.set(found[0],hit);}publishRaw(hit.result);return hit.result;}
      if(!tiles.length){const result={data:empty(),fields:entry.fields.slice(),viewBounds:bounds,viewLimited:false,viewLoadedAt:new Date().toISOString(),viewBytes:0,release:releaseOf(current),loaded:true,error:false,viewLoading:false};publishRaw(result);return result;}
      return new Promise((resolve,reject)=>{
        const id=++sequence,signal=options.signal;
        const cancel=()=>{const job=jobs.get(id);if(!job)return;jobs.delete(id);worker?.postMessage({type:'cancel',id});job.cleanup();l.analysisState.loading=jobs.size>0;reject(aborted());update();};
        const timer=setTimeout(()=>{const job=jobs.get(id);if(!job)return;jobs.delete(id);worker?.postMessage({type:'cancel',id});job.cleanup();l.analysisState.loading=jobs.size>0;reject(Error('Original data is taking too long. Choose a smaller area or try again.'));update();},90000);
        const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
        jobs.set(id,{resolve,reject,cleanup,bounds,key,release:{...releaseOf(current),files:tiles.map(tile=>({path:tile.path,sha256:tile.sha256,bytes:tile.bytes,rows:tile.rows}))},generation:ownGeneration,featureId,signature:current.signature,progress:options.onProgress});
        l.analysisState={...l.analysisState,loading:true,error:null};signal?.addEventListener('abort',cancel,{once:true});
        if(signal?.aborted){cancel();return;}
        try{startWorker().postMessage({id,bounds,tiles,...(featureId===undefined?{}:{featureId})});update();}catch(error){jobs.delete(id);cleanup();l.analysisState.loading=jobs.size>0;reject(error);}
      });
    };
    l.cancelAnalysis=()=>{generation++;for(const cancel of Array.from(metadataWaits))cancel();for(const [id,job] of jobs){worker?.postMessage({type:'cancel',id});job.cleanup();job.reject(aborted());}jobs.clear();l.analysisState.loading=false;update();};
    async function checkUpdates(){
      if(stopped)return;if(checking)return checking;
      checking=(async()=>{try{
        const next=await getDisplay();lastCheck=Date.now();if(stopped)return;
        if(!next&&l.renderTiled)throw Error('The map publication is unavailable. The last map is still shown.');
        l.releaseWarning='';
        if(next&&connection.display?.sha256!==next.sha256){
          if(l.renderTiled&&map.getSource(l.id)?.setUrl){map.getSource(l.id).setUrl('pmtiles://'+next.url);connection.display=next;l.displayRelease=clone(next.source_release);l.displayStale=!!manifest&&l.displayRelease.updated!==manifest.updated;manifestAt=0;l.releaseWarning='';}
          else l.releaseWarning='A building map is available. Remove this layer and add it again to open the map.';
        }
        l.releaseWarning=l.releaseWarning||'';status();
      }catch(error){if(!stopped){l.releaseWarning='Map update check failed: '+error.message;update();}}finally{checking=null;}})();return checking;
    }
    const interval=setInterval(()=>{if(l.visible&&document.visibilityState!=='hidden')checkUpdates();},pollMs);
    const visible=()=>{if(l.visible&&document.visibilityState==='visible'&&Date.now()-lastCheck>30000)checkUpdates();};
    document.addEventListener('visibilitychange',visible);
    l.reload=()=>{l.syncCoverageStyle();status();};l.checkUpdates=checkUpdates;
    l.stop=()=>{if(stopped)return;stopped=true;l.cancelAnalysis();clearInterval(interval);worker?.terminate();worker=null;cache.clear();cacheSize=0;document.removeEventListener('visibilitychange',visible);if(map.getLayer(coverageLayer))map.removeLayer(coverageLayer);if(map.getSource(coverageSource))map.removeSource(coverageSource);};
    coverage(manifest);status();
  }
  globalThis.PortalUSBF={entry,columns,parseManifest,selectTiles,buffered,tileURL,normalize,attach,prepare,parseDisplay,validBox,contains,pollMs,manifestURL,displayManifestURL};
})();
