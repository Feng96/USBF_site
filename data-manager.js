/* Public sources and browser-local imports. No uploaded files or credentials. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const base = 'https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/';
  const vidaPage = 'https://source.coop/vida/google-microsoft-osm-open-buildings';
  const catalog = [
    {id:'vida-usa',name:'VIDA Buildings · United States',type:'pmtiles',url:base+'by_country/country_iso=USA/USA.pmtiles',sourceLayer:'USA',color:'#287f76',description:'Combined footprints for the US. Start here for a national building layer.',scope:'United States · PMTiles',attribution:'VIDA / Google / Microsoft / OpenStreetMap · ODbL',page:vidaPage,license:'ODbL 1.0',recommended:true},
    {id:'vida-world',name:'VIDA Buildings · Global',type:'pmtiles',url:base+'goog_msft_osm.pmtiles',sourceLayer:'goog_msft_osm_building_footprints',color:'#a16b35',description:'The merged global product in one layer. Overlaps the US layer; use one at a time for comparison.',scope:'Global · PMTiles',attribution:'VIDA / Google / Microsoft / OpenStreetMap · ODbL',page:vidaPage,license:'ODbL 1.0'},
    {id:'usgs-imagery',name:'USGS Orthoimagery',type:'raster',url:'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',maxzoom:16,color:'#77785b',description:'The National Map imagery; largely NAIP in the contiguous US. Acquisition dates vary by location.',scope:'United States · imagery tiles',attribution:'USDA, USGS The National Map: Orthoimagery',page:'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',license:'See source terms',bounds:[[-125,24],[-66,50]]}
    ,{id:'training-heights',name:'3DBAG sample footprints & heights',type:'geojson',color:'#698aaa',description:'Twenty Dutch training-reference footprints with heights derived from their original roof meshes. A real LoD1 preview, separate from US coverage.',scope:'Netherlands · 20 training samples',attribution:'3DBAG / 3DGI · CC BY 4.0; display heights derived from frozen training roofs',page:'https://docs.3dbag.nl/en/copyright/',license:'CC BY 4.0',load:async()=>{const r=await fetch('./data/models/manifest.json');if(!r.ok)throw Error('Sample index could not load.');const d=await r.json();return {type:'FeatureCollection',features:d.models.filter(m=>m.collection==='training-reference').map(m=>({type:'Feature',id:m.id,geometry:m.footprint,properties:{model_id:m.id,source:'3DBAG training reference',city:m.city,country_iso:'NLD',height_m:m.height_m,height_basis:m.height_basis,data_role:'training_reference',license:'CC BY 4.0'}}))};}}
  ];
  catalog[0].category='VIDA combined & subsets';catalog[1].category='VIDA combined & subsets';
  catalog.push(...['microsoft','osm'].map((source,i)=>({...catalog[0],id:'vida-'+source+'-usa',name:'VIDA US · '+(i?'OpenStreetMap':'Microsoft')+' subset',recommended:false,color:i?'#448a72':'#4e83b5',fixedSource:source,description:'Only '+(i?'OpenStreetMap':'Microsoft')+'-labelled features retained in VIDA’s US merged release. This is a filtered subset, not the complete independent original dataset.'})));
  catalog.push(...PortalPublicSources.catalog);
  catalog[0].recommended=false;catalog.unshift(PortalUSBF.entry);
  let catalogQuery='';
  const isTiled=l=>l.renderTiled===true||['pmtiles','vector'].includes(l.cfg.type);
  const isRaster=l=>['raster','image','raster-pmtiles'].includes(l.cfg.type)||l.cfg.sourceKind==='raster';
  let api, map, protocol, seq=0, selected=null, active=null, tab='catalog',generation=0;
  const layers=new Map(), pending=new Map();
  const text = v => {const n=document.createElement('span');n.textContent=String(v);return n.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;');};
  const uid = () => 'user-data-'+(++seq);
  function message(s,error=false){const el=$('#data-message');el.textContent=s;el.hidden=!s;el.classList.toggle('error',error);}
  function sourceTab(t){tab=t;document.querySelectorAll('[data-source-tab]').forEach(b=>{const active=b.dataset.sourceTab===t;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});['catalog','url','file'].forEach(k=>$('#source-panel-'+k).hidden=k!==t);message('');}
  function open(t='catalog') {sourceTab(t);if(!$('#data-dialog').open)$('#data-dialog').showModal();renderCatalog();}
  function renderCatalog(){
    const matches=c=>((c.id||'')+' '+c.name+' '+c.description+' '+c.scope+' '+(c.category||'')).toLowerCase().includes(catalogQuery);
    const group=c=>c.category||(c.id==='training-heights'?'Research samples':'Reference imagery');
    const categories=['Our USBF data','Independent footprints','VIDA combined & subsets','Government data','Reference imagery','Research samples'],cards=[];
    for(const category of categories){const entries=catalog.filter(c=>group(c)===category&&matches(c));if(!entries.length)continue;
      cards.push('<h3 class="catalog-category">'+text(category)+'</h3>');
      for(const c of entries){const added=Array.from(layers.values()).some(l=>l.cfg.id===c.id),loading=pending.has(c.id);
        cards.push('<article class="source-card"><div class="source-card-icon" style="--source-color:'+c.color+'">'+(c.type==='raster'?'▧':'▱')+'</div><div class="source-card-copy"><div class="source-card-label">'+text(c.scope)+(c.recommended?' <span>Recommended</span>':'')+'</div><h3>'+text(c.name)+'</h3><p>'+text(c.description)+'</p><small class="source-license">'+text(c.license)+'</small><a href="'+c.page+'" target="_blank" rel="noopener">Source &amp; license ↗</a>'+(c.links||[]).map(([name,url])=>' · <a href="'+url+'" target="_blank" rel="noopener">'+text(name)+' ↗</a>').join('')+'</div><button class="source-add" data-catalog-add="'+c.id+'" '+(added||loading?'disabled':'')+'>'+(loading?'Adding…':added?'Added':'＋ Add')+'</button></article>');
      }
    }
    $('#data-catalog-cards').innerHTML=cards.join('')||'<p class="source-intro">No matching map layers.</p>';
    $('#catalog-resources').innerHTML=PortalPublicSources.resources.filter(matches).map(c=>'<article class="source-card source-resource"><div class="source-card-copy"><div class="source-card-label">'+text(c.scope)+'</div><h3>'+text(c.name)+'</h3><p>'+text(c.description)+'</p><a href="'+c.page+'" target="_blank" rel="noopener">Source &amp; downloads ↗</a></div><span class="resource-badge">Downloads</span></article>').join('');
    $('#sidebar-catalog').innerHTML=categories.map(category=>'<h3 class="catalog-category">'+text(category)+'</h3>'+catalog.filter(c=>group(c)===category).map(c=>'<button class="catalog-entry" data-catalog-add="'+c.id+'"><span class="catalog-swatch" style="background:'+c.color+'"></span><span><strong>'+text(c.name)+'</strong><small>'+text(c.scope)+'</small></span><span>＋</span></button>').join('')).join('');
  }
  function releaseText(l){const release=l.renderTiled?l.displayRelease:l.release;return release?release.name+' · '+new Date(release.updated).toISOString().replace('T',' ').slice(0,16)+' UTC · checks every 5 min':'';}
  function refresh(){
    if(!map)return;syncOrder();
    if(!layers.has(active))active=(Array.from(layers.values()).find(l=>!isRaster(l))||layers.values().next().value)?.id||null;
    const entries=Array.from(layers.values()).reverse();
    $('#added-layers').innerHTML=entries.length?'<div class="added-heading">ADDED DATA <span>'+entries.length+'</span></div>'+entries.map((l,index)=>'<article class="added-row layer-row" data-added-row="'+l.id+'"><div class="added-main"><input type="checkbox" data-added-toggle="'+l.id+'" aria-label="Show '+text(l.cfg.name)+'" '+(l.visible?'checked':'')+'><span class="catalog-swatch" style="background:'+l.color+'"></span><button class="layer-activate '+(active===l.id?'active':'')+'" data-layer-activate="'+l.id+'">'+text(l.cfg.name)+'</button><button data-added-remove="'+l.id+'" title="Remove layer" aria-label="Remove '+text(l.cfg.name)+'">×</button></div><details class="layer-details"><summary>Layer settings</summary><p class="added-state '+(l.error?'error':'')+'">'+text(l.viewNote||(l.error?'Tile request failed. Check the source or retry.':l.loaded?'Connected · '+l.cfg.type.toUpperCase():'Loading map tiles…'))+'</p><div class="added-actions"><button data-added-zoom="'+l.id+'">Zoom to layer</button>'+(l.error?'<button data-added-retry="'+l.id+'">Retry</button>':'')+'<button data-added-info="'+l.id+'">Details</button>'+(l.rasterResource?'<button data-raster-style="'+l.id+'">Raster style</button>':'')+''+(l.checkUpdates?'<button data-added-update="'+l.id+'" '+(l.checkingRelease?'disabled':'')+'>'+(l.checkingRelease?'Refreshing…':'Refresh data')+'</button>':'')+'</div><div class="layer-order-actions"><button data-layer-up="'+l.id+'" '+(index===0?'disabled':'')+' aria-label="Move '+text(l.cfg.name)+' up">Move up</button><button data-layer-down="'+l.id+'" '+(index===entries.length-1?'disabled':'')+' aria-label="Move '+text(l.cfg.name)+' down">Move down</button></div><label class="added-name">Name<input data-added-name="'+l.id+'" maxlength="100" value="'+text(l.cfg.name)+'"></label><label class="added-color">Color<input type="color" data-added-color="'+l.id+'" value="'+l.color+'"></label>'+(releaseText(l)?'<p class="added-release">'+text(releaseText(l))+'</p>':'')+(l.releaseWarning?'<p class="added-state error">'+text(l.releaseWarning)+'</p>':'')+'<label class="added-opacity">Opacity<input type="range" min="0" max="100" value="'+Math.round(l.opacity*100)+'" data-added-opacity="'+l.id+'" aria-label="'+text(l.cfg.name)+' opacity"><output>'+Math.round(l.opacity*100)+'%</output></label></details></article>').join(''):'<div class="empty-layers"><strong>No layers added</strong><p>Choose a dataset or open your own file.</p><button class="text-button" data-add-data>+ Add data</button></div>';
    const demo=['footprints','original','height','lod2'].filter(k=>$('#layer-'+k).checked).length;
    $('#layer-count').textContent=layers.size+demo;
    $('#data-workspace-label').textContent=layers.size?layers.size+' added '+(layers.size===1?'layer':'layers'):(demo?'Synthetic demo layers':'No data layers added');
    $('#data-badge b').textContent=layers.size?'ADDED DATA':demo?'SYNTHETIC DEMO':'ADD A DATA LAYER';
    $('#map-data-context').textContent=layers.size?'Added data':demo?'Synthetic demo':'Reference map';
    const visible=entries.filter(x=>x.visible);
    if(visible.length){$('#legend-card').hidden=false;PortalLegend.render(visible,$('.legend-body'));if(demo)$('.legend-body').insertAdjacentHTML('beforeend','<p>Synthetic demo overlays also visible</p>');}
    else if(!demo)$('#legend-card').hidden=true;
    const filter=$('#layer-filter');if(filter.value)filter.dispatchEvent(new Event('input'));
    renderCatalog();document.dispatchEvent(new CustomEvent('portal-layers-changed'));
  }
  function attributePreview(value){const raw=value===null?'Not provided':typeof value==='object'?JSON.stringify(value):String(value),shortened=raw.length>1800;return text(shortened?raw.slice(0,1800)+'…':raw)+(shortened?'<small class="feature-notice">Preview shortened. Download the data for the full value.</small>':'');}
  function https(raw){let u;try{u=new URL(raw);}catch(e){throw Error('Enter a complete HTTPS URL.');}if(u.protocol!=='https:'||u.username||u.password)throw Error('Use a public HTTPS URL without embedded credentials.');return u.href;}
  function timeout(p){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The source did not respond within 30 seconds. Please retry.')),30000);})]).finally(()=>clearTimeout(timer));}
  async function readJSON(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{
    const res=await fetch(url,{signal:controller.signal,credentials:'omit'});if(!res.ok)throw Error('Source returned HTTP '+res.status+'.');
    const limit=20*1024*1024;if(Number(res.headers.get('content-length'))>limit)throw Error('GeoJSON exceeds 20 MB. Use tiled data for larger layers.');
    const reader=res.body.getReader(),parts=[];let length=0;
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('GeoJSON exceeds 20 MB. Use tiled data for larger layers.');}parts.push(value);}
    return JSON.parse(await new Blob(parts).text());
  }finally{clearTimeout(timer);}}
  function geojson(data){
    if(data&&data.type==='Feature')data={type:'FeatureCollection',features:[data]};
    if(!data||data.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length)throw Error('Choose a nonempty GeoJSON FeatureCollection or Feature.');
    if(data.features.length>50000)throw Error('Use PMTiles for more than 50,000 features.');
    const bounds=[[180,90],[-180,-90]];let positions=0;
    function coord(c,depth){if(!Array.isArray(c)||!c.length)throw Error('Invalid GeoJSON coordinates.');if(depth){c.forEach(x=>coord(x,depth-1));return;}if(c.length<2||!c.every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>90)throw Error('GeoJSON must use WGS84 longitude / latitude.');bounds[0][0]=Math.min(bounds[0][0],c[0]);bounds[0][1]=Math.min(bounds[0][1],c[1]);bounds[1][0]=Math.max(bounds[1][0],c[0]);bounds[1][1]=Math.max(bounds[1][1],c[1]);if(++positions>1000000)throw Error('Too many coordinates; use tiled data.');}
    function shape(g){const c=g.coordinates,line=p=>{if(!Array.isArray(p)||p.length<2)throw Error('A line needs at least two positions.');},ring=p=>{if(!Array.isArray(p)||p.length<4||!Array.isArray(p[0])||!Array.isArray(p[p.length-1])||p[0].length!==p[p.length-1].length||p[0].some((v,i)=>v!==p[p.length-1][i]))throw Error('A polygon ring needs at least four positions with matching start and end coordinates.');};if(g.type==='LineString')line(c);if(g.type==='MultiLineString')c.forEach(line);if(g.type==='Polygon')c.forEach(ring);if(g.type==='MultiPolygon')c.forEach(p=>p.forEach(ring));}
    function geom(g){if(!g)return;const depth={Point:0,MultiPoint:1,LineString:1,MultiLineString:2,Polygon:2,MultiPolygon:3};if(g.type==='GeometryCollection'){if(!Array.isArray(g.geometries))throw Error('Invalid geometry collection.');g.geometries.forEach(geom);}else if(Object.hasOwn(depth,g.type)){coord(g.coordinates,depth[g.type]);shape(g);}else throw Error('Unsupported GeoJSON geometry.');}
    data.features.forEach(f=>{if(!f||f.type!=='Feature')throw Error('Invalid GeoJSON feature.');if(f.properties!==undefined&&f.properties!==null&&(typeof f.properties!=='object'||Array.isArray(f.properties)))throw Error('Feature attributes must be an object or null.');if(f.id!==undefined&&!(typeof f.id==='string'||typeof f.id==='number'&&Number.isFinite(f.id)))throw Error('Feature identifiers must be text or finite numbers.');geom(f.geometry);});if(!positions)throw Error('No geometry to display.');
    return {data,bounds};
  }
  async function add(cfg,options={}) {
    if(!map){message('The map is still loading. Please try again shortly.',true);return;}
    const key=cfg.id||cfg.url;if(pending.has(key))return;
    if(!options.allowDuplicate&&Array.from(layers.values()).some(l=>cfg.id?l.cfg.id===cfg.id:l.cfg.url===cfg.url&&l.cfg.sourceLayer===cfg.sourceLayer)){message('This layer is already in the map.');return;}
    const request=Symbol(key),startGeneration=generation;pending.set(key,request);renderCatalog();message('Connecting to '+cfg.name+'…');let l;
    try{
      const id=uid();l={id,cfg:{...cfg},color:cfg.color||'#4b78a1',opacity:options.opacity??.75,visible:options.visible!==false,renderIds:[],fields:[],bounds:cfg.bounds,loaded:false,error:false,filters:{},colorMode:options.colorMode||'uniform',sourceFilter:options.sourceFilter||'',minArea:options.minArea||0,heightField:cfg.allowHeight===false?null:options.heightField||cfg.heightField||null};l.setData=data=>{const display=PortalSourceFeatures.prepare(l,data);map.getSource(l.id)?.setData(display);return display;};let source;
      if(cfg.type==='pmtiles'){
        if(!window.pmtiles)throw Error('PMTiles support could not load. Reload the page.');
        const archive=cfg.localArchive||new pmtiles.PMTiles(https(cfg.url)),url=archive.source.getKey();const [header,meta]=await timeout(Promise.all([archive.getHeader(),archive.getMetadata()]));
        if(![1,2,3,4,5].includes(header.tileType))throw Error('This archive has an unsupported PMTiles tile type.');
        const names=(meta.vector_layers||[]).map(v=>v.id);let sourceLayer=cfg.sourceLayer||names[0];
        if(header.tileType===1&&!cfg.sourceLayer&&names.length>1)throw Error('This archive has multiple source layers. Enter one of: '+names.slice(0,12).join(', ')+(names.length>12?'…':''));
        if(header.tileType===1&&(!sourceLayer||!names.includes(sourceLayer)))throw Error('Source layer not found. Available: '+names.slice(0,12).join(', '));
        if(!options.allowDuplicate&&Array.from(layers.values()).some(x=>x.cfg.url===url&&x.cfg.sourceLayer===sourceLayer&&x.cfg.fixedSource===cfg.fixedSource)){message('This source layer is already in the map.');return;}
        l.fields=Object.keys((meta.vector_layers||[]).find(x=>x.id===sourceLayer)?.fields||{});l.cfg.sourceLayer=sourceLayer;l.bounds=[[header.minLon,header.minLat],[header.maxLon,header.maxLat]];protocol.add(archive);l.cfg.analysisQuality='render-tiles';l.cfg.sourceKind=header.tileType===1?'vector':'raster';if(header.tileType!==1){l.cfg.type='raster-pmtiles';l.cfg.sourceLayer=undefined;}if(cfg.localArchive)l.stop=()=>protocol.tiles.delete(url);
        source={type:header.tileType===1?'vector':'raster',url:'pmtiles://'+url,attribution:text(cfg.attribution||'User-added PMTiles'),...(header.tileType===1?{}:{tileSize:Number(meta.tileSize)||256})};
      }else if(cfg.type==='vector'){
        if(!cfg.sourceLayer)throw Error('Enter the vector tile source-layer name.');https(cfg.url);if(!['{z}','{x}','{y}'].every(k=>cfg.url.includes(k)))throw Error('Vector XYZ URL must contain {z}, {x} and {y}.');l.fields=cfg.fields||[];source={type:'vector',tiles:[cfg.url],minzoom:0,maxzoom:cfg.maxzoom??19,attribution:text(cfg.attribution||'User-supplied vector tiles')};
      }else if(cfg.type==='viewport'){
        l.data=PortalPublicSources.empty();l.fields=cfg.fields||[];source={type:'geojson',data:PortalSourceFeatures.prepare(l,l.data),attribution:text(cfg.attribution||'User-supplied vector tiles')};
        if(cfg.driver==='usbf'){
          const connection=await PortalUSBF.prepare(l),display=connection.display;
          if(display){
            if(!window.pmtiles)throw Error('Map tiles could not load. Reload the page.');
            const archive=new pmtiles.PMTiles(display.url),[header,metadata]=await timeout(Promise.all([archive.getHeader(),archive.getMetadata()]));
            if(header.tileType!==1||!(metadata.vector_layers||[]).some(layer=>layer.id===display.source_layer))throw Error('The building map has no supported footprint layer.');
            protocol.add(archive);l.cfg.sourceLayer=display.source_layer;l.cfg.sourceKind='vector';
            source={type:'vector',url:'pmtiles://'+display.url,attribution:text(cfg.attribution||'USBF / opengeos')};
          }
        }
      }else if(cfg.type==='geojson'){
        const valid=geojson(cfg.data||(cfg.load?await cfg.load():await readJSON(https(cfg.url))));l.data=valid.data;l.fields=Array.from(new Set(l.data.features.flatMap(f=>Object.keys(f.properties||{}))));l.bounds=valid.bounds;if(l.data.analysis?.operation||l.data.provenance?.geometryQuality==='derived-source-geometry'){l.cfg.allowHeight=false;l.heightField=null;}source={type:'geojson',data:PortalSourceFeatures.prepare(l,l.data),attribution:text(cfg.attribution||'User-added GeoJSON')};
      }else if(cfg.type==='image'){
        if(!Array.isArray(cfg.coordinates)||cfg.coordinates.length!==4||!cfg.coordinates.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85.05113))throw Error('Raster corners must use valid Web Mercator display bounds.');
        source={type:'image',url:cfg.imageURL,coordinates:cfg.coordinates};l.cfg.sourceKind='raster';l.cfg.analysisQuality='display-raster';l.viewNote=cfg.sourceNote||'Georeferenced raster preview';l.stop=()=>cfg.cleanup?.();
      }else if(cfg.type==='raster'){
        https(cfg.url);if(cfg.service==='wms'?!cfg.url.includes('{bbox-epsg-3857}'):!['{z}','{x}','{y}'].every(k=>cfg.url.includes(k)))throw Error('XYZ needs {z}, {x}, {y}; WMS needs {bbox-epsg-3857}.');
        source={type:'raster',tiles:[cfg.url],tileSize:256,maxzoom:cfg.maxzoom??19,attribution:text(cfg.attribution||'User-added raster tiles')};
      }else throw Error('Unsupported data type.');
      if(startGeneration!==generation)throw Error('The map changed before this layer finished opening.');
      map.addSource(id,source);layers.set(id,l);active=id;
      const before=isRaster(l)?(map.getStyle().layers.find(x=>!x.id.startsWith('base-')&&x.id!=='background')||{}).id:'measure-line';
      function insert(spec){map.addLayer({...spec,id:id+'-'+spec.type,source:id,layout:{visibility:l.visible?'visible':'none'},...(isTiled(l)?{'source-layer':l.cfg.sourceLayer}:{})},before);l.renderIds.push(id+'-'+spec.type);if(spec.filter)l.filters[id+'-'+spec.type]=spec.filter;}
      if(isRaster(l))insert({type:'raster',paint:{'raster-opacity':l.opacity}});
      else{
        insert({type:'fill',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':l.color,'fill-opacity':l.opacity}});
        insert({type:'line',filter:['in',['geometry-type'],['literal',['Polygon','LineString']]],paint:{'line-color':l.color,'line-width':1.2,'line-opacity':l.opacity}});
        insert({type:'circle',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':l.color,'circle-radius':5,'circle-opacity':l.opacity,'circle-stroke-width':1,'circle-stroke-color':'#ffffff'}});
      }
      if(!isRaster(l)){l.heightField=l.cfg.allowHeight===false?null:l.heightField||['height_m','height','render_height'].find(f=>l.fields.includes(f))||null;if(l.heightField){insert({type:'fill-extrusion',filter:['all',['==',['geometry-type'],'Polygon'],['>', ['coalesce',['to-number',['get',l.heightField]],0],0]],paint:{'fill-extrusion-color':l.color,'fill-extrusion-height':['coalesce',['to-number',['get',l.heightField]],0],'fill-extrusion-opacity':l.opacity}});}applyStyle(l);}
      if(!options.restore){api.clearSelection();selected=null;['footprints','original','height','lod2'].forEach(k=>{const c=$('#layer-'+k);if(c.checked){c.checked=false;c.dispatchEvent(new Event('change'));}});$('#welcome-card').hidden=true;$('#tab-layers').click();if(['geojson','image'].includes(cfg.type)||cfg.localArchive)zoom(l);}
      if(cfg.type==='viewport'){l.onDataChanged=()=>{if(selected?.layer!==l.id)return;const fresh=l.featureById?.get(String(selected.feature.properties?.usbf_id));if(fresh)inspect(l,fresh);else if(!l.renderTiled){clearExternalSelection();api.clearSelection();}};PortalPublicSources.attach(l,map,refresh);if(!options.restore&&cfg.start)map.jumpTo({center:cfg.start.slice(0,2),zoom:cfg.start[2],pitch:0});}
      refresh();api.saveView();$('#status-message').textContent='Added '+cfg.name;message('Added '+cfg.name+'.');if(!options.restore)$('#data-dialog').close();return l;
    }catch(e){if(l){l.stop?.();l.renderIds.forEach(id=>{if(map.getLayer(id))map.removeLayer(id);});if(map.getSource(l.id))map.removeSource(l.id);layers.delete(l.id);}message(e.message||'Unable to add this source. Check its URL and browser access.',true);if(options.throwOnError)throw e;}
    finally{if(pending.get(key)===request)pending.delete(key);renderCatalog();}
  }
  function zoom(l){if(l.bounds)map.fitBounds(l.bounds,{padding:55,maxZoom:17,duration:0});else message('This source does not provide an extent.');}
  function remove(id){const l=layers.get(id);if(!l)return;l.stop?.();if(selected&&selected.layer===id){selected=null;api.clearSelection();}l.renderIds.forEach(k=>map.removeLayer(k));map.removeSource(id);layers.delete(id);refresh();api.saveView();}
  function opacity(l,v){l.opacity=v;l.renderIds.forEach(id=>{const type=map.getLayer(id).type;map.setPaintProperty(id,type+'-opacity',v);});l.syncCoverageStyle?.();PortalLegend.render(Array.from(layers.values()).reverse().filter(l=>l.visible),$('.legend-body'));api.saveView();}
  function clearExternalSelection(){selected=null;if(map?.getSource('inventory-selection'))map.getSource('inventory-selection').setData({type:'FeatureCollection',features:[]});document.dispatchEvent(new CustomEvent('portal-selection-changed'));}
  function inspect(l,f){
    f=sourceFeature(l,f);if(!f){$('#status-message').textContent='Data changed. Select the feature again.';return false;}
    api.clearSelection();active=l.id;selected={layer:l.id,feature:f};if(map.getSource('inventory-selection'))map.getSource('inventory-selection').setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:f.geometry}]});$('#properties').hidden=false;$('#welcome-card').hidden=true;
    const props=f.properties||{},friendly=window.PortalExplorer?.renderFeature(l,f);$('#properties-content').innerHTML=friendly||'<span class="eyebrow">'+text(isTiled(l)?'TILED FEATURE':'ADDED DATA')+'</span><h2 class="feature-id">'+text(l.cfg.name)+'</h2><dl class="feature-properties">'+Object.entries(props).slice(0,80).map(([k,v])=>'<div><dt>'+text(k)+'</dt><dd>'+attributePreview(v)+'</dd></div>').join('')+'</dl><button class="feature-action" data-feature-zoom>Zoom to feature</button>'+(props.model_id?'<button class="feature-action" data-model-id="'+text(props.model_id)+'">Open this 3D sample</button>':'')+'<p class="feature-notice">'+(isTiled(l)?'Tile geometry may be simplified or clipped. Use the source dataset for complete building geometries.':text(l.cfg.sourceNote||'Attributes are shown as supplied by this data source.'))+'</p>'+(l.cfg.type==='geojson'?'<button class="feature-action" data-added-export="'+l.id+'">Export this GeoJSON layer</button>':'')+(l.cfg.page?'<a class="source-detail-link" target="_blank" rel="noopener" href="'+text(l.cfg.page)+'">Source data &amp; license ↗</a>':'');
    $('#status-message').textContent='Feature selected · '+l.cfg.name;setTimeout(()=>map.resize(),10);document.dispatchEvent(new CustomEvent('portal-selection-changed'));
  }
  function sourceFeature(l,f){if(l?.renderTiled)return f;return ['geojson','viewport'].includes(l?.cfg?.type)?PortalSourceFeatures.resolve(l,f):f;}
  function identify(e){const ids=Array.from(layers.values()).filter(l=>l.visible&&!isRaster(l)).flatMap(l=>l.renderIds);if(!ids.length)return false;const hits=map.queryRenderedFeatures(e.point,{layers:ids});if(!hits.length)return false;const l=layers.get(hits[0].source);if(!l)return false;inspect(l,hits[0]);return true;}
  function exportLayer(l){if(!l||!l.data)return;const url=URL.createObjectURL(new Blob([JSON.stringify(l.data)],{type:'application/geo+json'})),a=document.createElement('a');a.href=url;a.download=l.cfg.name.replace(/[^a-z0-9_-]/gi,'_')+'.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function handleExport(){if(window.PortalInventory&&layers.size){PortalInventory.exportDialog();return true;}if(selected){const l=layers.get(selected.layer);if(l?.data)exportLayer(l);else{open();message('Tiled features are clipped for display. Download full geometries from the dataset source.');}return true;}if(layers.size){open();message('Select a GeoJSON feature to export its layer. For tiled layers, use Source & license to find full downloads.');return true;}return false;}
  function fullExtent(){const rows=Array.from(layers.values()).filter(l=>l.visible&&l.bounds);if(!rows.length)return false;const b=[[Math.min(...rows.map(l=>l.bounds[0][0])),Math.min(...rows.map(l=>l.bounds[0][1]))],[Math.max(...rows.map(l=>l.bounds[1][0])),Math.max(...rows.map(l=>l.bounds[1][1]))]];map.fitBounds(b,{padding:55,maxZoom:17,duration:0});return true;}
  function writeShare(q){const styles=Array.from(layers.values()).filter(l=>catalog.some(c=>c.id===l.cfg.id)).map(l=>[l.cfg.id,l.colorMode,l.sourceFilter,l.minArea]);if(styles.some(x=>x[1]!=='uniform'||x[2]||x[3]))q.set('styles',JSON.stringify(styles));const entries=Array.from(layers.values()).filter(l=>catalog.some(c=>c.id===l.cfg.id)).map(l=>[l.cfg.id,l.opacity.toFixed(2),l.visible?1:0].join(':'));if(entries.length)q.set('data',entries.join(','));}
  function applyStyle(l){
    if(!map)return;if(isRaster(l)){for(const id of l.renderIds)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',l.visible?'visible':'none');return;}
    l.syncCoverageStyle?.();
    const sourceField=['bf_source','source','geom_source','SOURCE'].find(f=>l.fields?.includes(f));
    const color=PortalLegend.colorExpression(l);
    for(const id of l.renderIds){const type=map.getLayer(id).type;const extrusion=type==='fill-extrusion';map.setLayoutProperty(id,'visibility',l.visible&&(!extrusion||api.view3d)?'visible':'none');
      if(type!=='raster')map.setPaintProperty(id,type+'-color',color);
      const f=['all',...(l.filters[id]?[l.filters[id]]:[])];if(type==='fill'&&api.view3d&&l.heightField)f.push(['<=',['coalesce',['to-number',['get',l.heightField]],0],0]);if(l.sourceFilter&&sourceField)f.push(['==',['to-string',['get',sourceField]],l.sourceFilter]);if(l.cfg.fixedSource&&sourceField)f.push(['==',['downcase',['to-string',['get',sourceField]]],l.cfg.fixedSource]);const areaField=l.fields?.includes('area_in_meters')?'area_in_meters':l.fields?.includes('area_m2')?'area_m2':null;if(l.minArea>0&&areaField)f.push(['>=',['coalesce',['to-number',['get',areaField]],0],l.minArea]);map.setFilter(id,f);
    }
  }
  function setStyle(id,options){const l=layers.get(id);if(!l)return;Object.assign(l,options);applyStyle(l);if(options.opacity!==undefined)opacity(l,l.opacity);PortalLegend.render(Array.from(layers.values()).reverse().filter(l=>l.visible),$('.legend-body'));api.saveView();document.dispatchEvent(new CustomEvent('portal-style-changed'));}
  function syncOrder(){const order=map.getStyle().layers.map(x=>x.id),rows=Array.from(layers.values()).sort((a,b)=>Math.min(...a.renderIds.map(id=>order.indexOf(id)))-Math.min(...b.renderIds.map(id=>order.indexOf(id))));layers.clear();rows.forEach(l=>layers.set(l.id,l));return rows;}
  function reorder(id,direction){const rows=syncOrder(),at=rows.findIndex(l=>l.id===id),to=at+(direction==='up'?1:-1);if(at<0||to<0||to>=rows.length)return;[rows[at],rows[to]]=[rows[to],rows[at]];const rendered=map.getStyle().layers.map(x=>x.id);for(const l of rows)for(const part of rendered.filter(part=>part.startsWith(l.id+'-')))map.moveLayer(part,'measure-line');layers.clear();rows.forEach(l=>layers.set(l.id,l));refresh();api.saveView();}
  function set3D(){layers.forEach(applyStyle);}
  function details(l){if(window.PortalImport){PortalImport.details(l);return;}if(['viewport','vector','image','raster-pmtiles'].includes(l.cfg.type)){open();message(l.cfg.name+' · '+l.cfg.license+'. '+(l.cfg.sourceNote||l.cfg.description));return;}open('url');$('#data-type').value=l.cfg.type;$('#data-name').value=l.cfg.name;$('#data-url').value=l.cfg.url||'';$('#data-source-layer').value=l.cfg.sourceLayer||'';$('#data-type').dispatchEvent(new Event('change'));message(l.cfg.attribution||'Local file — reopen after refresh.');}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-add-data],[data-source-tab],[data-catalog-add],[data-added-remove],[data-added-zoom],[data-added-retry],[data-added-info],[data-raster-style],[data-added-update],[data-added-export],[data-layer-activate],[data-feature-zoom],[data-layer-up],[data-layer-down]');if(!b)return;
    if(b.hasAttribute('data-add-data'))open();
    if(b.dataset.sourceTab)sourceTab(b.dataset.sourceTab);
    if(b.dataset.catalogAdd){const c=catalog.find(c=>c.id===b.dataset.catalogAdd);open();if(c)add(c);}
    if(b.hasAttribute('data-feature-zoom')&&selected){const pts=[];const walk=c=>{if(Array.isArray(c)&&typeof c[0]==='number')pts.push(c);else if(Array.isArray(c))c.forEach(walk);};walk(selected.feature.geometry?.coordinates);if(pts.length)map.fitBounds([[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1]))],[Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]],{padding:70,maxZoom:19,duration:0});return;}
    if(b.dataset.layerUp||b.dataset.layerDown){reorder(b.dataset.layerUp||b.dataset.layerDown,b.dataset.layerUp?'up':'down');return;}
    if(b.dataset.layerActivate){active=b.dataset.layerActivate;refresh();return;}
    if(b.dataset.addedRemove)remove(b.dataset.addedRemove);
    const l=layers.get(b.dataset.addedZoom||b.dataset.addedRetry||b.dataset.addedInfo||b.dataset.rasterStyle||b.dataset.addedUpdate||b.dataset.addedExport);if(!l)return;
    if(b.dataset.rasterStyle)PortalImport.styleRaster(l);if(b.dataset.addedUpdate)l.checkUpdates?.();if(b.dataset.addedZoom)zoom(l);if(b.dataset.addedInfo)details(l);if(b.dataset.addedExport)exportLayer(l);
    if(b.dataset.addedRetry){const cfg=l.cfg;remove(l.id);open();add(cfg);}
  });
  document.addEventListener('change',e=>{const styled=layers.get(e.target.dataset.addedName||e.target.dataset.addedColor);if(styled){if(e.target.dataset.addedName){styled.cfg.name=e.target.value.trim().slice(0,100)||styled.cfg.name;}else{styled.color=e.target.value;applyStyle(styled);}refresh();api.saveView();return;}const id=e.target.dataset.addedToggle,l=layers.get(id);if(l){l.visible=e.target.checked;applyStyle(l);l.reload?.();refresh();api.saveView();}});
  document.addEventListener('input',e=>{const l=layers.get(e.target.dataset.addedOpacity);if(l){opacity(l,Number(e.target.value)/100);e.target.nextElementSibling.textContent=e.target.value+'%';}});
  document.addEventListener('keydown',e=>{if(e.target.matches('[data-source-tab]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const tabs=['catalog','url','file'],n=(tabs.indexOf(tab)+(e.key==='ArrowRight'?1:2))%3;sourceTab(tabs[n]);$('#source-tab-'+tabs[n]).focus();}});
  async function pmtilesRequest(request,controller){
    const response=await protocol.tile(request,controller);
    // MapLibre 5.6 image requests remain pending on null protocol data. A missing
    // raster tile is a 404, allowing sparse archives and rounded bounds to settle.
    if(request.type==='image'&&response?.data==null){const missing=Error('No raster tile at this archive coordinate.');missing.status=404;throw missing;}
    return response;
  }
  async function init(portal,hash){api=portal;map=api.map;if(window.pmtiles){protocol=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',pmtilesRequest);}
    $('#catalog-search').oninput=e=>{catalogQuery=e.target.value.trim().toLowerCase();renderCatalog();};
    $('#close-data-dialog').onclick=()=>$('#data-dialog').close();
    $('#data-type').onchange=()=>{const t=$('#data-type').value;$('#source-layer-field').hidden=t!=='pmtiles';$('#url-hint').textContent=t==='raster'?'Use an XYZ tile URL with {z}, {x} and {y}. The service must allow browser access.':t==='geojson'?'Public GeoJSON in WGS84 longitude / latitude, up to 20 MB. The server must allow browser access.':'Use a direct file URL. The server must allow browser access and byte-range requests.';};
    $('#data-url-form').onsubmit=e=>{e.preventDefault();add({type:$('#data-type').value,name:$('#data-name').value.trim()||'Connected data',url:$('#data-url').value.trim(),sourceLayer:$('#data-source-layer').value.trim()||undefined});};
    $('#data-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>20*1024*1024)throw Error('Choose a GeoJSON file smaller than 20 MB.');await add({id:'file-'+(++seq),name:file.name,type:'geojson',data:JSON.parse(await file.text())});}catch(err){message(err.message,true);}finally{e.target.value='';}};
    document.querySelector('[data-action=clear-selection]').addEventListener('click',clearExternalSelection);
    map.on('error',e=>{const l=layers.get(e.sourceId);if(l){l.error=true;l.loaded=false;refresh();}});
    map.on('sourcedata',e=>{const l=layers.get(e.sourceId);if(l&&l.cfg.type!=='viewport'&&e.isSourceLoaded&&!l.loaded&&!l.error){l.loaded=true;refresh();}});
    map.addSource('inventory-selection',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'inventory-selection-outline',type:'line',source:'inventory-selection',paint:{'line-color':'#14b8a6','line-width':3}});
    renderCatalog();refresh();const q=new URLSearchParams((hash||'').slice(1));
    let savedStyles=[];try{savedStyles=JSON.parse(q.get('styles')||'[]');if(!Array.isArray(savedStyles))savedStyles=[];}catch(e){}
    for(const saved of (q.get('data')||'').split(',').slice(0,20)){const [id,op,on]=saved.split(':'),c=catalog.find(c=>c.id===id);if(c){const n=Number(op);const st=savedStyles.find(x=>x[0]===id)||[];await add(c,{restore:true,colorMode:['uniform','source','height','change'].includes(st[1])?st[1]:'uniform',sourceFilter:typeof st[2]==='string'?st[2]:'',minArea:Number.isFinite(st[3])?Math.max(0,st[3]):0,opacity:Number.isFinite(n)?Math.max(0,Math.min(1,n)):.75,visible:on!=='0'});$('#welcome-card').hidden=true;}}
  }
  window.PortalLayers={sourceFeature,syncOrder,reorder,invalidatePending:()=>{generation++;pending.clear();renderCatalog();},validateGeoJSON:geojson,remove,clear:()=>{for(const id of Array.from(layers.keys()))remove(id);},init,open,refresh,fullExtent,identify,setStyle,set3D,inspect,get active(){return layers.get(active);},get selection(){return selected;},selectLayer(id){active=id;refresh();},writeShare,handleExport,clearExternalSelection,catalog,get layers(){return layers;},add,addGeoJSON:(name,data,meta={},options={})=>add({...meta,id:meta.id||'import-'+(++seq),name,type:'geojson',data,sourceKind:'vector',analysisQuality:meta.analysisQuality||'complete-geometry'}, {...options,throwOnError:true}),isRaster};
})();
