/* Coordinate conversion for import, readouts and exports. Rendering stays in Web Mercator. */
(function () {
  'use strict';
  const WGS84='EPSG:4326', STORAGE='us-buildings-crs-v1';
  let selected=WGS84, lastPoint=null, attached=false;
  const $=s=>document.querySelector(s);
  const normalize=code=>{const s=String(code||WGS84).trim();return /^\d+$/.test(s)?'EPSG:'+s:/^epsg:\d+$/i.test(s)?s.toUpperCase():/^(WGS84|CRS:84)$/i.test(s)?WGS84:s;};
  function library(){if(typeof globalThis.proj4!=='function')throw Error('The coordinate conversion library has not loaded.');return globalThis.proj4;}
  function definition(code=WGS84){
    const p=library(),key=normalize(code),utm=/^EPSG:(326|327)(\d\d)$/.exec(key);
    if(utm){const zone=Number(utm[2]);if(zone<1||zone>60)throw Error('UTM zone must be between 1 and 60.');if(!p.defs(key))p.defs(key,'+proj=utm +zone='+zone+(utm[1]==='327'?' +south':'')+' +datum=WGS84 +units=m +no_defs');}
    if(key.startsWith('+')){if(!/(?:^|\s)\+proj=/.test(key))throw Error('Enter a complete PROJ definition beginning with +proj=.');if(key.length>4000)throw Error('The custom CRS definition is too long.');try{new p.Proj(key);}catch(e){throw Error('Invalid custom CRS: '+(e.message||e));}return key;}
    if(!p.defs(key))throw Error('Unknown CRS '+key+'. Use EPSG:4326, EPSG:3857, a WGS84 UTM code, or a custom PROJ definition.');
    return key;
  }
  function point(value){if(!Array.isArray(value)||value.length<2||!Number.isFinite(value[0])||!Number.isFinite(value[1]))throw Error('Coordinates must be finite numbers in x, y order.');return value;}
  function convert(coords,from=WGS84,to=WGS84){
    point(coords);const source=definition(from),target=definition(to);
    if(source===WGS84&&(Math.abs(coords[0])>180||Math.abs(coords[1])>90))throw Error('EPSG:4326 expects longitude and latitude, in that order. Check the source CRS.');
    if(target==='EPSG:3857'&&source===WGS84&&Math.abs(coords[1])>85.05112878)throw Error('This latitude is outside the Web Mercator display range.');
    let result;try{result=source===target?coords.slice(0,2):library()(source,target,coords.slice(0,2));}catch(e){throw Error('Coordinate conversion failed: '+(e.message||e));}
    point(result);if(target===WGS84&&(Math.abs(result[0])>180.0000001||Math.abs(result[1])>90.0000001))throw Error('The source CRS produced invalid longitude / latitude.');
    return [result[0],result[1],...coords.slice(2)];
  }
  function transformGeoJSON(input,from=WGS84,to=WGS84){
    definition(from);definition(to);const data=JSON.parse(JSON.stringify(input));let positions=0;
    function coordinates(c){if(!Array.isArray(c))throw Error('Invalid geometry coordinates.');if(typeof c[0]==='number'){if(++positions>1000000)throw Error('Coordinate conversion is limited to one million positions.');return convert(c,from,to);}return c.map(coordinates);}
    function visit(obj){if(!obj||typeof obj!=='object')throw Error('Choose a GeoJSON object.');delete obj.bbox;
      if(obj.type==='FeatureCollection'){if(!Array.isArray(obj.features))throw Error('Invalid feature collection.');obj.features.forEach(visit);}
      else if(obj.type==='Feature'){if(obj.geometry!==null)visit(obj.geometry);}
      else if(obj.type==='GeometryCollection'){if(!Array.isArray(obj.geometries))throw Error('Invalid geometry collection.');obj.geometries.forEach(visit);}
      else if(['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon'].includes(obj.type))obj.coordinates=coordinates(obj.coordinates);
      else throw Error('Unsupported GeoJSON type: '+obj.type);
    }
    visit(data);delete data.crs;return data;
  }
  function label(code=selected){const key=normalize(code);if(key.startsWith('+'))return 'Custom CRS';const utm=/^EPSG:(326|327)(\d\d)$/.exec(key);return utm?'WGS84 / UTM '+Number(utm[2])+(utm[1]==='327'?'S':'N')+' · '+key:key===WGS84?'WGS84 · EPSG:4326':key==='EPSG:3857'?'Web Mercator · EPSG:3857':key;}
  function format(lngLat,code=selected){const c=convert(lngLat,WGS84,code);return normalize(code)===WGS84?c[0].toFixed(5)+'°, '+c[1].toFixed(5)+'°':c[0].toFixed(2)+', '+c[1].toFixed(2);}
  function update(){const readout=$('#coordinates'),crsLabel=$('#workspace-crs-label');if(crsLabel){crsLabel.textContent=selected.startsWith('+')?'Custom CRS':selected;crsLabel.title=label()+' · coordinate readout / export CRS; map renders in EPSG:3857';}if(readout&&lastPoint){try{readout.textContent=format(lastPoint);readout.title=label()+' · x / y';}catch(e){readout.textContent='Outside selected CRS';readout.title=e.message;}}}
  function set(code){selected=definition(code);try{localStorage.setItem(STORAGE,selected);}catch(e){}update();document.dispatchEvent(new CustomEvent('portal-crs-changed',{detail:{code:selected}}));return selected;}
  function init(){if(attached||!globalThis.portal?.map)return;attached=true;try{const saved=localStorage.getItem(STORAGE);if(saved)selected=definition(saved);}catch(e){selected=WGS84;}const map=portal.map;lastPoint=[map.getCenter().lng,map.getCenter().lat];map.on('mousemove',e=>{lastPoint=[e.lngLat.lng,e.lngLat.lat];update();});map.on('moveend',()=>{const p=map.getCenter();lastPoint=[p.lng,p.lat];update();});update();}
  function settings(){
    let dialog=$('#workspace-settings-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='workspace-settings-dialog';dialog.className='workspace-dialog composer-dialog';dialog.setAttribute('aria-labelledby','workspace-settings-title');dialog.innerHTML='<header class="composer-heading"><div><span class="composer-kicker">WORKSPACE</span><h2 id="workspace-settings-title">Settings</h2></div><button type="button" data-close-settings aria-label="Close settings">×</button></header><form id="workspace-crs-form" class="composer-form"><label>Coordinate readout &amp; export CRS<select id="workspace-crs-preset"><option value="EPSG:4326">WGS84 · longitude / latitude</option><option value="EPSG:3857">Web Mercator · metres</option><option value="utm">WGS84 / UTM</option><option value="custom">Custom PROJ definition</option></select></label><div id="workspace-utm-fields" class="composer-row" hidden><label>Zone<input id="workspace-utm-zone" type="number" min="1" max="60" value="17" required></label><label>Hemisphere<select id="workspace-utm-hemisphere"><option value="north">North</option><option value="south">South</option></select></label></div><label id="workspace-custom-field" hidden>PROJ definition<textarea id="workspace-custom-proj" rows="3" spellcheck="false" placeholder="+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs"></textarea></label><p class="composer-note">The map renders in EPSG:3857. This setting converts coordinate readouts and data exports. Each imported file keeps its own declared source CRS. Area and distance analysis use geodesic calculations.</p><p class="composer-note">Coordinates use x / y order: longitude / latitude for WGS84; easting / northing for projected data. Custom transformations requiring grid files need those grids and are not supplied by this browser workspace.</p><div id="workspace-crs-example" class="composer-scope"></div><p id="workspace-settings-message" role="status" aria-live="polite"></p><div class="composer-actions"><button type="submit" class="composer-primary">Apply CRS</button><button type="button" data-reset-crs>Reset to WGS84</button></div></form>';document.body.append(dialog);
      dialog.querySelector('[data-close-settings]').onclick=()=>dialog.close();const preset=$('#workspace-crs-preset');preset.onchange=()=>{$('#workspace-utm-fields').hidden=preset.value!=='utm';$('#workspace-custom-field').hidden=preset.value!=='custom';$('#workspace-utm-zone').disabled=preset.value!=='utm';};
      $('#workspace-crs-form').onsubmit=e=>{e.preventDefault();try{let code=preset.value;if(code==='utm'){const zone=Number($('#workspace-utm-zone').value);if(!Number.isInteger(zone)||zone<1||zone>60)throw Error('Choose a UTM zone between 1 and 60.');code='EPSG:'+($('#workspace-utm-hemisphere').value==='south'?'327':'326')+String(zone).padStart(2,'0');}else if(code==='custom')code=$('#workspace-custom-proj').value.trim();set(code);$('#workspace-settings-message').textContent='Coordinate readouts and default exports now use '+label()+'.';$('#workspace-settings-message').className='';example();}catch(err){$('#workspace-settings-message').textContent=err.message;$('#workspace-settings-message').className='composer-error';}};
      dialog.querySelector('[data-reset-crs]').onclick=()=>{set(WGS84);preset.value=WGS84;preset.onchange();example();$('#workspace-settings-message').textContent='Using WGS84 longitude / latitude.';};
    }
    const utm=/^EPSG:(326|327)(\d\d)$/.exec(selected),preset=$('#workspace-crs-preset');preset.value=utm?'utm':selected.startsWith('+')?'custom':selected;if(utm){$('#workspace-utm-zone').value=Number(utm[2]);$('#workspace-utm-hemisphere').value=utm[1]==='327'?'south':'north';}if(selected.startsWith('+'))$('#workspace-custom-proj').value=selected;preset.onchange();$('#workspace-settings-message').textContent='';example();if(!dialog.open)dialog.showModal();
  }
  function example(){const p=lastPoint||[-77.071,38.912];try{$('#workspace-crs-example').textContent='Map position: '+format(p)+' · '+label();}catch(e){$('#workspace-crs-example').textContent=e.message;}}
  globalThis.PortalCRS={definition,normalize,convert,toWGS84:(coords,source=WGS84)=>convert(coords,source,WGS84),fromWGS84:(coords,target=selected)=>convert(coords,WGS84,target),transformGeoJSON,set,get:()=>selected,label,format,init};
  globalThis.PortalSettings={open:settings};
  document.addEventListener('portal-ready',init);if(globalThis.portal?.ready)init();
})();
