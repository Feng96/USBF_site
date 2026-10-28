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
    if(data?.release!=='USBF_v1'||data.layout!=='flat_half_degree_geographic_tiles'||data.crs!=='EPSG:4326'||data.tile_degrees!==.5||data.scope!=='CONUS48+DC'||!Array.isArray(data.files)||data.files.length>100000)throw Error('The USBF publication format has changed. This viewer needs an adapter update.');
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
    const coverageSource=l.id+'-publication',coverageLayer=l.id+'-publication-grid';
    map.addSource(coverageSource,{type:'geojson',data:empty()});
    map.addLayer({id:coverageLayer,type:'line',source:coverageSource,maxzoom:14,layout:{visibility:l.visible?'visible':'none'},paint:{'line-color':l.color,'line-width':.6,'line-opacity':l.opacity*.5}},'measure-line');
    l.syncCoverageStyle=()=>{if(map.getLayer(coverageLayer)){map.setPaintProperty(coverageLayer,'line-opacity',l.opacity*.5);map.setLayoutProperty(coverageLayer,'visibility',l.visible?'visible':'none');}};
    const coverageVisibility=()=>{if(map.getLayer(coverageLayer))map.setLayoutProperty(coverageLayer,'visibility',l.visible?'visible':'none');};
    function note(s,loading=false){l.viewNote=s;l.viewLoading=loading;update();}
    function cancel(){revision++;clearTimeout(queryTimer);clearTimeout(queryTimeout);worker?.terminate();worker=null;}
    function clear(s){l.loaded=false;l.viewBytes=0;l.data=empty();l.featureById=new Map();map.getSource(l.id)?.setData(l.data);note(s);}
    function bounds(){const b=map.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];}
    function loadView(){
      cancel();if(stopped||!map.getSource(l.id))return;coverageVisibility();
      if(!l.visible){clear('Hidden · automatic checks paused');return;}
      if(!manifest){clear('Connecting to the live USBF publication…');return;}
      const box=bounds();l.error=false;
      if(!validBox(box)||!intersects(box,[-125,24,-66,50])){clear('Outside published CONUS48 + DC coverage');return;}
      if(map.getZoom()<14||(box[2]-box[0])*(box[3]-box[1])>.04){clear('Publication grid · zoom to a neighborhood (14+) for footprints');return;}
      const tiles=selectTiles(manifest,box);if(!tiles.length){clear('No published USBF tile in this view');return;}
      if(tiles.length>9){clear('Zoom in to request fewer USBF tiles');return;}
      clear('Loading the current USBF view…');l.viewLoading=true;update();const rev=revision;
      worker=new Worker(new URL('./usbf-worker.js?v=0.6',document.baseURI),{type:'module'});
      queryTimeout=setTimeout(()=>{if(rev!==revision)return;worker?.terminate();worker=null;l.error=true;note('USBF read timed out. Use Check updates to retry.');},60000);
      worker.onmessage=e=>{
        if(stopped||rev!==revision)return;clearTimeout(queryTimeout);worker?.terminate();worker=null;
        if(e.data.error){l.error=true;note(e.data.error);if(e.data.code==='RELEASE_CHANGED')checkUpdates();return;}
        const d=e.data;l.data=d.data;l.featureById=new Map(d.data.features.map(f=>[String(f.properties.usbf_id),f]));l.loaded=true;l.error=false;l.viewBytes=d.bytes;
        l.fields=Array.from(new Set([...entry.fields,...d.data.features.flatMap(f=>Object.keys(f.properties))]));map.getSource(l.id).setData(l.data);l.onDataChanged?.();
        note(d.data.features.length.toLocaleString()+' buildings in buffered ownership view'+(d.limited?' · view limit reached; zoom in':'')+' · '+(d.bytes/1048576).toFixed(1)+' MB read');
      };
      worker.onerror=e=>{if(rev!==revision||stopped)return;clearTimeout(queryTimeout);worker?.terminate();worker=null;l.error=true;note(e.message||'USBF reader could not start.');};
      worker.postMessage({bounds:box,tiles});
    }
    function schedule(){cancel();if(stopped)return;clear('Updating the USBF map view…');coverageVisibility();queryTimer=setTimeout(loadView,450);}
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
            const features=next.tiles.map(t=>{const [w,s,e,n]=t.tile_bbox;return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}};});map.getSource(coverageSource)?.setData({type:'FeatureCollection',features});
          }
          const pub=document.querySelector('#usbf-publication');if(pub)pub.textContent=next.buildings.toLocaleString()+' published buildings · '+next.count.toLocaleString()+' tiles';
          if(changed||force||!l.loaded)loadView();else update();
        }catch(e){if(stopped)return;l.releaseWarning='Update check failed: '+(e.name==='AbortError'?'source timeout':e.message);if(!manifest){l.error=true;const pub=document.querySelector('#usbf-publication');if(pub)pub.textContent='Publication check unavailable. Retry from the layer controls.';note('USBF publication unavailable. Use Check updates to retry.');}else update();}
        finally{clearTimeout(timeout);l.checkingRelease=false;checking=null;if(!stopped)update();}
      })();return checking;
    }
    const onVisible=()=>{if(document.visibilityState==='visible'&&l.visible&&Date.now()-lastCheck>30000)checkUpdates();};
    const interval=setInterval(()=>{if(l.visible&&document.visibilityState!=='hidden')checkUpdates();},pollMs);
    map.on('moveend',schedule);document.addEventListener('visibilitychange',onVisible);
    l.reload=()=>{coverageVisibility();if(l.visible&&Date.now()-lastCheck>pollMs)checkUpdates(true);else loadView();};l.checkUpdates=()=>checkUpdates(true);
    l.stop=()=>{stopped=true;cancel();clearInterval(interval);manifestController?.abort();map.off('moveend',schedule);document.removeEventListener('visibilitychange',onVisible);if(map.getLayer(coverageLayer))map.removeLayer(coverageLayer);if(map.getSource(coverageSource))map.removeSource(coverageSource);};
    checkUpdates();
  }
  globalThis.PortalUSBF={entry,columns,parseManifest,selectTiles,buffered,tileURL,normalize,attach,pollMs,manifestURL};
})();
