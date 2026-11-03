/* Verified public providers. Dynamic sources fetch only a bounded map view. */
(function(){
  'use strict';
  const empty=()=>({type:'FeatureCollection',features:[]});
  const usBounds=[[-180,18],[-66,72]];
  const catalog=[
    {id:'osm-buildings',name:'OpenStreetMap buildings · OpenFreeMap',type:'vector',tilejson:true,sourceLayer:'building',fields:['colour','hide_3d','render_height','render_min_height'],url:'https://tiles.openfreemap.org/planet/latest',maxzoom:14,color:'#c88738',category:'Independent footprints',description:'Independent OSM building map, provided by OpenFreeMap using OpenMapTiles. Not a VIDA or USBF subset. Zoom into a city for buildings. Display geometry may be clipped or simplified; raw OSM data is linked separately.',scope:'Global including United States · OSM vector tiles',attribution:'OpenFreeMap © OpenMapTiles · Data from OpenStreetMap contributors · ODbL 1.0',page:'https://openfreemap.org/quick_start/',license:'OpenStreetMap contributors · ODbL 1.0; OpenMapTiles attribution',provider:'OpenStreetMap / OpenFreeMap',dataRole:'buildings',allowHeight:false,bounds:[[-180,-85],[180,85]],start:[-77.071,38.912,16],minViewZoom:13,sourceNote:'OSM building-layer display tiles, independent of the merged VIDA and USBF products. Tile records are previews, not complete original OSM features. render_height and render_min_height are cartographic rendering values and may include estimates or defaults; this connection does not use them as measured heights. Data follows the latest OpenFreeMap publication when reopened.',links:[['Provider and attribution','https://openfreemap.org/'],['Original OSM buildings and tags','https://layercake.openstreetmap.us/layers/buildings/'],['OSM regional extracts','https://download.geofabrik.de/north-america/us.html'],['OSM license','https://www.openstreetmap.org/copyright']]},
    {id:'microsoft-usa',name:'Microsoft US footprints · Esri tiles',type:'vector',sourceLayer:'MSBFLow',fields:[],url:'https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Microsoft_Building_Footprints/VectorTileServer/tile/{z}/{y}/{x}.pbf',maxzoom:16,color:'#4e83b5',category:'Independent footprints',description:'Independent Microsoft footprints, hosted by Esri. Legacy 125-million-footprint snapshot with limited tile attributes; newer Microsoft files are linked below.',scope:'United States · legacy vector tiles',attribution:'Microsoft building footprints / Esri · ODbL',page:'https://www.arcgis.com/home/item.html?id=f40326b0dea54330ae39584012807126',license:'ODbL 1.0',provider:'Microsoft / Esri',bounds:usBounds},
    {id:'gba-usa',name:'GlobalBuildingAtlas · US footprints & heights',type:'viewport',driver:'gba',fields:['id','source','height','var','region','height_m','country_iso'],heightField:'height_m',color:'#996a46',category:'Independent footprints',description:'US buildings and estimated heights from the September 2025 GeoParquet mirror. Loads the current neighborhood at zoom 14+. Original source codes and height uncertainty are retained.',scope:'United States · footprints + LoD1 heights',attribution:'GlobalBuildingAtlas · Zhu et al., TUM (2025); GeoParquet hosted by Taylor Geospatial / Source Cooperative · CC BY-NC 4.0 + ODbL components',page:'https://source.coop/tge-labs/globalbuildingatlas-lod1',license:'GBA.LoD1: CC BY-NC 4.0; ODbL source components',provider:'GlobalBuildingAtlas / Taylor Geospatial',coverageBounds:[[-180,18],[180,75]],bounds:usBounds,minViewZoom:14,sourceNote:'September 2025 merged mirror. Supplied height is an estimate; -999 and nonpositive heights are shown as missing. This mirror predates the current split GBA release.',links:[['Current GBA release & licenses','https://github.com/zhu-xlab/GlobalBuildingAtlas']]},
    {id:'overture-buildings',name:'Overture Maps · Buildings',type:'pmtiles',sourceLayer:'building',url:'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-10-21.0/buildings.pmtiles',color:'#7475ad',category:'Independent footprints',description:'October 21, 2026 release of the merged building inventory, including US coverage. Tile geometry and attributes are simplified for inspection.',scope:'Global / US · 2026-10-21.0 · PMTiles',attribution:'Overture Maps Foundation and contributors · ODbL',page:'https://docs.overturemaps.org/examples/overture-tiles/',license:'ODbL 1.0',provider:'Overture Maps'},
    {id:'dc-government',name:'DC government · Building footprints',type:'viewport',driver:'arcgis',url:'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Facility_and_Structure/MapServer/1',fields:['OBJECTID','DESCRIPTION','FEATURECODE','CAPTUREYEAR','CAPTUREACTION','GLOBALID'],color:'#588664',category:'Government data',description:'Official DC OCTO building outlines. Queries the current neighborhood and keeps capture-year and source identifiers. This layer does not provide building height.',scope:'Washington, DC · live official API',attribution:'District of Columbia · Office of the Chief Technology Officer (OCTO)',page:'https://opendata.dc.gov/datasets/building-footprints',license:'DC GIS open data terms',provider:'DC government / OCTO',bounds:[[-77.12,38.79],[-76.90,39.0]],start:[-77.071,38.912,16],minViewZoom:14},
    {id:'nyc-government',name:'NYC government · Footprints & roof heights',type:'viewport',driver:'nyc',url:'https://data.cityofnewyork.us/resource/5zhs-2jue.geojson',fields:['bin','doitt_id','objectid','height_roof','ground_elevation','height_m','geom_source'],heightField:'height_m',color:'#817246',category:'Government data',description:'Official NYC OTI outlines and supplied roof heights above ground. Feet are converted to metres for LoD1 display; original values and geometry-source fields remain available.',scope:'New York City · live official API',attribution:'City of New York · Office of Technology and Innovation (OTI) · NYC Open Data',page:'https://data.cityofnewyork.us/Housing-Development/BUILDING/5zhs-2jue',license:'NYC Open Data terms of use',provider:'NYC government / OTI',bounds:[[-74.26,40.49],[-73.69,40.92]],start:[-73.985,40.748,16],minViewZoom:14,sourceNote:'height_m = positive height_roof × 0.3048. Original height fields are preserved. The generated shape_area field is retained without a ground-area conversion.',links:[['Official field definitions','https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BuildingFootprints.md']]}
  ];
  const resources=[
    {name:'OpenStreetMap · Original building data',scope:'OpenStreetMap US Layercake · global GeoParquet',description:'Original OSM building outlines and tags transformed into a building table by OpenStreetMap US. Independent of VIDA and USBF. This is a large global file; use spatially bounded queries or regional extracts rather than downloading it into the map automatically.',page:'https://layercake.openstreetmap.us/layers/buildings/',license:'OpenStreetMap contributors · ODbL 1.0'},
    {name:'Microsoft Building Footprints · HDX mirror',scope:'Source Cooperative · independent Microsoft files',description:'Newer Microsoft GlobalMLBuildingFootprints repackaged as GeoParquet, partitioned by country and quadkey. Includes UnitedStates. Choose UnitedStates for U.S. downloads. These files are independent of VIDA.',page:'https://source.coop/hdx/microsoft-open-buildings',license:'See HDX mirror and Microsoft release terms'},
    {name:'FEMA / ORNL · USA Structures',scope:'Federal government · nationwide inventory',description:'Official inventory of structures larger than 450 square feet. Download national structure files and read the source documentation.',page:'https://gis-fema.hub.arcgis.com/pages/usa-structures',license:'Federal government works / source terms'}
  ];
  const limits={features:50000,bytes:64*1024*1024,concurrency:3,cacheFeatures:50000,cacheViews:3,cacheAge:5*60*1000};
  function aborted(signal){if(signal?.aborted)throw new DOMException('View changed','AbortError');}
  async function json(url,signal,budget){
    aborted(signal);
    const r=await fetch(url,{signal,credentials:'omit'});
    if(!r.ok)throw Error('Source returned HTTP '+r.status+'.');
    const reader=r.body.getReader(),parts=[];
    while(true){
      const {value,done}=await reader.read();if(done)break;
      budget.bytes+=value.byteLength;
      if(budget.bytes>limits.bytes){await reader.cancel();throw Error('This view exceeds the download limit. Zoom in and retry.');}
      parts.push(value);
    }
    aborted(signal);const d=JSON.parse(await new Blob(parts).text());
    if(d.error)throw Error(d.error.message||'The provider rejected this map query.');return d;
  }
  function intersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
  function contains(a,b){return a&&a[0]<=b[0]+1e-9&&a[1]<=b[1]+1e-9&&a[2]>=b[2]-1e-9&&a[3]>=b[3]-1e-9;}
  function extent(map){const b=map.getBounds();return [Math.max(-180,b.getWest()),Math.max(-85,b.getSouth()),Math.min(180,b.getEast()),Math.min(85,b.getNorth())];}
  function buffered(b,coverage){const x=(b[2]-b[0])*.1,y=(b[3]-b[1])*.1;return [Math.max(coverage[0],b[0]-x),Math.max(coverage[1],b[1]-y),Math.min(coverage[2],b[2]+x),Math.min(coverage[3],b[3]+y)];}
  function recordKey(f){const p=f.properties||{};for(const k of ['OBJECTID','objectid','doitt_id'])if(p[k]!==null&&p[k]!==undefined)return k+':'+p[k];return f.id!==undefined?'id:'+f.id:JSON.stringify([f.geometry,p]);}
  async function query(cfg,b,signal,onProgress){
    // Snapshot the matching IDs/count first, then fetch every page. A page cap is
    // never evidence that a view is complete. Cancel sibling requests on failure.
    const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
    const budget={bytes:0},records=new Map();let expected=0;
    function receive(features){
      aborted(signal);aborted(controller.signal);
      if(!Array.isArray(features))throw Error('The provider did not return building features.');
      for(const f of features)records.set(recordKey(f),f);
      onProgress?.({data:{type:'FeatureCollection',features:Array.from(records.values())},expected,bytes:budget.bytes,limited:true});
    }
    async function pool(tasks,run){let next=0;await Promise.all(Array.from({length:Math.min(limits.concurrency,tasks.length)},async()=>{while(next<tasks.length){aborted(signal);aborted(controller.signal);await run(tasks[next++]);}}));}
    try{
      aborted(signal);
      if(cfg.driver==='arcgis'){
        const params={where:'1=1',geometry:JSON.stringify({xmin:b[0],ymin:b[1],xmax:b[2],ymax:b[3],spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects'};
        const url=extra=>{const u=new URL(cfg.url+'/query');u.search=new URLSearchParams({...params,...extra});return u;};
        const match=await json(url({f:'json',returnIdsOnly:'true'}),controller.signal,budget);
        if(!Array.isArray(match.objectIds)||match.exceededTransferLimit)throw Error('The provider could not list all matching buildings. Retry this view.');
        const ids=Array.from(new Set(match.objectIds));expected=ids.length;
        const selected=ids.slice(0,limits.features),batches=[];for(let i=0;i<selected.length;i+=500)batches.push(selected.slice(i,i+500));
        async function batch(ids){
          const d=await json(url({f:'geojson',objectIds:ids.join(','),outFields:'*',outSR:'4326',returnGeometry:'true'}),controller.signal,budget);
          if(!Array.isArray(d.features))throw Error('The provider did not return building features.');
          // Some ArcGIS servers cap responses by geometry size as well as rows.
          if(d.exceededTransferLimit&&ids.length>1){const m=Math.ceil(ids.length/2);await batch(ids.slice(0,m));await batch(ids.slice(m));return;}
          const returned=new Set(d.features.map(f=>String(f.properties?.[match.objectIdFieldName||'OBJECTID']??f.id)));
          if(d.exceededTransferLimit||returned.size!==ids.length||!ids.every(id=>returned.has(String(id))))throw Error('The source changed or a page arrived incomplete. Retry this view.');
          receive(d.features);
        }
        await pool(batches,batch);
      }else if(cfg.driver==='nyc'){
        const wkt='POLYGON(('+[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]].map(p=>p.join(' ')).join(',')+'))',where="intersects(the_geom,'"+wkt+"')";
        const url=(extra,count=false)=>{const u=new URL(cfg.url);if(count)u.pathname=u.pathname.replace(/\.geojson$/,'.json');u.search=new URLSearchParams({'$where':where,...extra});return u;};
        const count=await json(url({'$select':'count(*)'},true),controller.signal,budget);expected=Number(count[0]?.count);
        if(!Number.isSafeInteger(expected)||expected<0)throw Error('The provider could not count this view. Retry this view.');
        const selected=Math.min(expected,limits.features),pages=[];for(let offset=0;offset<selected;offset+=1000)pages.push({offset,size:Math.min(1000,selected-offset)});
        await pool(pages,async({offset,size})=>{
          const d=await json(url({'$limit':String(size),'$offset':String(offset),'$order':':id'}),controller.signal,budget);
          if(!Array.isArray(d.features)||d.features.length!==size)throw Error('The source changed or a page arrived incomplete. Retry this view.');
          for(const f of d.features){const p=f.properties||{},h=Number(p.height_roof);p.height_m=p.height_roof!==null&&p.height_roof!==''&&Number.isFinite(h)&&h>0?h*.3048:null;}
          receive(d.features);
        });
      }else throw Error('Unsupported neighborhood source.');
      const target=Math.min(expected,limits.features);
      if(records.size!==target)throw Error('The source changed or duplicate pages arrived. Retry this view.');
      return {data:{type:'FeatureCollection',features:Array.from(records.values())},expected,bytes:budget.bytes,limited:expected>limits.features};
    }catch(error){controller.abort();throw error;}
    finally{signal?.removeEventListener('abort',cancel);}
  }
  function attach(l,map,update){
    if(l.cfg.driver==='usbf'){PortalUSBF.attach(l,map,update);return;}
    let stopped=false,timer,requestTimer,controller,worker,workerJob,revision=0,cacheFeatures=0;
    const cfg=l.cfg,cache=new Map();
    function cancel(){revision++;clearTimeout(timer);clearTimeout(requestTimer);controller?.abort();if(workerJob){worker?.postMessage({type:'cancel',id:workerJob.id});workerJob.reject(new DOMException('View changed','AbortError'));workerJob=null;}}
    function status(note,loading=false){l.viewNote=note;l.viewLoading=loading;update();}
    function clear(note){l.loaded=false;l.viewBytes=0;l.viewLimited=false;l.viewExpected=null;l.viewBounds=null;l.viewLoadedAt=null;l.data=empty();if(l.setData)l.setData(l.data);else map.getSource(l.id)?.setData(l.data);l.error=false;status(note);}
    function apply(result,b,loading){
      l.data=result.data;l.loaded=true;l.error=false;l.viewBytes=result.bytes||0;l.viewLimited=loading||!!result.limited;l.viewExpected=result.expected??null;l.viewBounds=b.slice();l.viewLoadedAt=result.loadedAt||new Date().toISOString();
      l.fields=Array.from(new Set([...l.fields,...result.data.features.flatMap(f=>Object.keys(f.properties||{}))]));
      if(l.setData)l.setData(l.data);else map.getSource(l.id)?.setData(l.data);
      const n=result.data.features.length.toLocaleString('en-US'),total=Number.isFinite(result.expected)?result.expected.toLocaleString('en-US'):null;
      status(loading?'Loading buildings… '+n+(total?' / '+total:''):result.limited?n+' buildings · partial coverage · zoom in':n+' buildings loaded',loading);
    }
    function remember(result,b){
      if(result.limited||result.data.features.length>limits.cacheFeatures)return;
      const key=b.join(','),entry={result,b:b.slice(),at:Date.now()};
      if(cache.has(key))cacheFeatures-=cache.get(key).result.data.features.length;
      cache.delete(key);cache.set(key,entry);cacheFeatures+=result.data.features.length;
      while(cache.size>limits.cacheViews||cacheFeatures>limits.cacheFeatures){const key=cache.keys().next().value;cacheFeatures-=cache.get(key).result.data.features.length;cache.delete(key);}
    }
    function gba(b,rev,progress){
      if(!worker){
        worker=new Worker(new URL('./gba-worker.js?v=1.6.2-coverage',document.baseURI),{type:'module'});
        worker.onmessage=e=>{
          const d=e.data,job=workerJob;if(!job||d.id!==job.id)return;
          if(d.progress){job.features.push(...(d.chunk||[]));job.progress({data:{type:'FeatureCollection',features:job.features.slice()},bytes:d.bytes,limited:true});}
          else{workerJob=null;d.error?job.reject(Error(d.error)):job.resolve(d);}
        };
        worker.onerror=e=>{const job=workerJob;workerJob=null;worker?.terminate();worker=null;job?.reject(Error(e.message||'GBA reader could not start.'));};
      }
      return new Promise((resolve,reject)=>{workerJob={id:rev,resolve,reject,progress,features:[]};worker.postMessage({id:rev,bounds:b});});
    }
    async function load(force=false){
      cancel();const rev=revision;if(stopped||!map.getSource(l.id))return;
      if(!l.visible){clear('Layer hidden · loading paused');return;}
      const b=extent(map),coverage=(cfg.coverageBounds||cfg.bounds).flat();
      if(b[0]>=b[2]||!intersects(b,coverage)){clear('Outside this source’s coverage');return;}
      if(map.getZoom()<cfg.minViewZoom||(b[2]-b[0])*(b[3]-b[1])>.04){clear('Choose a place or zoom in to see buildings');return;}
      if(!force){
        const hit=Array.from(cache.values()).reverse().find(entry=>Date.now()-entry.at<limits.cacheAge&&contains(entry.b,b));
        if(hit){apply(hit.result,hit.b,false);return;}
      }
      const requested=buffered(b,coverage);let received=false;
      // Keep rendered buildings during replacement; analysis stays blocked until
      // this request completes. Completed pages progressively replace that view.
      l.error=false;l.viewExpected=null;status('Loading buildings…',true);
      controller=new AbortController();
      const timeout=requestTimer=setTimeout(()=>{if(rev!==revision)return;controller?.abort();if(workerJob){worker?.postMessage({type:'cancel',id:workerJob.id});workerJob.reject(Error('The provider timed out. Retry this view.'));workerJob=null;}},120000);
      const progress=result=>{if(stopped||rev!==revision||!map.getSource(l.id))return;received=true;apply(result,requested,true);};
      try{
        const result=cfg.driver==='gba'?await gba(requested,rev,progress):await query(cfg,requested,controller.signal,progress);
        if(stopped||rev!==revision||!map.getSource(l.id))return;
        if(!result.data||!Array.isArray(result.data.features))throw Error('The provider did not return building features.');
        result.loadedAt=new Date().toISOString();apply(result,requested,false);remember(result,requested);
      }catch(e){if(!stopped&&rev===revision){l.error=true;l.viewLimited=true;if(!received){l.loaded=false;l.viewBounds=null;}status('Building coverage incomplete. '+(e.name==='AbortError'?'Request timed out. Retry this view.':e.message));}}
      finally{clearTimeout(timeout);if(rev===revision){l.viewLoading=false;update();}}
    }
    const schedule=()=>{cancel();if(stopped)return;status('Loading buildings in this view…',true);timer=setTimeout(()=>load(),300);};
    map.on('moveend',schedule);l.reload=()=>load(true);
    l.clearCache=()=>{const interrupted=l.viewLoading;cancel();cache.clear();cacheFeatures=0;worker?.terminate();worker=null;l.viewLoading=false;if(interrupted){l.error=true;l.viewLimited=true;status('Building coverage incomplete. Loading cancelled. Retry this view.');}else update();};
    l.stop=()=>{stopped=true;cancel();worker?.terminate();worker=null;cache.clear();map.off('moveend',schedule);};schedule();
  }
  window.PortalPublicSources={catalog,resources,attach,empty,query,limits};
})();
