(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  var paths = {
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    layers:'<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
    hand:'<path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v10c0 4-3 6-7 6-3 0-5-1-7-4l-3-5c-1-2 1-4 3-2l2 2"/>',
    pointer:'<path d="m5 3 15 9-7 2-3 7Z"/>',ruler:'<path d="m3 15 12-12 6 6L9 21Zm10-9 3 3m-6 0 2 2m-5 1 3 3m-6 0 2 2"/>',
    extent:'<path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M8 8h8v8H8Z"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4Z"/>',map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
    table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/>',
    share:'<circle cx="18" cy="5" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8 11 7-4M8 13l7 4"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
    fold:'<path d="m5 5 4 4 4-4M5 19l4-4 4 4M18 4v16"/>',
    'chevron-right':'<path d="m9 5 7 7-7 7"/>','chevron-down':'<path d="m5 9 7 7 7-7"/>','arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    external:'<path d="M14 3h7v7m0-7L10 14m0-10H4v16h16v-6"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    cube:'<path d="m12 2 10 6v9l-10 6L2 17V8Zm0 12v9M2 8l10 6 10-6M7 5l10 6"/>',
    height:'<path d="M5 21V9h6v12m0-16h6v16M3 21h17m0-18v12m-2-9 2-3 2 3m-4 6 2 3 2-3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M10 2h4l1 3 3 1 3 2-2 4 2 4-3 2-3 1-1 3h-4l-1-3-3-1-3-2 2-4-2-4 3-2 3-1Z"/>',sliders:'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',chart:'<path d="M3 3v18h18M7 17v-5m5 5V7m5 10v-8"/>',draw:'<path d="m4 16-1 5 5-1L20 8l-4-4Zm10-10 4 4"/>',analysis:'<circle cx="8" cy="12" r="6"/><circle cx="16" cy="12" r="6"/>',
    home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6"/>'
  };
  function icon(name) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name] || paths.info)+'</svg>'; }
  function hydrateIcons(root) { (root || document).querySelectorAll('[data-icon]').forEach(function (el) { el.innerHTML=icon(el.dataset.icon); }); }
  hydrateIcons();
  var map,collection,selected=null,tool='explore',measurePoints=[],toastTimer,tileFailures=0,activeBasemap='light',mapReady=false,view3d=false,hoverPopup;
  var featuresById=new Map(),homeBounds;
  var reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var basemaps={
    light:{name:'Light canvas',description:'Esri Light Gray Canvas · a quiet reference map',url:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',attribution:'Tiles &copy; Esri — Esri, HERE, Garmin, USGS',maxZoom:16},
    streets:{name:'OpenStreetMap',description:'Street names, places and local context',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19},
    satellite:{name:'Satellite imagery',description:'Esri World Imagery · reference imagery only',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',maxZoom:19}
  };
  function toast(message) { $('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('#toast').hidden=true;},4000); }
  function status(message) { $('#status-message').textContent=message; }
  function escapeHTML(v) { var span=document.createElement('span');span.textContent=String(v);return span.innerHTML; }
  function modal(kind) {
    if((kind==='catalog'||kind==='connections')&&window.PortalLayers){PortalLayers.open();return;}
    var title='',content='',eyebrow='US BUILDINGS · WORKSPACE';
    if(kind==='demo') {
      title='Sample shapes';
      content='<p>The optional synthetic demo layer contains generated footprints, heights and edit flags for testing the interface.</p><p>The USBF and public catalog layers contain source-attributed published data. LoD2 samples remain experimental.</p><p>合成演示层用于测试界面；USBF 图层直接读取已发布的数据。</p>';
    } else if(kind==='bookmarks') {
      title='Places to start';
      content='<p>Return to the demo area, or explore the reference basemap.</p><button class="dialog-option" data-bookmark="demo">'+icon('layers')+'<span><strong>Georgetown · Demo workspace</strong><small>Washington, DC · synthetic building features</small></span>'+icon('arrow-right')+'</button><button class="dialog-option" data-bookmark="conus">'+icon('map')+'<span><strong>Continental United States</strong><small>Explore the US map and added layers</small></span>'+icon('arrow-right')+'</button>';
    } else if(kind==='basemap') {
      title='Background map';
      content='<p>Reference maps give context to the layers you explore.</p>'+Object.keys(basemaps).map(function(k){return '<button class="dialog-option '+(k===activeBasemap?'selected':'')+'" data-basemap="'+k+'">'+icon('map')+'<span><strong>'+basemaps[k].name+'</strong><small>'+basemaps[k].description+'</small></span>'+(k===activeBasemap?'<span class="pill">Active</span>':icon('arrow-right'))+'</button>';}).join('');
    } else if(kind==='lod2') {if(window.PortalModels){PortalModels.open();return;}
      title='3D models';content='<p>The model list is loading. Try again in a moment.</p>';
    } else if(kind==='connections') {
      title='Add data';content='<p>Choose a dataset, open a local file or paste a link to data.</p>';
    } else if(kind==='help') {
      title='Help';
      content='<p>Add data from the catalog, a public URL or a local file.</p><dl class="help-grid"><dt>Layers</dt><dd>Choose a dataset; open its settings for opacity, source details and updates. Change colors or filter the buildings you want to see.</dd><dt>Tools</dt><dd>Open the attribute table, measure, draw an analysis boundary, calculate statistics, make charts or run spatial analysis.</dd><dt>Analysis data</dt><dd>Choose an area and a dataset, then view statistics or analyze it. Results describe that area. Use original data when a map layer only contains display tiles.</dd><dt>3D models</dt><dd>Browse experimental US roofs and training references, or place your own OBJ / GLB using explicit units and a geographic anchor.</dd><dt>CRS</dt><dd>Settings changes coordinate readouts and actual import / export conversions. The map renders in Web Mercator.</dd><dt>Create map</dt><dd>Save a PNG or PDF with title, legend, scale, north arrow and sources. PDF uses a readable paper layout.</dd><dt>Download</dt><dd>Export full loaded vector geometry, the buildings in your chosen area or the original raster. Use Save or open a map to keep local files, drawings and models for another day.</dd></dl>';
    } else {
      title='About USBF';
      content='<p>An open GIS workspace for <strong>building footprints, heights and roof models</strong>.</p><p>USBF reads our current Source Cooperative publication and checks for updates automatically. Inspect published footprints, inherited GBA heights and recorded edit attributes, or compare other datasets. Models contains experimental US roofs and actual 3DBAG training references.</p><p>Created for Yinan Feng.</p><a class="primary-button" href="https://feng96.github.io/research-daily/" target="_blank" rel="noopener">Research updates '+icon('external')+'</a>';
    }
    $('#dialog-title').textContent=title;$('#dialog-eyebrow').textContent=eyebrow;$('#dialog-content').innerHTML=content;
    if(!$('#workspace-dialog').open)$('#workspace-dialog').showModal();
  }
  function layerInfo(name) {
    var info={
      footprints:['Demo footprints','Generated building features for testing selection, filters and styling.','This optional layer has 240 synthetic polygons. Use the USBF catalog entry for published data.'],
      original:['Original footprints','The future layer will use the original geometry recorded alongside the released final geometry.','These dashed outlines are synthetic variations for checking overlay controls. They do not reproduce real GBA geometry.'],
      height:['Building height','The future layer will link released height attributes to footprints and preserve coverage and missing-value meaning.','Values shown here are synthetic, ranging from 6 to 38 m. They are not measured heights.'],
      lod2:['LoD2 sample area','The future layer will identify areas with available roof models and link to reconstruction evidence.','This outline is an illustrative UI boundary. It is not a real coverage inventory.']
    }[name];
    $('#dialog-title').textContent=info[0];$('#dialog-eyebrow').textContent='LAYER INFORMATION';
    $('#dialog-content').innerHTML='<p>'+info[1]+'</p><div class="feature-notice">'+info[2]+'</div><p style="margin-top:17px"><strong>Current provider:</strong> synthetic demonstration<br><strong>Live data connection:</strong> not configured<br><strong>Coordinates:</strong> GeoJSON longitude / latitude, EPSG:4326</p>';
    if(!$('#workspace-dialog').open)$('#workspace-dialog').showModal();
  }
  function fillColor() {
    return $('#layer-height').checked?
      ['step',['get','demo_height_m'],'#c5b68c',17,'#ad90a4',28,'#796486']:
      ['case',['get','demo_modified'],'#c1a15b','#5b9c7b'];
  }
  function visibility(id,visible) { map.setLayoutProperty(id,'visibility',visible?'visible':'none'); }
  function refreshSelection(previous) {
    if(!mapReady)return;
    if(previous)map.setFeatureState({source:'buildings-demo',id:previous},{selected:false});
    if(selected)map.setFeatureState({source:'buildings-demo',id:selected},{selected:true});
  }
  function syncLayers() {
    if(!mapReady)return;
    var visible=$('#layer-footprints').checked || $('#layer-height').checked;
    visibility('demo-fill',visible&&!view3d);visibility('demo-outline',visible&&!view3d);visibility('demo-extrusion',visible&&view3d);
    visibility('demo-original',$('#layer-original').checked);
    visibility('demo-coverage-fill',$('#layer-lod2').checked);visibility('demo-coverage-line',$('#layer-lod2').checked);
    var color=fillColor(),opacity=Number($('#opacity').value)/100;
    map.setPaintProperty('demo-fill','fill-color',color);map.setPaintProperty('demo-fill','fill-opacity',opacity);
    map.setPaintProperty('demo-outline','line-color',['case',['boolean',['feature-state','selected'],false],'#163f37',color]);
    map.setPaintProperty('demo-extrusion','fill-extrusion-color',['case',['boolean',['feature-state','selected'],false],'#214c3d',color]);
    map.setPaintProperty('demo-extrusion','fill-extrusion-opacity',opacity);
    $('#opacity-value').textContent=$('#opacity').value+'%';
    $('.height-ramp').hidden=!$('#layer-height').checked;
    var legend=$('.legend-body');
    legend.innerHTML=$('#layer-height').checked?'<div><i class="legend-swatch" style="background:#c5b68c"></i>6–16 m</div><div><i class="legend-swatch" style="background:#ad90a4"></i>17–27 m</div><div><i class="legend-swatch" style="background:#796486"></i>28–38 m</div><p>Illustrative heights · not measurements</p>':'<div><i class="legend-swatch unchanged"></i>Illustrative unchanged</div><div><i class="legend-swatch modified"></i>Illustrative modified</div><p>Synthetic shapes · not real buildings</p>';
    $$('.layer-row').forEach(function(row){var input=row.querySelector('input[type=checkbox]');row.classList.toggle('is-current',input.checked);});
    $('#legend-card').hidden=!visible;
    if(window.PortalLayers)PortalLayers.refresh();
    saveView();
  }
  function setBasemap(key) {
    if(!mapReady || !basemaps[key])return;
    activeBasemap=key;tileFailures=0;$('#tile-warning').hidden=true;
    Object.keys(basemaps).forEach(function(k){visibility('base-'+k,k===key);});
    $('#basemap-label').textContent=basemaps[key].name;
    saveView();
  }
  function setTool(next) {
    tool=next;
    $$('[data-tool]').forEach(function(b){b.classList.toggle('active',b.dataset.tool===next);b.setAttribute('aria-pressed',String(b.dataset.tool===next));});
    if(map){map.getCanvas().style.cursor=next==='measure'?'crosshair':next==='identify'?'crosshair':'';if(next==='measure')map.doubleClickZoom.disable();else map.doubleClickZoom.enable();}
    $('#measure-card').hidden=next!=='measure';
    $('#tool-hint').textContent=next==='measure'?'Click to add measurement points · Escape to finish':next==='identify'?'Click a feature to inspect its attributes':'Drag to explore · Scroll to zoom · Click a building to inspect';
    status(next==='measure'?'Measure distance · click the map':next==='identify'?'Identify · click a feature':'Map ready');
  }
  function selectFeature(id,pan) {
    var feature=featuresById.get(id);if(!feature)return;
    if(window.PortalLayers)PortalLayers.clearExternalSelection();
    var previous=selected;selected=id;$('#welcome-card').hidden=true;$('#properties').hidden=false;
    var p=feature.properties;
    $('#properties-content').innerHTML='<span class="eyebrow">SYNTHETIC FEATURE</span><h2 class="feature-id">'+escapeHTML(id)+'</h2><span class="pill '+(p.demo_modified?'amber':'')+'">Illustrative '+(p.demo_modified?'modified':'unchanged')+'</span><div class="feature-preview" aria-hidden="true"><svg viewBox="0 0 100 75"><path d="M17 65 13 20 72 9 82 51 61 55 62 63Z"/></svg></div><div class="feature-values"><div><span>DEMO HEIGHT</span><strong>'+p.demo_height_m+' <small>m</small></strong></div><div><span>DEMO AREA</span><strong>'+p.demo_area_m2+' <small>m²</small></strong></div></div><dl class="feature-properties"><div><dt>Building ID</dt><dd>'+escapeHTML(id)+'</dd></div><div><dt>Source</dt><dd>Generated example</dd></div><div><dt>Data status</dt><dd>Synthetic demo</dd></div><div><dt>Version</dt><dd>Prototype 0.1</dd></div><div><dt>Geometry</dt><dd>Polygon</dd></div><div><dt>Coordinates</dt><dd>EPSG:4326</dd></div></dl><p class="feature-notice">This shape and its attributes are generated examples. They do not represent this location’s real building, height or quality.</p><button class="feature-action" data-action="export">'+icon('download')+' Export this demo feature</button>';
    refreshSelection(previous);
    if(window.innerWidth<=700){$('#sidebar').classList.remove('is-open');$('[data-action=layers]').setAttribute('aria-expanded','false');}
    setTimeout(function(){map.resize();if(pan){var bounds=featureBounds(feature);map.easeTo({center:[(bounds[0][0]+bounds[1][0])/2,(bounds[0][1]+bounds[1][1])/2],duration:reducedMotion?0:300});}},30);
    renderTable();status('1 synthetic feature selected');saveView();
  }
  function clearSelection() {var previous=selected;selected=null;$('#properties').hidden=true;refreshSelection(previous);renderTable();if(map)setTimeout(function(){map.resize();},10);status('Selection cleared');saveView();}
  function renderTable() {
    if(window.PortalLayers?.layers.size&&window.PortalInventory){PortalInventory.refresh();return;}
    if(!collection)return;
    $('#attribute-head').innerHTML='<tr><th>Building ID</th><th>Revision</th><th>Demo height (m)</th><th>Demo area (m²)</th><th>Data status</th></tr>';$('#table-layer-name').textContent='Synthetic demo';$('#table-kind').textContent='DEMO';
    var filtered=$('#selected-only').checked?collection.features.filter(function(f){return f.id===selected;}):collection.features;
    $('#table-count').textContent=filtered.length+' records';
    $('#attribute-rows').innerHTML=filtered.length?filtered.map(function(f){var p=f.properties;return '<tr tabindex="0" data-feature="'+f.id+'" class="'+(f.id===selected?'selected':'')+'" aria-selected="'+(f.id===selected)+'"><td>'+f.id+'</td><td>Illustrative '+(p.demo_modified?'modified':'unchanged')+'</td><td>'+p.demo_height_m+'</td><td>'+p.demo_area_m2+'</td><td>Synthetic demo</td></tr>';}).join(''):'<tr><td colspan="5">No selected feature. Click a demo footprint or turn off “Selected only”.</td></tr>';
  }
  function toggleTable() {var el=$('#attribute-table');el.hidden=!el.hidden;$('#table-toggle').setAttribute('aria-expanded',String(!el.hidden));$('#table-toggle').classList.toggle('active',!el.hidden);if(!el.hidden)renderTable();if(map)setTimeout(function(){map.resize();},10);}
  function exportData() {
    if(window.PortalLayers&&PortalLayers.handleExport())return;
    if(!collection){toast('Demonstration data is still loading.');return;}
    var out={type:'FeatureCollection',name:'SYNTHETIC DEMO — not observed USBF data',features:selected?[featuresById.get(selected)]:collection.features};
    var blob=new Blob([JSON.stringify(out,null,2)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=selected?'synthetic-'+selected+'.geojson':'synthetic-demo-buildings.geojson';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);toast('Exported '+out.features.length+' synthetic demo '+(out.features.length===1?'feature.':'features.'));
  }
  function clearMeasure() {measurePoints=[];if(mapReady)map.getSource('measurement').setData({type:'FeatureCollection',features:[]});$('#measure-text').textContent='Click the map to start measuring';}
  function addMeasure(latlng) {
    measurePoints.push([latlng.lng,latlng.lat]);
    var features=measurePoints.map(function(p){return {type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}};});
    if(measurePoints.length>1)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:measurePoints}});
    map.getSource('measurement').setData({type:'FeatureCollection',features:features});
    var distance=0;for(var i=1;i<measurePoints.length;i++)distance+=distanceMeters(measurePoints[i-1],measurePoints[i]);
    $('#measure-text').textContent=measurePoints.length===1?'Start point set · click another point':(distance>=1000?(distance/1000).toFixed(2)+' km':distance.toFixed(1)+' m')+' · '+measurePoints.length+' points';
  }
  function saveView() {
    if(!mapReady || !collection)return;
    var c=map.getCenter(),q=new URLSearchParams();if(window.PortalLayers)PortalLayers.writeShare(q);if(window.PortalModels)PortalModels.writeShare(q);q.set('v',c.lat.toFixed(5)+','+c.lng.toFixed(5)+','+map.getZoom());q.set('base',activeBasemap);
    var layers=['footprints','original','height','lod2'].filter(function(k){return $('#layer-'+k).checked;});q.set('layers',layers.join(','));q.set('opacity',$('#opacity').value);if(selected)q.set('feature',selected);
    q.set('mode',view3d?'3d':'2d');if(view3d){q.set('bearing',map.getBearing().toFixed(1));q.set('pitch',map.getPitch().toFixed(1));}
    try{history.replaceState(null,'','#'+q.toString());}catch(e){/* Standalone file preview may restrict history. */}
  }
  function restoreView() {
    var q=new URLSearchParams(location.hash.slice(1));
    if(q.has('layers')){var ls=q.get('layers').split(',');['footprints','original','height','lod2'].forEach(function(k){$('#layer-'+k).checked=ls.includes(k);});}
    var opacity=Number(q.get('opacity'));if(q.has('opacity')&&Number.isFinite(opacity))$('#opacity').value=Math.min(100,Math.max(10,opacity));
    if(basemaps[q.get('base')])activeBasemap=q.get('base');
    var v=(q.get('v')||'').split(',').map(Number);
    if(v.length===3&&v.every(Number.isFinite)&&Math.abs(v[0])<=85&&Math.abs(v[1])<=180&&v[2]>=2&&v[2]<=20)map.jumpTo({center:[v[1],v[0]],zoom:v[2]});
    if(q.get('mode')==='3d'){setViewMode(true,false);var bearing=Number(q.get('bearing')),pitch=Number(q.get('pitch'));map.jumpTo({bearing:q.has('bearing')&&Number.isFinite(bearing)?Math.max(-180,Math.min(180,bearing)):-20,pitch:q.has('pitch')&&Number.isFinite(pitch)?Math.max(0,Math.min(60,pitch)):55});}
    if(featuresById.has(q.get('feature')))selectFeature(q.get('feature'),false);
  }
  var searchRevision=0;
  function showSearchResults(results,emptyText) {
    $('#search-results').innerHTML=results.length?results.map(function(r){return '<button type="button" role="option" data-search-result="'+escapeHTML(r.action).replace(/"/g,'&quot;')+'">'+escapeHTML(r.label)+'<small>'+escapeHTML(r.note||'')+'</small></button>';}).join(''):'<p>'+escapeHTML(emptyText||'Enter a U.S. city, state or street address, then press Enter.')+'</p>';
    $('#search-results').hidden=false;$('#place-search').setAttribute('aria-expanded','true');return results;
  }
  function search() {
    searchRevision++;var query=$('#place-search').value.trim(),results=[],seen=new Set();
    if(!query){$('#search-results').hidden=true;$('#place-search').setAttribute('aria-expanded','false');return results;}
    var local=window.PortalExplorer?.searchLocal(query)||[],other=window.PortalInventory?.search(query.toLowerCase())||[];
    local.concat(other.filter(function(r){return !local.length||!r.action.startsWith('place-');})).forEach(function(r){var k=r.action+'|'+r.label;if(!seen.has(k)){seen.add(k);results.push(r);}});
    return showSearchResults(results.slice(0,10));
  }
  async function submitSearch() {
    var query=$('#place-search').value.trim(),results=search();if(!query)return;
    var address=/\d/.test(query)&&/[a-z]/i.test(query)&&!/^[-+\d.,\s]+$/.test(query);
    if(results.length&&(!address||/^(model:|coords:)/.test(results[0].action))){$('#search-results [data-search-result]').click();return;}
    if(!window.PortalExplorer){showSearchResults(results,'Choose a city, or enter longitude and latitude.');return;}
    var revision=++searchRevision;showSearchResults([],'Searching for this address…');
    try{var found=await PortalExplorer.searchAddress(query);if(revision!==searchRevision)return;showSearchResults(found,'No matching address. Include the street number, city and state.');if(found.length===1)$('#search-results [data-search-result]').click();}
    catch(e){if(revision===searchRevision)showSearchResults([],e.message||'Address search is unavailable. Try a city or enter coordinates.');}
  }
  function bookmark(place) {
    if(!map)return;
    if(place==='conus'){map.easeTo({center:[-98.5,39.5],zoom:4,pitch:0,bearing:0,duration:reducedMotion?0:500});toast('Continental United States');}
    else{map.fitBounds(homeBounds,{padding:70,maxZoom:16,duration:reducedMotion?0:500});toast('Georgetown · 240 synthetic demo features.');}
    $('#search-results').hidden=true;
  }
  async function action(name) {
    if(name==='close-dialog'){$('#workspace-dialog').close();return;}
    if(name==='layers'){var open;if(innerWidth>700){open=!document.body.classList.toggle('sidebar-collapsed');}else{open=$('#sidebar').classList.toggle('is-open');}$('[data-action=layers]').setAttribute('aria-expanded',String(open));if(map)setTimeout(function(){map.resize();},0);return;}
    if(name==='table'){if(window.PortalLayers?.layers.size&&window.PortalInventory)PortalInventory.toggleTable();else toggleTable();return;}
    if(name==='close-welcome'){$('#welcome-card').hidden=true;return;}
    if(name==='export'){if(window.PortalComposer)PortalComposer.open('download');else exportData();return;}
    if(name==='legend'){var show=!document.body.classList.contains('legend-visible');document.body.classList.toggle('legend-visible',show);$('#legend-card').hidden=!show;$('.legend-body').hidden=false;$('.legend-title').setAttribute('aria-expanded',String(show));return;}
    if(name==='collapse-groups'){var groups=$$('.layer-group'),open=groups.some(function(g){return !g.open;});groups.forEach(function(g){g.open=open;});return;}
    if(!map){toast('The map is not available yet.');return;}
    if(name==='home'&&!(window.PortalLayers&&PortalLayers.fullExtent()))bookmark('conus');
    if(name==='sample'){window.PortalModels?.hide();PortalLayers.layers.forEach(l=>{l.visible=false;});PortalLayers.set3D();$('#layer-footprints').checked=true;syncLayers();$('.demo-group').open=true;selectFeature('DEMO-129',true);}
    if(name==='zoom-in')map.zoomIn();
    if(name==='zoom-out')map.zoomOut();
    if(name==='north'){map.resetNorth({duration:reducedMotion?0:250});toast('Map aligned to north.');}
    if(name==='view-2d')setViewMode(false,true);
    if(name==='view-3d'){setViewMode(true,true);toast('3D view · only supplied heights or available roof models are shown.');}
    if(name==='clear-selection')clearSelection();
    if(name==='clear-measure')clearMeasure();
    if(name==='retry-basemap'){tileFailures=0;$('#tile-warning').hidden=true;map.getSource('base-'+activeBasemap).setTiles([basemaps[activeBasemap].url]);}
    if(name==='share') {
      saveView();
      try{await navigator.clipboard.writeText(location.href);toast('Map link copied. Use a saved map file to include local data and models.');}
      catch(e){$('#dialog-title').textContent='Share this view';$('#dialog-eyebrow').textContent='MAP LINK';$('#dialog-content').innerHTML='<p>Copy this link to reopen the map view and catalog layers. Use Tools → Save or open a map to include local files, drawings and models in a portable map file.</p><input id="share-url" readonly aria-label="Map sharing URL" style="width:100%;padding:10px;border:1px solid #dfe5d5;border-radius:5px">';$('#share-url').value=location.href;$('#workspace-dialog').showModal();$('#share-url').select();}
    }
  }
  document.addEventListener('click',function(e) {
    var el=e.target.closest('[data-action],[data-modal],[data-tool],[data-layer-info],[data-tab],[data-basemap],[data-bookmark],[data-feature],[data-search-result]');
    if(!el)return;
    if(el.dataset.action)action(el.dataset.action);
    if(el.dataset.modal)modal(el.dataset.modal);
    if(el.dataset.tool)setTool(el.dataset.tool);
    if(el.dataset.layerInfo)layerInfo(el.dataset.layerInfo);
    if(el.dataset.tab){var tab=el.dataset.tab;$$('[data-tab]').forEach(function(b){var isSelected=b.dataset.tab===tab;b.classList.toggle('selected',isSelected);b.setAttribute('aria-selected',String(isSelected));b.tabIndex=isSelected?0:-1;});$('#layers-panel').hidden=tab!=='layers';$('#catalog-panel').hidden=tab!=='catalog';$('#models-panel').hidden=tab!=='models';}
    if(el.dataset.basemap){setBasemap(el.dataset.basemap);$('#workspace-dialog').close();}
    if(el.dataset.bookmark){bookmark(el.dataset.bookmark);$('#workspace-dialog').close();}
    if(el.dataset.feature)selectFeature(el.dataset.feature,true);
    if(el.dataset.searchResult){if(window.PortalExplorer?.navigate(el.dataset.searchResult)){$('#search-results').hidden=true;$('#place-search').setAttribute('aria-expanded','false');return;}if(window.PortalInventory?.navigate(el.dataset.searchResult)){$('#search-results').hidden=true;$('#place-search').setAttribute('aria-expanded','false');return;}if(el.dataset.searchResult.startsWith('DEMO-'))selectFeature(el.dataset.searchResult,true);else bookmark(el.dataset.searchResult);$('#search-results').hidden=true;$('#place-search').value='';}
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') {if($('#workspace-dialog').open)$('#workspace-dialog').close();else{setTool('explore');$('#search-results').hidden=true;$('#place-search').setAttribute('aria-expanded','false');$('#sidebar').classList.remove('is-open');$('[data-action=layers]').setAttribute('aria-expanded','false');}}
    if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)&&!$('#workspace-dialog').open){e.preventDefault();$('[data-tab=layers]').click();$('#sidebar').classList.add('is-open');$('[data-action=layers]').setAttribute('aria-expanded','true');$('#layer-filter').focus();}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-feature]')){e.preventDefault();selectFeature(e.target.dataset.feature,true);}
    if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.target.matches('[data-tab]')){e.preventDefault();var tabs=['layers','models'],next=tabs[(tabs.indexOf(e.target.dataset.tab)+1)%2];$('[data-tab='+next+']').click();$('[data-tab='+next+']').focus();}
  });
  $('#workspace-dialog').addEventListener('click',function(e){if(e.target===$('#workspace-dialog')){var r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('#layer-filter').addEventListener('input',function(){var q=this.value.toLowerCase(),visible=0;$$('.layer-row').forEach(function(row){row.hidden=!row.textContent.toLowerCase().includes(q);if(!row.hidden){visible++;if(row.closest('details'))row.closest('details').open=true;}});$('.layer-empty').hidden=visible>0;});
  ['footprints','original','height','lod2'].forEach(function(k){$('#layer-'+k).addEventListener('change',syncLayers);});
  $('#opacity').addEventListener('input',syncLayers);$('#selected-only').addEventListener('change',renderTable);
  $('#place-search').addEventListener('input',search);
  $('#search-form').addEventListener('submit',function(e){e.preventDefault();submitSearch();});
  $('#place-search').addEventListener('keydown',function(e){if(e.key==='ArrowDown'&&!$('#search-results').hidden){var first=$('#search-results [data-search-result]');if(first){e.preventDefault();first.focus();}}});
  $('#search-results').addEventListener('keydown',function(e){var rows=Array.from(this.querySelectorAll('[data-search-result]')),i=rows.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(e.key)&&rows.length){e.preventDefault();rows[(i+(e.key==='ArrowDown'?1:rows.length-1)+rows.length)%rows.length].focus();}if(e.key==='Escape'){$('#place-search').focus();this.hidden=true;$('#place-search').setAttribute('aria-expanded','false');}});
  document.addEventListener('click',function(e){if(!e.target.closest('.place-search')){$('#search-results').hidden=true;$('#place-search').setAttribute('aria-expanded','false');}});

  function featureBounds(f) {
    var ring=f.geometry.coordinates[0];
    return [[Math.min.apply(null,ring.map(function(p){return p[0];})),Math.min.apply(null,ring.map(function(p){return p[1];}))],[Math.max.apply(null,ring.map(function(p){return p[0];})),Math.max.apply(null,ring.map(function(p){return p[1];}))]];
  }
  function distanceMeters(a,b) {
    var rad=Math.PI/180,lat=(b[1]-a[1])*rad,lng=(b[0]-a[0])*rad;
    var h=Math.sin(lat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(lng/2)**2;
    return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  }
  function setViewMode(three,animate) {
    view3d=three;
    $('#mode-2d').classList.toggle('active',!three);$('#mode-3d').classList.toggle('active',three);
    $('#mode-2d').setAttribute('aria-pressed',String(!three));$('#mode-3d').setAttribute('aria-pressed',String(three));
    if(three){map.dragRotate.enable();map.touchZoomRotate.enableRotation();}
    else{map.dragRotate.disable();map.touchZoomRotate.disableRotation();}
    if(mapReady)syncLayers();if(window.PortalLayers)PortalLayers.set3D();
    if(animate)map.easeTo({pitch:three?55:0,bearing:three?-20:0,duration:reducedMotion?0:500});
    $('#tool-hint').textContent=three?'3D camera · Right-drag to rotate · Supplied heights and roof models only':'Drag to explore · Scroll to zoom · Click a building to inspect';
    saveView();
  }
  function addDataLayers() {
    map.addSource('buildings-demo',{type:'geojson',data:collection});
    map.addLayer({id:'demo-fill',type:'fill',source:'buildings-demo',paint:{'fill-color':fillColor(),'fill-opacity':.72}});
    map.addLayer({id:'demo-outline',type:'line',source:'buildings-demo',paint:{'line-color':'#5b9c7b','line-width':['case',['boolean',['feature-state','selected'],false],2.5,1]}});
    map.addLayer({id:'demo-extrusion',type:'fill-extrusion',source:'buildings-demo',layout:{visibility:'none'},paint:{'fill-extrusion-color':fillColor(),'fill-extrusion-height':['get','demo_height_m'],'fill-extrusion-base':0,'fill-extrusion-opacity':.9}});
    var originalCollection={type:'FeatureCollection',features:collection.features.map(function(f){return {type:'Feature',properties:f.properties,geometry:{type:'Polygon',coordinates:[f.geometry.coordinates[0].map(function(p){return [p[0]-(f.properties.demo_modified?0.000035:0),p[1]-(f.properties.demo_modified?0.00002:0)];})]}};})};
    map.addSource('original-demo',{type:'geojson',data:originalCollection});
    map.addLayer({id:'demo-original',type:'line',source:'original-demo',layout:{visibility:'none'},paint:{'line-color':'#a68b4a','line-width':1.3,'line-dasharray':[4,3]}});
    map.addSource('coverage-demo',{type:'geojson',data:{type:'Feature',properties:{synthetic:true},geometry:{type:'Polygon',coordinates:[[[-77.067,38.909],[-77.0619,38.909],[-77.0619,38.9124],[-77.067,38.9124],[-77.067,38.909]]]}}});
    map.addLayer({id:'demo-coverage-fill',type:'fill',source:'coverage-demo',layout:{visibility:'none'},paint:{'fill-color':'#b4a0cb','fill-opacity':.1}});
    map.addLayer({id:'demo-coverage-line',type:'line',source:'coverage-demo',layout:{visibility:'none'},paint:{'line-color':'#9681ae','line-width':1.5,'line-dasharray':[7,5]}});
    map.addSource('measurement',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'measure-line',type:'line',source:'measurement',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#315f50','line-width':2,'line-dasharray':[5,4]}});
    map.addLayer({id:'measure-points',type:'circle',source:'measurement',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':4,'circle-color':'#fff','circle-stroke-color':'#315f50','circle-stroke-width':2}});
  }
  async function init() {
    if(!window.maplibregl){$('#map-failure').hidden=false;status('Map unavailable · library loading failed');return;}
    var initialHash=location.hash;
    var sources={},baseLayers=[{id:'background',type:'background',paint:{'background-color':'#e9ede4'}}];
    Object.keys(basemaps).forEach(function(k){var b=basemaps[k];sources['base-'+k]={type:'raster',tiles:[b.url],tileSize:256,maxzoom:b.maxZoom,attribution:b.attribution};baseLayers.push({id:'base-'+k,type:'raster',source:'base-'+k,layout:{visibility:k==='light'?'visible':'none'},paint:{'raster-fade-duration':0}});});
    maplibregl.setWorkerCount(2);
    map=new maplibregl.Map({container:'map',style:{version:8,sources:sources,layers:baseLayers},center:[-98.5,39.5],zoom:4,minZoom:2,maxZoom:20,maxPitch:60,attributionControl:false,renderWorldCopies:false,canvasContextAttributes:{antialias:true,preserveDrawingBuffer:true}});
    var styleReady=new Promise(function(resolve){map.once('style.load',resolve);});
    map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    map.addControl(new maplibregl.ScaleControl({maxWidth:80,unit:'metric'}),'bottom-left');
    map.dragRotate.disable();map.touchZoomRotate.disableRotation();
    map.on('error',function(e){if(e.sourceId&&e.sourceId==='base-'+activeBasemap){tileFailures++;if(tileFailures>=3)$('#tile-warning').hidden=false;}else console.warn('Map resource:',e.error&&e.error.message);});
    map.on('sourcedata',function(e){if(e.sourceId==='base-'+activeBasemap&&e.isSourceLoaded)$('#tile-warning').hidden=true;});
    collection=await PortalData.load();
    collection.features.forEach(function(f){featuresById.set(f.id,f);});
    var bounds=collection.features.map(featureBounds);homeBounds=[[Math.min.apply(null,bounds.map(function(b){return b[0][0];})),Math.min.apply(null,bounds.map(function(b){return b[0][1];}))],[Math.max.apply(null,bounds.map(function(b){return b[1][0];})),Math.max.apply(null,bounds.map(function(b){return b[1][1];}))]];
    await styleReady;
    addDataLayers();mapReady=true;
    if(initialHash)history.replaceState(null,'',initialHash);
    restoreView();setBasemap(activeBasemap);syncLayers();
    hoverPopup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12,className:'feature-tooltip'});
    map.on('moveend',function(){saveView();$('#zoom-label').textContent='Zoom '+map.getZoom().toFixed(1);});
    map.on('rotate',function(){$('.north-arrow i').style.transform='rotate('+(-map.getBearing())+'deg)';});
    map.on('mousemove',function(e){var lat=e.lngLat.lat,lng=e.lngLat.lng;$('#coordinates').textContent=Math.abs(lat).toFixed(5)+'° '+(lat>=0?'N':'S')+', '+Math.abs(lng).toFixed(5)+'° '+(lng>=0?'E':'W');
      if(tool==='measure')return;
      var hits=map.queryRenderedFeatures(e.point,{layers:[view3d?'demo-extrusion':'demo-fill']});
      if(hits.length){map.getCanvas().style.cursor='pointer';hoverPopup.setLngLat(e.lngLat).setText(hits[0].properties.building_id+' · Synthetic demo').addTo(map);}
      else{map.getCanvas().style.cursor=tool==='identify'?'crosshair':'';hoverPopup.remove();}
    });
    map.on('mouseout',function(){hoverPopup.remove();});
    map.on('click',function(e){if(window.PortalDraw?.active){PortalDraw.click(e);return;}if(tool==='measure'){hoverPopup.remove();addMeasure(e.lngLat);return;}var hits=map.queryRenderedFeatures(e.point,{layers:[view3d?'demo-extrusion':'demo-fill']});if(window.PortalModels?.identify(e))return;if(window.PortalLayers&&PortalLayers.identify(e))return;if(hits.length)selectFeature(hits[0].properties.building_id,false);});
    $('#feature-count').textContent=collection.features.length;renderTable();saveView();
    $('#zoom-label').textContent='Zoom '+map.getZoom().toFixed(1);
    window.portal={engine:'MapLibre GL JS',get map(){return map;},get data(){return collection;},get selected(){return selected;},get view3d(){return view3d;},selectFeature:selectFeature};
    window.portal.setTool=setTool;window.portal.getTool=function(){return tool;};window.portal.toast=toast;window.portal.clearSelection=clearSelection;window.portal.saveView=saveView;window.portal.setViewMode=setViewMode;window.portal.setBasemap=setBasemap;window.portal.getBasemap=function(){return activeBasemap;};window.portal.initialHash=initialHash;
    if(window.PortalLayers)await PortalLayers.init(window.portal,initialHash);
    window.PortalInventory?.init(window.portal);window.portal.ready=true;document.dispatchEvent(new CustomEvent('portal-ready'));
    if(!initialHash&&!new URLSearchParams(location.search).has('empty')){PortalLayers.add(PortalLayers.catalog[0],{restore:true});}
    new ResizeObserver(function(){map.resize();}).observe($('#map-column'));
  }
  init().catch(function(e){$('#map-failure').hidden=false;status('Workspace could not initialize');console.error(e);});
})();
