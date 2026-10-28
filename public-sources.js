/* Verified public providers. Dynamic sources fetch only a bounded map view. */
(function(){
  'use strict';
  const empty=()=>({type:'FeatureCollection',features:[]});
  const usBounds=[[-180,18],[-66,72]];
  const catalog=[
    {id:'microsoft-usa',name:'Microsoft US footprints · Esri tiles',type:'vector',sourceLayer:'MSBFLow',fields:[],url:'https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Microsoft_Building_Footprints/VectorTileServer/tile/{z}/{y}/{x}.pbf',maxzoom:19,color:'#4e83b5',category:'Independent footprints',description:'Independent Microsoft footprints, hosted by Esri. Legacy 125-million-footprint snapshot with limited tile attributes; newer Microsoft files are linked below.',scope:'United States · legacy vector tiles',attribution:'Microsoft building footprints / Esri · ODbL',page:'https://www.arcgis.com/home/item.html?id=f40326b0dea54330ae39584012807126',license:'ODbL 1.0',provider:'Microsoft / Esri',bounds:usBounds},
    {id:'gba-usa',name:'GlobalBuildingAtlas · US footprints & heights',type:'viewport',driver:'gba',fields:['id','source','height','var','region','height_m','country_iso'],heightField:'height_m',color:'#996a46',category:'Independent footprints',description:'US buildings and estimated heights from the September 2025 GeoParquet mirror. Loads the current neighborhood at zoom 14+. Original source codes and height uncertainty are retained.',scope:'United States · footprints + LoD1 heights',attribution:'GlobalBuildingAtlas · Zhu et al., TUM (2025); GeoParquet hosted by Taylor Geospatial / Source Cooperative · CC BY-NC 4.0 + ODbL components',page:'https://source.coop/tge-labs/globalbuildingatlas-lod1',license:'GBA.LoD1: CC BY-NC 4.0; ODbL source components',provider:'GlobalBuildingAtlas / Taylor Geospatial',coverageBounds:[[-180,18],[180,75]],bounds:usBounds,minViewZoom:14,sourceNote:'September 2025 merged mirror. Supplied height is an estimate; -999 and nonpositive heights are shown as missing. This mirror predates the current split GBA release.',links:[['Current GBA release & licenses','https://github.com/zhu-xlab/GlobalBuildingAtlas']]},
    {id:'overture-buildings',name:'Overture Maps · Buildings',type:'pmtiles',sourceLayer:'building',url:'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-10-21.0/buildings.pmtiles',color:'#7475ad',category:'Independent footprints',description:'October 21, 2026 release of the merged building inventory, including US coverage. Tile geometry and attributes are simplified for inspection.',scope:'Global / US · 2026-10-21.0 · PMTiles',attribution:'Overture Maps Foundation and contributors · ODbL',page:'https://docs.overturemaps.org/examples/overture-tiles/',license:'ODbL 1.0',provider:'Overture Maps'},
    {id:'dc-government',name:'DC government · Building footprints',type:'viewport',driver:'arcgis',url:'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Facility_and_Structure/MapServer/1',fields:['OBJECTID','DESCRIPTION','FEATURECODE','CAPTUREYEAR','CAPTUREACTION','GLOBALID'],color:'#588664',category:'Government data',description:'Official DC OCTO building outlines. Queries the current neighborhood and keeps capture-year and source identifiers. This layer does not provide building height.',scope:'Washington, DC · live official API',attribution:'District of Columbia · Office of the Chief Technology Officer (OCTO)',page:'https://opendata.dc.gov/datasets/building-footprints',license:'DC GIS open data terms',provider:'DC government / OCTO',bounds:[[-77.12,38.79],[-76.90,39.0]],start:[-77.071,38.912,16],minViewZoom:14},
    {id:'nyc-government',name:'NYC government · Footprints & roof heights',type:'viewport',driver:'nyc',url:'https://data.cityofnewyork.us/resource/5zhs-2jue.geojson',fields:['bin','doitt_id','objectid','height_roof','ground_elevation','height_m','geom_source'],heightField:'height_m',color:'#817246',category:'Government data',description:'Official NYC OTI outlines and supplied roof heights above ground. Feet are converted to metres for LoD1 display; original values and geometry-source fields remain available.',scope:'New York City · live official API',attribution:'City of New York · Office of Technology and Innovation (OTI) · NYC Open Data',page:'https://data.cityofnewyork.us/Housing-Development/BUILDING/5zhs-2jue',license:'NYC Open Data terms of use',provider:'NYC government / OTI',bounds:[[-74.26,40.49],[-73.69,40.92]],start:[-73.985,40.748,16],minViewZoom:14,sourceNote:'height_m = positive height_roof × 0.3048. Original height fields are preserved. The generated shape_area field is retained without a ground-area conversion.',links:[['Official field definitions','https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BuildingFootprints.md']]}
  ];
  const resources=[
    {name:'Microsoft Building Footprints · HDX mirror',scope:'Source Cooperative · independent Microsoft files',description:'Newer Microsoft GlobalMLBuildingFootprints repackaged as GeoParquet, partitioned by country and quadkey. Includes UnitedStates. These files are independent of VIDA; this browser does not yet stream this mirror.',page:'https://source.coop/hdx/microsoft-open-buildings',license:'See HDX mirror and Microsoft release terms'},
    {name:'FEMA / ORNL · USA Structures',scope:'Federal government · nationwide inventory',description:'Official inventory of structures larger than 450 square feet. Downloads and documentation are available; the live feature query failed verification, so it is not offered as a working map layer.',page:'https://gis-fema.hub.arcgis.com/pages/usa-structures',license:'Federal government works / source terms'}
  ];
  async function json(url,signal){const r=await fetch(url,{signal,credentials:'omit'});if(!r.ok)throw Error('Source returned HTTP '+r.status+'.');const d=await r.json();if(d.error)throw Error(d.error.message||'The provider rejected this map query.');return d;}
  function intersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
  function extent(map){const b=map.getBounds();return [Math.max(-180,b.getWest()),Math.max(-85,b.getSouth()),Math.min(180,b.getEast()),Math.min(85,b.getNorth())];}
  async function query(cfg,b,signal){
    if(cfg.driver==='arcgis'){
      const u=new URL(cfg.url+'/query');u.search=new URLSearchParams({f:'geojson',where:'1=1',geometry:JSON.stringify({xmin:b[0],ymin:b[1],xmax:b[2],ymax:b[3],spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',orderByFields:'OBJECTID ASC',resultRecordCount:'2000',returnGeometry:'true'});
      const d=await json(u,signal);return {data:d,limited:!!d.exceededTransferLimit||d.features?.length>=2000};
    }
    const wkt='POLYGON(('+[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]].map(p=>p.join(' ')).join(',')+'))';
    const u=new URL(cfg.url);u.search=new URLSearchParams({'$where':"intersects(the_geom,'"+wkt+"')",'$limit':'5000','$order':'doitt_id'});
    const d=await json(u,signal);for(const f of d.features||[]){const p=f.properties||{};const h=Number(p.height_roof);p.height_m=p.height_roof!==null&&p.height_roof!==''&&Number.isFinite(h)&&h>0?h*.3048:null;}
    return {data:d,limited:d.features?.length>=5000};
  }
  function attach(l,map,update){
    if(l.cfg.driver==='usbf'){PortalUSBF.attach(l,map,update);return;}
    let stopped=false,timer,requestTimer,controller,worker,workerReject,revision=0;
    const cfg=l.cfg;
    function cancel(){revision++;clearTimeout(timer);clearTimeout(requestTimer);controller?.abort();workerReject?.(new DOMException('View changed','AbortError'));workerReject=null;worker?.terminate();worker=null;}
    function status(note,loading=false){l.viewNote=note;l.viewLoading=loading;update();}
    function clear(note){l.loaded=false;l.viewBytes=0;l.viewLimited=false;l.viewBounds=null;l.viewLoadedAt=null;l.data=empty();map.getSource(l.id)?.setData(l.data);l.error=false;status(note);}
    async function load(){
      cancel();const rev=revision;if(stopped||!map.getSource(l.id))return;
      if(!l.visible){clear('Hidden · map queries paused');return;}
      const b=extent(map),coverage=(cfg.coverageBounds||cfg.bounds).flat();
      if(b[0]>=b[2]||!intersects(b,coverage)){clear('Outside this source’s coverage');return;}
      if(map.getZoom()<cfg.minViewZoom||(b[2]-b[0])*(b[3]-b[1])>.04){clear('Zoom to a neighborhood (level '+cfg.minViewZoom+'+) to load footprints');return;}
      // Clear the previous view before requesting, so stale geometry is never exported as this view.
      clear('Loading current map view…');l.viewLoading=true;update();
      controller=new AbortController();const timeout=requestTimer=setTimeout(()=>{if(rev!==revision)return;controller?.abort();workerReject?.(Error('The provider timed out. Retry this view.'));worker?.terminate();},60000);
      try{
        let result;
        if(cfg.driver==='gba'){
          result=await new Promise((resolve,reject)=>{
            workerReject=reject;worker=new Worker(new URL('./gba-worker.js?v=1.0',document.baseURI),{type:'module'});
            worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data);
            worker.onerror=e=>reject(Error(e.message||'GBA reader could not start.'));
            worker.postMessage({bounds:b});
          });
        }else result=await query(cfg,b,controller.signal);
        if(stopped||rev!==revision||!map.getSource(l.id))return;
        if(!result.data||!Array.isArray(result.data.features))throw Error('The provider did not return building features.');
        l.data=result.data;l.loaded=true;l.error=false;l.viewBytes=result.bytes||0;l.viewLimited=!!result.limited;l.viewBounds=b.slice();l.viewLoadedAt=new Date().toISOString();
        l.fields=Array.from(new Set([...l.fields,...result.data.features.flatMap(f=>Object.keys(f.properties||{}))]));
        map.getSource(l.id).setData(l.data);
        status(result.data.features.length.toLocaleString()+' features in requested view'+(result.limited?' · view limit reached; zoom in':'')+(result.bytes?' · '+(result.bytes/1048576).toFixed(1)+' MB read':''));
      }catch(e){if(!stopped&&rev===revision){l.error=true;status(e.name==='AbortError'?'Request timed out. Retry this view.':e.message);}}
      finally{clearTimeout(timeout);if(rev===revision){workerReject=null;worker?.terminate();worker=null;l.viewLoading=false;update();}}
    }
    const schedule=()=>{cancel();clear('Updating current map view…');timer=setTimeout(load,450);};map.on('moveend',schedule);l.reload=load;l.stop=()=>{stopped=true;cancel();map.off('moveend',schedule);};schedule();
  }
  window.PortalPublicSources={catalog,resources,attach,empty};
})();
