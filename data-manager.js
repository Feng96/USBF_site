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
  ];
  let api, map, protocol, seq=0, selected=null, tab='catalog';
  const layers=new Map(), pending=new Set();
  const text = v => {const n=document.createElement('span');n.textContent=String(v);return n.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;');};
  const uid = () => 'user-data-'+(++seq);
  function message(s,error=false){const el=$('#data-message');el.textContent=s;el.hidden=!s;el.classList.toggle('error',error);}
  function sourceTab(t){tab=t;document.querySelectorAll('[data-source-tab]').forEach(b=>{const active=b.dataset.sourceTab===t;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});['catalog','url','file'].forEach(k=>$('#source-panel-'+k).hidden=k!==t);message('');}
  function open(t='catalog') {sourceTab(t);if(!$('#data-dialog').open)$('#data-dialog').showModal();renderCatalog();}
  function renderCatalog(){
    $('#data-catalog-cards').innerHTML=catalog.map(c=>{
      const added=Array.from(layers.values()).some(l=>l.cfg.id===c.id),loading=pending.has(c.id);
      return '<article class="source-card"><div class="source-card-icon" style="--source-color:'+c.color+'">'+(c.type==='raster'?'▧':'▱')+'</div><div class="source-card-copy"><div class="source-card-label">'+c.scope+(c.recommended?' <span>Recommended</span>':'')+'</div><h3>'+c.name+'</h3><p>'+c.description+'</p><a href="'+c.page+'" target="_blank" rel="noopener">Source &amp; license ↗</a></div><button class="source-add" data-catalog-add="'+c.id+'" '+(added||loading?'disabled':'')+'>'+(loading?'Adding…':added?'Added':'＋ Add')+'</button></article>';
    }).join('');
    $('#sidebar-catalog').innerHTML=catalog.map(c=>'<button class="catalog-entry" data-catalog-add="'+c.id+'"><span class="catalog-swatch" style="background:'+c.color+'"></span><span><strong>'+c.name+'</strong><small>'+c.scope+'</small></span><span>＋</span></button>').join('');
  }
  function refresh(){
    if(!map)return;
    const entries=Array.from(layers.values()).reverse();
    $('#added-layers').innerHTML=entries.length?'<div class="added-heading">ADDED DATA <span>'+entries.length+'</span></div>'+entries.map(l=>'<article class="added-row layer-row" data-added-row="'+l.id+'"><div class="added-main"><input type="checkbox" data-added-toggle="'+l.id+'" aria-label="Show '+text(l.cfg.name)+'" '+(l.visible?'checked':'')+'><span class="catalog-swatch" style="background:'+l.color+'"></span><strong>'+text(l.cfg.name)+'</strong><button data-added-remove="'+l.id+'" title="Remove layer" aria-label="Remove '+text(l.cfg.name)+'">×</button></div><p class="added-state '+(l.error?'error':'')+'">'+text(l.error?'Tile request failed. Check the source or retry.':l.loaded?'Connected · '+l.cfg.type.toUpperCase():'Loading map tiles…')+'</p><div class="added-actions"><button data-added-zoom="'+l.id+'">Zoom to layer</button>'+(l.error?'<button data-added-retry="'+l.id+'">Retry</button>':'')+'<button data-added-info="'+l.id+'">Details</button></div><label class="added-opacity">Opacity<input type="range" min="0" max="100" value="'+Math.round(l.opacity*100)+'" data-added-opacity="'+l.id+'" aria-label="'+text(l.cfg.name)+' opacity"><output>'+Math.round(l.opacity*100)+'%</output></label></article>').join(''):'<div class="empty-layers"><strong>Your map starts here</strong><p>Add a catalog layer, connect a URL or open a GeoJSON file.</p><button class="text-button" data-add-data>+ Add your first layer</button></div>';
    const demo=['footprints','original','height','lod2'].filter(k=>$('#layer-'+k).checked).length;
    $('#layer-count').textContent=layers.size+demo;
    $('#data-workspace-label').textContent=layers.size?layers.size+' added '+(layers.size===1?'layer':'layers'):(demo?'Synthetic demo layers':'No data layers added');
    $('#data-badge b').textContent=layers.size?'ADDED DATA':demo?'SYNTHETIC DEMO':'ADD A DATA LAYER';
    $('#map-data-context').textContent=layers.size?'Added data':demo?'Synthetic demo':'Reference map';
    const visible=entries.filter(x=>x.visible);
    if(visible.length){$('#legend-card').hidden=false;$('.legend-body').innerHTML=visible.map(l=>'<div><i class="legend-swatch" style="background:'+l.color+'"></i>'+text(l.cfg.name)+'</div>').join('')+'<p>Source attributes · click a feature to inspect</p>'+(demo?'<p>Demo overlays also visible</p>':'');}
    else if(!demo)$('#legend-card').hidden=true;
    const filter=$('#layer-filter');if(filter.value)filter.dispatchEvent(new Event('input'));
    renderCatalog();
  }
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
    function geom(g){if(!g)return;const depth={Point:0,MultiPoint:1,LineString:1,MultiLineString:2,Polygon:2,MultiPolygon:3};if(g.type==='GeometryCollection'){if(!Array.isArray(g.geometries))throw Error('Invalid geometry collection.');g.geometries.forEach(geom);}else if(Object.hasOwn(depth,g.type)){coord(g.coordinates,depth[g.type]);}else throw Error('Unsupported GeoJSON geometry.');}
    data.features.forEach(f=>{if(!f||f.type!=='Feature')throw Error('Invalid GeoJSON feature.');geom(f.geometry);});if(!positions)throw Error('No geometry to display.');
    return {data,bounds};
  }
  async function add(cfg,options={}) {
    if(!map){message('The map is still loading. Please try again shortly.',true);return;}
    const key=cfg.id||cfg.url;if(pending.has(key))return;
    if(Array.from(layers.values()).some(l=>cfg.id?l.cfg.id===cfg.id:l.cfg.url===cfg.url&&l.cfg.sourceLayer===cfg.sourceLayer)){message('This layer is already in the map.');return;}
    pending.add(key);renderCatalog();message('Connecting to '+cfg.name+'…');let l;
    try{
      const id=uid();l={id,cfg:{...cfg},color:cfg.color||'#4b78a1',opacity:options.opacity??.75,visible:options.visible!==false,renderIds:[],bounds:cfg.bounds,loaded:false,error:false};let source;
      if(cfg.type==='pmtiles'){
        if(!window.pmtiles)throw Error('PMTiles support could not load. Reload the page.');
        const url=https(cfg.url),archive=new pmtiles.PMTiles(url);const [header,meta]=await timeout(Promise.all([archive.getHeader(),archive.getMetadata()]));
        if(header.tileType!==1)throw Error('Use a vector PMTiles archive for this data type.');
        const names=(meta.vector_layers||[]).map(v=>v.id);let sourceLayer=cfg.sourceLayer||names[0];
        if(!cfg.sourceLayer&&names.length>1)throw Error('This archive has multiple source layers. Enter one of: '+names.slice(0,12).join(', ')+(names.length>12?'…':''));
        if(!sourceLayer||!names.includes(sourceLayer))throw Error('Source layer not found. Available: '+names.slice(0,12).join(', '));
        if(Array.from(layers.values()).some(x=>x.cfg.url===url&&x.cfg.sourceLayer===sourceLayer)){message('This source layer is already in the map.');return;}
        l.cfg.sourceLayer=sourceLayer;l.bounds=[[header.minLon,header.minLat],[header.maxLon,header.maxLat]];protocol.add(archive);
        source={type:'vector',url:'pmtiles://'+url,attribution:text(cfg.attribution||'User-added PMTiles')};
      }else if(cfg.type==='geojson'){
        const valid=geojson(cfg.data||await readJSON(https(cfg.url)));l.data=valid.data;l.bounds=valid.bounds;source={type:'geojson',data:l.data,attribution:text(cfg.attribution||'User-added GeoJSON')};
      }else if(cfg.type==='raster'){
        https(cfg.url);if(!['{z}','{x}','{y}'].every(k=>cfg.url.includes(k)))throw Error('XYZ URL must contain {z}, {x} and {y}.');
        source={type:'raster',tiles:[cfg.url],tileSize:256,maxzoom:cfg.maxzoom??19,attribution:text(cfg.attribution||'User-added raster tiles')};
      }else throw Error('Unsupported data type.');
      map.addSource(id,source);layers.set(id,l);
      const before=cfg.type==='raster'?(map.getStyle().layers.find(x=>!x.id.startsWith('base-')&&x.id!=='background')||{}).id:'measure-line';
      function insert(spec){map.addLayer({...spec,id:id+'-'+spec.type,source:id,layout:{visibility:l.visible?'visible':'none'},...(cfg.type==='pmtiles'?{'source-layer':l.cfg.sourceLayer}:{})},before);l.renderIds.push(id+'-'+spec.type);}
      if(cfg.type==='raster')insert({type:'raster',paint:{'raster-opacity':l.opacity}});
      else{
        insert({type:'fill',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':l.color,'fill-opacity':l.opacity}});
        insert({type:'line',filter:['in',['geometry-type'],['literal',['Polygon','LineString']]],paint:{'line-color':l.color,'line-width':1.2,'line-opacity':l.opacity}});
        insert({type:'circle',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':l.color,'circle-radius':5,'circle-opacity':l.opacity,'circle-stroke-width':1,'circle-stroke-color':'#ffffff'}});
      }
      if(!options.restore){api.clearSelection();selected=null;['footprints','original','height','lod2'].forEach(k=>{const c=$('#layer-'+k);if(c.checked){c.checked=false;c.dispatchEvent(new Event('change'));}});$('#welcome-card').hidden=true;$('#tab-layers').click();if(cfg.type==='geojson')zoom(l);}
      refresh();api.saveView();$('#status-message').textContent='Added '+cfg.name;message('Added '+cfg.name+'.');if(!options.restore)$('#data-dialog').close();
    }catch(e){if(l){l.renderIds.forEach(id=>{if(map.getLayer(id))map.removeLayer(id);});if(map.getSource(l.id))map.removeSource(l.id);layers.delete(l.id);}message(e.message||'Unable to add this source. Check its URL and browser access.',true);}
    finally{pending.delete(key);renderCatalog();}
  }
  function zoom(l){if(l.bounds)map.fitBounds(l.bounds,{padding:55,maxZoom:17,duration:0});else message('This source does not provide an extent.');}
  function remove(id){const l=layers.get(id);if(!l)return;if(selected&&selected.layer===id){selected=null;api.clearSelection();}l.renderIds.forEach(k=>map.removeLayer(k));map.removeSource(id);layers.delete(id);refresh();api.saveView();}
  function opacity(l,v){l.opacity=v;l.renderIds.forEach(id=>{const type=map.getLayer(id).type;map.setPaintProperty(id,type+'-opacity',v);});api.saveView();}
  function clearExternalSelection(){selected=null;}
  function inspect(l,f){
    api.clearSelection();selected={layer:l.id,feature:f};$('#properties').hidden=false;$('#welcome-card').hidden=true;
    const props=f.properties||{};$('#properties-content').innerHTML='<span class="eyebrow">'+text(l.cfg.type==='pmtiles'?'TILED FEATURE':'ADDED DATA')+'</span><h2 class="feature-id">'+text(l.cfg.name)+'</h2><dl class="feature-properties">'+Object.entries(props).slice(0,80).map(([k,v])=>'<div><dt>'+text(k)+'</dt><dd>'+text(v===null?'Not provided':typeof v==='object'?JSON.stringify(v):v)+'</dd></div>').join('')+'</dl><p class="feature-notice">'+(l.cfg.type==='pmtiles'?'Tile geometry may be simplified or clipped. Use the source dataset for complete building geometries.':'Attributes are shown as supplied by this data source.')+'</p>'+(l.cfg.type==='geojson'?'<button class="feature-action" data-added-export="'+l.id+'">Export this GeoJSON layer</button>':'')+(l.cfg.page?'<a class="source-detail-link" target="_blank" rel="noopener" href="'+text(l.cfg.page)+'">Source data &amp; license ↗</a>':'');
    $('#status-message').textContent='Feature selected · '+l.cfg.name;setTimeout(()=>map.resize(),10);
  }
  function identify(e){const ids=Array.from(layers.values()).filter(l=>l.visible&&l.cfg.type!=='raster').flatMap(l=>l.renderIds);if(!ids.length)return false;const hits=map.queryRenderedFeatures(e.point,{layers:ids});if(!hits.length)return false;const l=layers.get(hits[0].source);if(!l)return false;inspect(l,hits[0]);return true;}
  function exportLayer(l){if(!l||!l.data)return;const url=URL.createObjectURL(new Blob([JSON.stringify(l.data)],{type:'application/geo+json'})),a=document.createElement('a');a.href=url;a.download=l.cfg.name.replace(/[^a-z0-9_-]/gi,'_')+'.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function handleExport(){if(selected){const l=layers.get(selected.layer);if(l?.data)exportLayer(l);else{open();message('Tiled features are clipped for display. Download full geometries from the dataset source.');}return true;}if(layers.size){open();message('Select a GeoJSON feature to export its layer. For tiled layers, use Source & license to find full downloads.');return true;}return false;}
  function fullExtent(){const rows=Array.from(layers.values()).filter(l=>l.visible&&l.bounds);if(!rows.length)return false;const b=[[Math.min(...rows.map(l=>l.bounds[0][0])),Math.min(...rows.map(l=>l.bounds[0][1]))],[Math.max(...rows.map(l=>l.bounds[1][0])),Math.max(...rows.map(l=>l.bounds[1][1]))]];map.fitBounds(b,{padding:55,maxZoom:17,duration:0});return true;}
  function writeShare(q){const entries=Array.from(layers.values()).filter(l=>catalog.some(c=>c.id===l.cfg.id)).map(l=>[l.cfg.id,l.opacity.toFixed(2),l.visible?1:0].join(':'));if(entries.length)q.set('data',entries.join(','));}
  function details(l){open('url');$('#data-type').value=l.cfg.type;$('#data-name').value=l.cfg.name;$('#data-url').value=l.cfg.url||'';$('#data-source-layer').value=l.cfg.sourceLayer||'';$('#data-type').dispatchEvent(new Event('change'));message(l.cfg.attribution||'Local file — reopen after refresh.');}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-add-data],[data-source-tab],[data-catalog-add],[data-added-remove],[data-added-zoom],[data-added-retry],[data-added-info],[data-added-export]');if(!b)return;
    if(b.hasAttribute('data-add-data'))open();
    if(b.dataset.sourceTab)sourceTab(b.dataset.sourceTab);
    if(b.dataset.catalogAdd){const c=catalog.find(c=>c.id===b.dataset.catalogAdd);open();if(c)add(c);}
    if(b.dataset.addedRemove)remove(b.dataset.addedRemove);
    const l=layers.get(b.dataset.addedZoom||b.dataset.addedRetry||b.dataset.addedInfo||b.dataset.addedExport);if(!l)return;
    if(b.dataset.addedZoom)zoom(l);if(b.dataset.addedInfo)details(l);if(b.dataset.addedExport)exportLayer(l);
    if(b.dataset.addedRetry){const cfg=l.cfg;remove(l.id);open();add(cfg);}
  });
  document.addEventListener('change',e=>{const id=e.target.dataset.addedToggle,l=layers.get(id);if(l){l.visible=e.target.checked;l.renderIds.forEach(k=>map.setLayoutProperty(k,'visibility',l.visible?'visible':'none'));refresh();api.saveView();}});
  document.addEventListener('input',e=>{const l=layers.get(e.target.dataset.addedOpacity);if(l){opacity(l,Number(e.target.value)/100);e.target.nextElementSibling.textContent=e.target.value+'%';}});
  document.addEventListener('keydown',e=>{if(e.target.matches('[data-source-tab]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const tabs=['catalog','url','file'],n=(tabs.indexOf(tab)+(e.key==='ArrowRight'?1:2))%3;sourceTab(tabs[n]);$('#source-tab-'+tabs[n]).focus();}});
  async function init(portal,hash){api=portal;map=api.map;if(window.pmtiles){protocol=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',protocol.tile);}
    $('#close-data-dialog').onclick=()=>$('#data-dialog').close();
    $('#data-type').onchange=()=>{const t=$('#data-type').value;$('#source-layer-field').hidden=t!=='pmtiles';$('#url-hint').textContent=t==='raster'?'Use an XYZ tile URL with {z}, {x} and {y}. The service must allow browser access.':t==='geojson'?'Public GeoJSON in WGS84 longitude / latitude, up to 20 MB. The server must allow browser access.':'Use a direct file URL. The server must allow browser access and byte-range requests.';};
    $('#data-url-form').onsubmit=e=>{e.preventDefault();add({type:$('#data-type').value,name:$('#data-name').value.trim()||'Connected data',url:$('#data-url').value.trim(),sourceLayer:$('#data-source-layer').value.trim()||undefined});};
    $('#data-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>20*1024*1024)throw Error('Choose a GeoJSON file smaller than 20 MB.');await add({id:'file-'+(++seq),name:file.name,type:'geojson',data:JSON.parse(await file.text())});}catch(err){message(err.message,true);}finally{e.target.value='';}};
    document.querySelector('[data-action=clear-selection]').addEventListener('click',clearExternalSelection);
    map.on('error',e=>{const l=layers.get(e.sourceId);if(l){l.error=true;l.loaded=false;refresh();}});
    map.on('sourcedata',e=>{const l=layers.get(e.sourceId);if(l&&e.isSourceLoaded&&!l.loaded&&!l.error){l.loaded=true;refresh();}});
    renderCatalog();refresh();const q=new URLSearchParams((hash||'').slice(1));
    for(const saved of (q.get('data')||'').split(',').slice(0,10)){const [id,op,on]=saved.split(':'),c=catalog.find(c=>c.id===id);if(c){const n=Number(op);await add(c,{restore:true,opacity:Number.isFinite(n)?Math.max(0,Math.min(1,n)):.75,visible:on!=='0'});$('#welcome-card').hidden=true;}}
  }
  window.PortalLayers={init,open,refresh,fullExtent,identify,writeShare,handleExport,clearExternalSelection,catalog,get layers(){return layers;},add};
})();
