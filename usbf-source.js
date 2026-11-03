/* Live, read-only USBF connection. The publication manifest is never bundled. */
(function(){
  'use strict';
  const base='https://data.source.coop/opengeos/us-buildings/USBF_v1/';
  const manifestURL=base+'manifest.json',pollMs=5*60*1000;
  const columns=['usbf_id','source','id','state','cx','cy','height','gba_var','modified','modification_type','added_area_m2','removed_area_m2','hollow_cut','shape_changed','possible_small_FP','height_coverage_status','height_valid_fraction','height_missing','height_incomplete','inference_input_mode','update_date','footprint_license','height_license','source_generation','source_identity_basis','release_status','processing_status','is_gba_only','height_source','geometry_fallback','gba_region','region','var'];
  const entry={id:'usbf-live',name:'USBF · U.S. Building Footprints',type:'viewport',driver:'usbf',fields:[...columns,'height_m','country_iso'],heightField:'height_m',color:'#287f76',category:'Our USBF data',recommended:true,description:'Our published CONUS inventory, read directly from Source Cooperative. The latest manifest is checked on opening and every five minutes while visible. Zoom to a neighborhood for footprints and available heights.',scope:'Our data · CONUS48 + DC · live GeoParquet',provider:'USBF / opengeos',page:'https://source.coop/opengeos/us-buildings',license:'Per-record ODbL 1.0 / CC BY-NC 4.0 components',attribution:'USBF / opengeos; upstream GBA, OpenStreetMap, Microsoft and Google · per-component ODbL / CC BY-NC 4.0',bounds:[[-125,24],[-66,50]],minViewZoom:14,sourceNote:'Full published polygons selected by source cx/cy ownership coordinates around the map view. height_m is a positive inherited GBA height; nDSM input coverage is separate. Original null flags and component licenses are retained.',links:[['Live release manifest',manifestURL],['Schema',base+'schema.json'],['Component licenses',base+'LICENSES.md']]};
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
  function attach(l,map,update){
    let manifest=null,checking=null,manifestController=null,lastCheck=0,stopped=false,queryTimer,queryTimeout,worker,revision=0;
    // A camera change is not a source change. Retain both decoded records and
    // MapLibre's prepared geometry while the requested view remains covered.
    const cache=new Map(),cacheLimit=24*1024*1024;let cacheBytes=0,displayed=null,pendingBounds=null,displayedCacheValid=true;
    l.navigationMetrics={reads:0,cacheHits:0,pendingReuses:0,sourceWrites:0,cacheBytes:0,cacheEntries:0};
    const contains=(outer,inner)=>validBox(outer)&&validBox(inner)&&outer[0]<=inner[0]&&outer[1]<=inner[1]&&outer[2]>=inner[2]&&outer[3]>=inner[3];
    const sameBox=(a,b)=>a?.length===4&&b?.length===4&&a.every((v,i)=>v===b[i]);
    function write(data){l.navigationMetrics.sourceWrites++;if(l.setData)l.setData(data);else map.getSource(l.id)?.setData(data);}
    function cacheState(){l.navigationMetrics.cacheBytes=cacheBytes;l.navigationMetrics.cacheEntries=cache.size;}
    function remember(result){
      const key=JSON.stringify(result.limited?result.view:result.bounds),size=JSON.stringify(result.data).length*2;
      if(size>cacheLimit)return;
      if(cache.has(key)){cacheBytes-=cache.get(key).size;cache.delete(key);}
      result.size=size;cache.set(key,result);cacheBytes+=size;
      while(cache.size>4||cacheBytes>cacheLimit){const first=cache.keys().next().value;cacheBytes-=cache.get(first).size;cache.delete(first);}
      cacheState();
    }
    function cached(box){
      const matches=result=>result.limited?sameBox(result.view,box):contains(result.bounds,box);
      if(displayedCacheValid&&displayed&&matches(displayed))return displayed;
      for(const [key,result] of Array.from(cache).reverse())if(matches(result)){cache.delete(key);cache.set(key,result);return result;}
      return null;
    }
    function preload(box){
      const dx=(box[2]-box[0])*.2,dy=(box[3]-box[1])*.2;
      const expanded=[Math.max(-180,box[0]-dx),Math.max(-90,box[1]-dy),Math.min(180,box[2]+dx),Math.min(90,box[3]+dy)];
      return (expanded[2]-expanded[0])*(expanded[3]-expanded[1])<=.04&&selectTiles(manifest,expanded).length<=9?expanded:box;
    }
    const coverageSource=l.id+'-publication',coverageLayer=l.id+'-publication-grid';
    map.addSource(coverageSource,{type:'geojson',data:empty()});
    map.addLayer({id:coverageLayer,type:'line',source:coverageSource,maxzoom:14,layout:{visibility:l.visible?'visible':'none'},paint:{'line-color':l.color,'line-width':.6,'line-opacity':l.opacity*.5}},'measure-line');
    l.syncCoverageStyle=()=>{if(map.getLayer(coverageLayer)){map.setPaintProperty(coverageLayer,'line-opacity',l.opacity*.5);map.setLayoutProperty(coverageLayer,'visibility',l.visible?'visible':'none');}};
    const coverageVisibility=()=>{if(map.getLayer(coverageLayer))map.setLayoutProperty(coverageLayer,'visibility',l.visible?'visible':'none');};
    function note(s,loading=false){const changed=l.viewNote!==s||l.viewLoading!==loading;l.viewNote=s;l.viewLoading=loading;if(changed)update();}
    function cancel(){revision++;clearTimeout(queryTimer);clearTimeout(queryTimeout);worker?.terminate();worker=null;pendingBounds=null;}
    function pause(s){cancel();l.loaded=false;note(s);}
    function invalidate(){cancel();cache.clear();cacheBytes=0;cacheState();displayed=null;l.loaded=false;l.viewBounds=null;l.viewLoadedAt=null;l.featureById=new Map();if(l.data?.features?.length){l.data=empty();write(l.data);l.onDataChanged?.();}}
    function publish(result){
      const changed=displayed!==result;displayed=result;displayedCacheValid=true;l.data=result.data;l.loaded=true;l.error=false;l.errorDetail='';
      l.viewBytes=result.bytes;l.viewLimited=result.limited;l.viewBounds=result.bounds.slice();l.viewLoadedAt=result.loadedAt;
      l.viewSelection='Published cx/cy ownership coordinates within the cached neighborhood bounds plus a 0.002-degree buffer';
      if(changed){l.featureById=new Map(result.data.features.map(f=>[String(f.properties.usbf_id),f]));l.fields=result.fields;write(result.data);l.onDataChanged?.();}
      note(result.data.features.length.toLocaleString()+' buildings loaded'+(result.limited?' · zoom in to see more':''));
    }
    function bounds(){const b=map.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];}
    function loadView(exact=false){
      clearTimeout(queryTimer);if(stopped||!map.getSource(l.id))return;coverageVisibility();
      if(!l.visible){pause('Layer hidden');return;}
      if(!manifest){pause('Loading USBF…');return;}
      const box=bounds();l.error=false;
      if(!validBox(box)||!intersects(box,[-125,24,-66,50])){pause('USBF covers the contiguous United States and Washington, DC');return;}
      if(map.getZoom()<14||(box[2]-box[0])*(box[3]-box[1])>.04){pause('Coverage map · choose a place or zoom in to see buildings');return;}
      const hit=cached(box);if(hit){if(worker)cancel();l.navigationMetrics.cacheHits++;publish(hit);return;}
      if(worker&&pendingBounds&&contains(pendingBounds,box)){l.navigationMetrics.pendingReuses++;return;}
      cancel();const requested=exact?box:preload(box),tiles=selectTiles(manifest,requested);
      if(!tiles.length){publish({data:empty(),fields:entry.fields.slice(),bounds:requested,bytes:0,limited:false,loadedAt:new Date().toISOString()});return;}
      if(tiles.length>9){pause('Zoom in to a smaller area to see buildings');return;}
      l.loaded=false;note(displayed?'Updating buildings…':'Loading buildings…',true);const rev=revision;
      pendingBounds=requested;l.navigationMetrics.reads++;
      worker=new Worker(new URL('./usbf-worker.js?v=1.0',document.baseURI),{type:'module'});
      queryTimeout=setTimeout(()=>{if(rev!==revision)return;cancel();l.error=true;note('Loading is taking longer than usual. Refresh data or choose a smaller area.');},60000);
      worker.onmessage=e=>{
        if(stopped||rev!==revision)return;clearTimeout(queryTimeout);worker?.terminate();worker=null;pendingBounds=null;
        if(e.data.error){if(!exact&&!sameBox(requested,box)&&/32 MB|budget/i.test(e.data.error)){loadView(true);return;}l.error=true;l.errorDetail=e.data.error;note(/32 MB|limit|fewer|budget/i.test(e.data.error)?'There are too many buildings to open at once. Zoom in and try again.':e.data.code==='RELEASE_CHANGED'?'The data is being updated. Try again in a moment.':e.data.error);if(e.data.code==='RELEASE_CHANGED')checkUpdates();return;}
        if(e.data.limited&&!exact&&!sameBox(requested,box)){loadView(true);return;}
        const d=e.data,result={data:d.data,fields:Array.from(new Set([...entry.fields,...d.data.features.flatMap(f=>Object.keys(f.properties))])),bounds:requested.slice(),view:box.slice(),bytes:d.bytes,limited:!!d.limited,loadedAt:new Date().toISOString()};remember(result);
        if(l.visible&&map.getZoom()>=14&&(sameBox(box,bounds())||!result.limited&&contains(requested,bounds())))publish(result);
        else loadView();
      };
      worker.onerror=e=>{if(rev!==revision||stopped)return;clearTimeout(queryTimeout);worker?.terminate();worker=null;pendingBounds=null;l.error=true;note(e.message||'USBF reader could not start.');};
      worker.postMessage({bounds:requested,tiles});
    }
    function schedule(){if(stopped)return;clearTimeout(queryTimer);coverageVisibility();const box=bounds();if(l.visible&&map.getZoom()>=14&&validBox(box)&&cached(box)){loadView();return;}if(worker&&pendingBounds&&contains(pendingBounds,box)&&map.getZoom()>=14){l.navigationMetrics.pendingReuses++;return;}l.loaded=false;l.error=false;note(displayed?'Updating buildings…':'Loading buildings…',true);queryTimer=setTimeout(loadView,250);}
    async function checkUpdates(force=false){
      if(stopped)return;if(checking)return checking;
      l.checkingRelease=true;update();manifestController=new AbortController();
      checking=(async()=>{
        const u=new URL(manifestURL);u.searchParams.set('_check',String(Date.now()));
        const timeout=setTimeout(()=>manifestController?.abort(),30000);
        try{
          const r=await fetch(u,{cache:'no-store',credentials:'omit',signal:manifestController.signal});if(!r.ok)throw Error('USBF manifest returned HTTP '+r.status+'.');
          const text=await r.text();if(text.length>20*1024*1024)throw Error('USBF manifest exceeds the supported index size.');const next=parseManifest(JSON.parse(text));if(stopped)return;
          const changed=manifest?.signature!==next.signature;manifest=next;lastCheck=Date.now();
          l.release={name:next.release,updated:next.updated,checked:lastCheck,buildings:next.buildings,tiles:next.count};l.releaseWarning='';
          if(changed){
            invalidate();
            const features=next.tiles.map(t=>{const [w,s,e,n]=t.tile_bbox;return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}};});map.getSource(coverageSource)?.setData({type:'FeatureCollection',features});
          }
          const pub=document.querySelector('#usbf-publication');if(pub)pub.textContent=next.buildings.toLocaleString()+' published buildings · '+next.count.toLocaleString()+' tiles';
          if(changed||force||!l.loaded)loadView();else update();
        }catch(e){if(stopped)return;l.releaseWarning='Update check failed: '+(e.name==='AbortError'?'source timeout':e.message);if(!manifest){l.error=true;const pub=document.querySelector('#usbf-publication');if(pub)pub.textContent='Publication check unavailable. Retry from the layer controls.';note('USBF is unavailable right now. Refresh data or try another place.');}else update();}
        finally{clearTimeout(timeout);l.checkingRelease=false;checking=null;if(!stopped)update();}
      })();return checking;
    }
    const onVisible=()=>{if(document.visibilityState==='visible'&&l.visible&&Date.now()-lastCheck>30000)checkUpdates();};
    const interval=setInterval(()=>{if(l.visible&&document.visibilityState!=='hidden')checkUpdates();},pollMs);
    map.on('moveend',schedule);document.addEventListener('visibilitychange',onVisible);
    l.clearCache=()=>{cancel();displayedCacheValid=false;cache.clear();cacheBytes=0;cacheState();l.viewLoading=false;l.loaded=!!displayed;note(displayed?'Cache cleared · current view kept':'Cache cleared · move the map to reload');};
    l.reload=()=>{coverageVisibility();if(l.visible&&Date.now()-lastCheck>pollMs)checkUpdates(true);else loadView();};l.checkUpdates=()=>checkUpdates(true);
    l.stop=()=>{stopped=true;cancel();cache.clear();cacheBytes=0;cacheState();displayed=null;clearInterval(interval);manifestController?.abort();map.off('moveend',schedule);document.removeEventListener('visibilitychange',onVisible);if(map.getLayer(coverageLayer))map.removeLayer(coverageLayer);if(map.getSource(coverageSource))map.removeSource(coverageSource);};
    checkUpdates();
  }
  globalThis.PortalUSBF={entry,columns,parseManifest,selectTiles,buffered,tileURL,normalize,attach,pollMs,manifestURL};
})();
