/* U.S. place navigation and plain-language building information. */
(function(root){
  'use strict';
  const $=s=>document.querySelector(s),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CENSUS='https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
  const CENSUS_INFO='https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html';
  const normal=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const conus=point=>Array.isArray(point)&&point[0]>=-125&&point[0]<=-66&&point[1]>=24&&point[1]<=50;
  const pointValid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85;
  const boxValid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<b[2]&&b[1]<b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-85&&b[3]<=85&&b[2]-b[0]<180;
  const formats=new Intl.NumberFormat('en-US',{maximumFractionDigits:1}),integer=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
  const aliases={usbf_id:'Building ID',building_id:'Building ID',height_m:'Building height · m',height:'Source height · m',source:'Building footprint source',bf_source:'Building footprint source',geom_source:'Building footprint source',modified:'Footprint change',modification_type:'Type of footprint change',shape_changed:'Outline changed',hollow_cut:'Courtyard opening added',added_area_m2:'Area added · m²',removed_area_m2:'Area removed · m²',area_m2:'Footprint area · m²',area_in_meters:'Footprint area · m²',state:'State',country_iso:'Country',update_date:'Record date',footprint_license:'Footprint license',height_license:'Height license',height_source:'Height source',height_missing:'Elevation data unavailable',height_incomplete:'Partial elevation coverage',height_valid_fraction:'Elevation coverage fraction',height_coverage_status:'Elevation coverage',gba_var:'Source height uncertainty value',var:'Source height uncertainty value',is_gba_only:'GlobalBuildingAtlas-only record',possible_small_FP:'Potential small false positive',source_generation:'Source release',release_status:'Publication status',processing_status:'Footprint processing result',cx:'Source point longitude',cy:'Source point latitude',inference_input_mode:'Available imagery and elevation',geometry_fallback:'Source geometry retained',gba_region:'GlobalBuildingAtlas region',region:'Source region',CAPTUREYEAR:'Capture year',height_roof:'Source roof height · ft',doitt_id:'Building ID',OBJECTID:'Source object ID',bin:'Building identification number'};
  function fieldLabel(key){const name=String(key||'');return aliases[name]||name.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
  const seeds=[['dc','Washington','DC',-77.071,38.912,['Washington DC','D.C.','Georgetown']],['nyc','New York','NY',-73.985,40.748,['New York City','NYC','Manhattan']],['la','Los Angeles','CA',-118.244,34.052,['LA','L.A.']],['chicago','Chicago','IL',-87.63,41.88,[]],['knoxville','Knoxville','TN',-83.9207,35.9606,[]],['denver','Denver','CO',-104.99,39.74,[]],['boston','Boston','MA',-71.06,42.36,[]],['seattle','Seattle','WA',-122.335,47.608,[]],['sf','San Francisco','CA',-122.419,37.775,['SF']],['austin','Austin','TX',-97.743,30.267,[]],['miami','Miami','FL',-80.192,25.762,[]]];
  const fallback=seeds.map(p=>({id:'featured-'+p[0],kind:'city',name:p[1],label:p[1]+', '+p[2],stateCode:p[2],state:'',coords:p.slice(3,5),aliases:p[5],covered:true,population:0}));
  let places=fallback.slice(),byID=new Map(places.map(p=>[p.id,p])),placesPromise=null,placesReady=false,map,started=false,picker,refreshTimer,lastSummarySignature='',addressSequence=0,lastAddressRequest=0,pendingAddress=null,selection=null;
  let gazetteer=null,gazetteerPromise=null,pickerState='',pickerVersion=0,pickerLimit=40;
  const stateLists=new Map(),stateRequests=new Map(),stateFailures=new Map();
  const addressCache=new Map(),addressResults=new Map();
  function normalizePlace(p){
    if(!p||!/^[a-z0-9-]{1,80}$/.test(String(p.id))||!['city','state','coverage'].includes(p.kind)||!pointValid(p.coords)||typeof p.name!=='string'||typeof p.label!=='string'||p.bounds&&!boxValid(p.bounds))throw Error('Place index could not be read.');
    return {...p,name:p.name.trim().slice(0,120),label:p.label.trim().slice(0,180),state:String(p.state||''),stateCode:String(p.stateCode||''),aliases:Array.isArray(p.aliases)?p.aliases.filter(a=>typeof a==='string').map(a=>a.slice(0,120)):[],coords:p.coords.slice(),bounds:p.bounds?.slice(),population:Number.isFinite(p.population)?p.population:0};
  }
  function configurePlaces(data){
    if(data?.schemaVersion!==1||!Array.isArray(data.places)||data.places.length>3000)throw Error('Place index could not be read.');
    const seen=new Set(),next=data.places.map(p=>{const row=normalizePlace(p);if(seen.has(row.id))throw Error('Place index has duplicate entries.');seen.add(row.id);return row;});
    places=next;byID=new Map(next.map(p=>[p.id,p]));
    for(const seed of fallback){const match=next.find(p=>p.kind==='city'&&normal(p.name)===normal(seed.name)&&p.stateCode===seed.stateCode);if(match){match.aliases=Array.from(new Set([...match.aliases,...seed.aliases]));match.viewCenter=seed.coords;byID.set(seed.id,match);}else{places.push(seed);byID.set(seed.id,seed);}}
    for(const rows of stateLists.values())for(const p of rows)byID.set(p.id,p);
    placesReady=true;return places;
  }
  function loadPlaces(){if(placesReady)return Promise.resolve(places);if(!placesPromise)placesPromise=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const r=await fetch(new URL('./data/places/us-places.json',document.baseURI),{credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('Place list is unavailable. You can still search an address or use the map.');return configurePlaces(await r.json());}finally{clearTimeout(timer);}})().catch(error=>{placesPromise=null;throw error;});return placesPromise;}
  function searchLocal(query){
    const q=normal(query);if(!q||q.length>160)return [];
    const tokens=q.split(' '),ranked=[];
    for(const p of places){const names=[p.name,p.label,...p.aliases].map(normal).filter(Boolean),text=normal([p.name,p.label,p.state,p.stateCode,...p.aliases].join(' '));let score=0;for(const value of names){if(value===q)score=Math.max(score,p.kind==='state'&&value===normal(p.stateCode)?1100:1200);else if(value.startsWith(q))score=Math.max(score,240);else if(value.includes(q))score=Math.max(score,90);}if(normal(p.stateCode)===q)score=Math.max(score,p.kind==='state'?1100:900);if(!score&&tokens.every(t=>text.includes(t)))score=30;if(score){if(p.kind==='city')score+=Math.min(12,Math.log10(Math.max(1,p.population)));ranked.push({p,score});}}
    return ranked.sort((a,b)=>b.score-a.score||a.p.label.localeCompare(b.p.label)).slice(0,8).map(({p})=>({label:p.label,note:p.kind==='state'?'U.S. state':p.kind==='coverage'?'Current USBF coverage':'City'+(p.covered===false?' · outside current USBF coverage':''),action:'explore-place:'+p.id}));
  }
  async function readPlaceFile(path){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{const response=await fetch(new URL('./data/places/census-2026/'+path,document.baseURI),{credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Place list is unavailable. Try again or use a quick place.');return await response.json();}finally{clearTimeout(timer);}
  }
  function loadPlaceManifest(){
    if(gazetteer)return Promise.resolve(gazetteer);
    if(!gazetteerPromise)gazetteerPromise=readPlaceFile('manifest.json').then(data=>{
      if(data?.schemaVersion!==1||data.year!==2026||!Array.isArray(data.states)||data.states.length!==52)throw Error('The place list could not be read. Use a quick place or try again.');
      const codes=new Set();for(const s of data.states){if(!/^[A-Z]{2}$/.test(s.code)||!/^\d{2}$/.test(s.fips)||codes.has(s.code)||typeof s.name!=='string'||!s.name.trim()||!Number.isInteger(s.count)||s.count<1||s.count>5000)throw Error('The place list could not be read. Use a quick place or try again.');codes.add(s.code);}
      gazetteer=data;return data;
    }).catch(error=>{gazetteerPromise=null;throw error;});return gazetteerPromise;
  }
  const shortPlaceName=name=>name.replace(/ (?:city|town|village|borough|municipality|CDP|comunidad|zona urbana)$/i,'');
  function loadStatePlaces(code){
    code=String(code||'').toUpperCase();if(!/^[A-Z]{2}$/.test(code))return Promise.reject(Error('Choose a state or territory from the list.'));
    if(stateLists.has(code))return Promise.resolve(stateLists.get(code));if(stateRequests.has(code))return stateRequests.get(code);
    const request=(async()=>{
      const manifest=await loadPlaceManifest(),state=manifest.states.find(s=>s.code===code);if(!state)throw Error('Choose a state or territory from the list.');
      const data=await readPlaceFile(code.toLowerCase()+'.json');
      if(data?.schemaVersion!==1||data.state!==code||!Array.isArray(data.places)||data.places.length!==state.count)throw Error('This place list could not be read. Try again or use a quick place.');
      const seen=new Set(),names=new Map(),rows=data.places.map(row=>{
        if(!Array.isArray(row)||row.length!==4||typeof row[0]!=='string'||!/^\d{7}$/.test(row[0])||!row[0].startsWith(state.fips)||seen.has(row[0])||typeof row[1]!=='string'||!row[1].trim()||row[1].length>180||!pointValid(row.slice(2)))throw Error('This place list could not be read. Try again or use a quick place.');
        seen.add(row[0]);const name=row[1],short=shortPlaceName(name),key=normal(short);names.set(key,(names.get(key)||0)+1);
        return {id:'census-'+row[0],kind:'place',name,shortName:short,label:short+', '+code,state:state.name,stateCode:code,coords:row.slice(2),aliases:[short],covered:!['AK','HI','PR'].includes(code),coordinateRole:'census-internal-point'};
      });
      for(const p of rows){p.sameName=names.get(normal(p.shortName))>1;byID.set(p.id,p);}stateLists.set(code,rows);stateFailures.delete(code);return rows;
    })().catch(error=>{stateFailures.set(code,error.message);throw error;}).finally(()=>stateRequests.delete(code));stateRequests.set(code,request);return request;
  }
  function placeNote(p){
    let note=/ CDP$/i.test(p.name)?'Census-designated place':'Place';
    if(p.sameName)note+=' · '+Math.abs(p.coords[1]).toFixed(2)+'°'+(p.coords[1]<0?'S':'N')+', '+Math.abs(p.coords[0]).toFixed(2)+'°'+(p.coords[0]<0?'W':'E');
    return note+(p.covered===false?' · outside current USBF coverage':'');
  }
  function searchState(code,query='',maximum=40){
    const rows=stateLists.get(String(code||'').toUpperCase())||[],q=normal(query),tokens=q.split(' ').filter(Boolean),ranked=[];
    for(const p of rows){const names=[p.name,p.shortName,p.label].map(normal),text=normal([p.name,p.shortName,p.state,p.stateCode].join(' '));let score=q?0:1;for(const value of names){if(value===q)score=Math.max(score,100);else if(q&&value.startsWith(q))score=Math.max(score,30);}if(q&&!score&&tokens.every(t=>text.includes(t)))score=10;if(score)ranked.push({p,score});}
    return ranked.sort((a,b)=>b.score-a.score||a.p.label.localeCompare(b.p.label)||a.p.id.localeCompare(b.p.id)).slice(0,Math.max(1,Math.min(5000,Number.isFinite(maximum)?Math.floor(maximum):40))).map(({p})=>({label:p.label,note:placeNote(p),action:'explore-place:'+p.id,officialName:p.name,coordinateRole:p.coordinateRole}));
  }
  function parseAddress(payload,query){
    if(!payload?.result||!Array.isArray(payload.result.addressMatches))throw Error('The address service returned an unreadable response. Try again.');
    const out=[];
    for(const match of payload.result.addressMatches.slice(0,5)){const coords=[match.coordinates?.x,match.coordinates?.y];if(!pointValid(coords))continue;const label=String(match.matchedAddress||query).trim().slice(0,220),id='address-'+(++addressSequence),record={id,label,coords,covered:conus(coords),source:'U.S. Census Bureau',sourceURL:CENSUS_INFO,quality:'Approximate position along a street address range; not an identified building',matchedAddress:label};addressResults.set(id,record);out.push({label,note:'Approximate address location · U.S. Census Bureau',action:'explore-address:'+id});}
    while(addressResults.size>200)addressResults.delete(addressResults.keys().next().value);return out;
  }
  function jsonpAddress(query){
    return new Promise((resolve,reject)=>{const callback='__usbfAddress'+Date.now().toString(36)+(++addressSequence),script=document.createElement('script');let ended=false,timer;
      function clean(late=false){clearTimeout(timer);script.remove();if(late){root[callback]=()=>{};setTimeout(()=>{try{delete root[callback];}catch(e){}},120000);}else delete root[callback];}
      root[callback]=value=>{if(ended)return;ended=true;clean();resolve(value);};
      script.onerror=()=>{if(ended)return;ended=true;clean(true);reject(Error('Address search is unavailable. Choose a city or try again shortly.'));};
      const url=new URL(CENSUS);url.search=new URLSearchParams({address:query,benchmark:'Public_AR_Current',format:'jsonp',callback});script.src=url.href;script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';
      timer=setTimeout(()=>{if(ended)return;ended=true;clean(true);reject(Error('Address search took too long. Choose a city or try again.'));},20000);
      try{document.head.appendChild(script);}catch(error){ended=true;clean();reject(Error('Address search could not start. Choose a city instead.'));}
    });
  }
  async function searchAddress(query){
    const text=String(query||'').trim().replace(/\s+/g,' ');if(text.length<3||text.length>180)throw Error('Enter a city name or a street address with city and state.');
    await loadPlaces().catch(()=>{});const local=searchLocal(text);if(local.length&&!/^\d+\s/.test(text))return local;
    if(!/^\d+\s+\S/.test(text))throw Error('Try a city name or a full street address, for example 1600 Pennsylvania Ave NW, Washington DC.');
    const key=normal(text);if(addressCache.has(key))return addressCache.get(key).map(r=>({...r}));if(pendingAddress){if(pendingAddress.key===key)return pendingAddress.promise;throw Error('Please wait for the current address search to finish.');}
    if(Date.now()-lastAddressRequest<1500)throw Error('Please wait a moment before searching again.');lastAddressRequest=Date.now();
    const promise=(async()=>{const results=parseAddress(await jsonpAddress(text),text);addressCache.set(key,results);while(addressCache.size>30)addressCache.delete(addressCache.keys().next().value);return results.map(r=>({...r}));})();pendingAddress={key,promise};try{return await promise;}finally{pendingAddress=null;}
  }
  function notify(message){root.portal?.toast?.(message);}
  async function ensureUSBF(){
    if(!root.PortalLayers)return;let l=Array.from(PortalLayers.layers.values()).find(l=>l.cfg.id==='usbf-live');if(!l){const entry=PortalLayers.catalog.find(c=>c.id==='usbf-live');if(entry)l=await PortalLayers.add(entry,{restore:true});}if(l){if(!l.visible){l.visible=true;PortalLayers.setStyle(l.id,{visible:true});l.reload?.();}PortalLayers.selectLayer(l.id);}
  }
  function go(place){
    if(!map){notify('The map is still loading. Please choose this place again shortly.');return true;}root.PortalModels?.hide();root.portal.setViewMode(false,false);const coords=place.viewCenter||place.coords;
    if(place.bounds)map.fitBounds([[place.bounds[0],place.bounds[1]],[place.bounds[2],place.bounds[3]]],{padding:55,maxZoom:place.kind==='state'?10:5,duration:0,pitch:0,bearing:0});else map.jumpTo({center:coords,zoom:16.5,pitch:0,bearing:0});
    const label=$('#map-place-name');if(label)label.textContent=place.label;selection=place.source?{role:'address-location',approximate:true,label:place.label,coordinates:place.coords.slice(),source:place.source,sourceURL:place.sourceURL,quality:place.quality}:null;
    map.getSource('explorer-address-location')?.setData({type:'FeatureCollection',features:selection?[{type:'Feature',properties:{role:'address-location',label:selection.label,approximate:true},geometry:{type:'Point',coordinates:selection.coordinates}}]:[]});
    if(place.covered!==false)ensureUSBF().catch(()=>notify('The building layer could not be opened. Use Add data to try again.'));else notify('USBF currently covers the contiguous states and Washington, DC.');
    $('#search-results').hidden=true;picker?.close();if(innerWidth<=700){$('#sidebar')?.classList.remove('is-open');const b=$('[data-action=layers]');if(b)b.setAttribute('aria-expanded','false');}schedule();return true;
  }
  function navigate(action){const value=String(action||'');if(value.startsWith('explore-place:')){const p=byID.get(value.slice(14));if(p)return go(p);notify('Choose the place again.');return true;}if(value.startsWith('explore-address:')){const p=addressResults.get(value.slice(16));if(p)return go(p);notify('Search this address again to reopen its location.');return true;}return false;}
  function populateStatePicker(){
    if(!picker)return;const rows=gazetteer?.states||places.filter(p=>p.kind==='state').map(p=>({code:p.stateCode,name:p.name}));
    const choices=rows.slice();if(!choices.some(s=>s.code==='PR'))choices.push({code:'PR',name:'Puerto Rico'});
    $('#explorer-place-state').innerHTML='<option value="">Quick places</option>'+choices.sort((a,b)=>a.name.localeCompare(b.name)).map(s=>'<option value="'+esc(s.code)+'"'+(s.code===pickerState?' selected':'')+'>'+esc(s.name)+'</option>').join('');
  }
  function pickerResults(query=''){
    if(!picker)return;const list=$('#explorer-place-list'),status=$('#explorer-place-status'),q=normal(query),state=gazetteer?.states.find(s=>s.code===pickerState),stateName=state?.name||places.find(p=>p.kind==='state'&&p.stateCode===pickerState)?.name||(pickerState==='PR'?'Puerto Rico':pickerState);
    $('#explorer-place-query-label').textContent=pickerState?'Place name':'City or state';$('#explorer-place-query').placeholder=pickerState?'Search cities, towns and other places…':'New York, California, DC…';
    const coverage=$('#explorer-place-coverage');coverage.hidden=!['AK','HI','PR'].includes(pickerState);coverage.textContent='USBF does not currently cover '+stateName+'. You can explore the map and add another dataset.';
    $('#explorer-place-help').textContent=pickerState?'Census places open at a reference point, not an individual building. For a street address, use the map search.':'Choose a state to find smaller places. For a street address, use the map search.';
    if(pickerState&&!stateLists.has(pickerState)){
      const failed=stateFailures.get(pickerState);status.textContent=failed?'The place list is unavailable. Try again or choose Quick places.':'Loading places in '+stateName+'…';
      list.innerHTML=failed?'<button type="button" class="explorer-place-retry" data-explorer-place-retry>Try again</button>':'';return;
    }
    const all=pickerState?searchState(pickerState,query,5000):q?searchLocal(query):['featured-dc','featured-nyc','featured-la','featured-chicago','featured-knoxville','featured-sf'].map(id=>byID.get(id)).filter(Boolean).map(p=>({label:p.label,note:'City',action:'explore-place:'+p.id})),items=all.slice(0,pickerLimit);
    status.textContent=pickerState?(q?integer.format(all.length)+' matching '+(all.length===1?'place':'places'):integer.format(all.length)+' places')+' in '+stateName+'.':'';
    list.innerHTML=items.map(r=>'<button type="button" data-explorer-place="'+esc(r.action)+'"'+(r.officialName?' title="'+esc(r.officialName)+'"':'')+'><strong>'+esc(r.label)+'</strong><span>'+esc(r.note)+'</span></button>').join('')||(pickerState?'<p>No matching place. Try part of the name, or choose another state.</p>':'<p>No matching quick place. Choose a state for smaller places.</p>');
    if(all.length>items.length)list.insertAdjacentHTML('beforeend','<button type="button" class="explorer-place-more" data-explorer-place-more>Show more places</button>');
  }
  async function choosePickerState(code){
    pickerState=String(code||'');pickerLimit=40;const version=++pickerVersion;if(pickerState)stateFailures.delete(pickerState);pickerResults($('#explorer-place-query').value);
    if(!pickerState)return;try{await loadStatePlaces(pickerState);}catch(error){}if(version===pickerVersion&&picker)pickerResults($('#explorer-place-query').value);
  }
  function openPlacePicker(){
    if(!map){notify('The map is loading. Please try again shortly.');return;}
    if(!picker){
      picker=document.createElement('dialog');picker.id='explorer-place-dialog';picker.className='explorer-place-dialog';picker.setAttribute('aria-labelledby','explorer-place-title');
      picker.innerHTML='<header><h2 id="explorer-place-title">Choose a place</h2><button type="button" data-close-place-picker aria-label="Close">×</button></header><div class="explorer-place-content"><div class="explorer-place-fields"><label>State or territory<select id="explorer-place-state"><option value="">Quick places</option></select></label><label><span id="explorer-place-query-label">City or state</span><input id="explorer-place-query" type="search" placeholder="New York, California, DC…" autocomplete="off"></label></div><p id="explorer-place-coverage" class="explorer-place-coverage" hidden></p><p id="explorer-place-status" class="explorer-place-status" role="status" aria-live="polite"></p><div id="explorer-place-list"></div><p id="explorer-place-help" class="explorer-place-note"></p><details class="explorer-place-source"><summary>About this place list</summary><p>Quick places use Natural Earth. State lists use the U.S. Census Bureau’s 2026 Gazetteer, including cities, towns and census-designated places. Search stays in this website; typing does not send queries to a geocoder. Reference points help you find a place and do not show its boundary.</p><a href="https://www.census.gov/geographies/reference-files/2026/geo/gazetter-file.html" target="_blank" rel="noopener">Census Gazetteer 2026 ↗</a></details></div>';
      document.body.append(picker);picker.querySelector('[data-close-place-picker]').onclick=()=>picker.close();$('#explorer-place-state').onchange=e=>choosePickerState(e.target.value);$('#explorer-place-query').oninput=e=>{pickerLimit=40;pickerResults(e.target.value);};
      picker.addEventListener('click',e=>{const button=e.target.closest('[data-explorer-place]');if(button)navigate(button.dataset.explorerPlace);if(e.target.closest('[data-explorer-place-more]')){pickerLimit+=40;pickerResults($('#explorer-place-query').value);}if(e.target.closest('[data-explorer-place-retry]'))choosePickerState(pickerState);});
    }
    $('#explorer-place-query').value='';pickerLimit=40;populateStatePicker();pickerResults();if(!picker.open)picker.showModal();$('#explorer-place-query').focus();
    Promise.allSettled([loadPlaces(),loadPlaceManifest()]).then(()=>{populateStatePicker();pickerResults($('#explorer-place-query').value);});if(pickerState)choosePickerState(pickerState);
  }
  function sourceName(value){const text=String(value??'').trim(),names={osm:'OpenStreetMap',openstreetmap:'OpenStreetMap',microsoft:'Microsoft',ms:'Microsoft',msft:'Microsoft',google:'Google Open Buildings',gba:'GlobalBuildingAtlas'};return names[text.toLowerCase()]||text||'Not recorded';}
  function numeric(value){return typeof value==='number'&&Number.isFinite(value)?value:null;}
  function heightOf(layer,feature){const p=feature?.properties||{},field=layer?.heightField||'height_m',value=numeric(p[field]);if(value!==null&&value>0)return value;if(layer?.cfg?.driver==='usbf'){const inherited=numeric(p.height);if(inherited!==null&&inherited>0)return inherited;}return null;}
  function isBuilding(layer,feature){
    if(root.PortalAnalysisData?.isBuildingLayer?.(layer))return true;
    const provenance=layer?.data?.provenance||layer?.cfg?.provenance,role=provenance?.featureRole;
    if(['features','feature','derived'].includes(role)||provenance?.role==='user-drawing'||layer?.cfg?.sourceKind==='drawing'||layer?.data?.analysis?.operation||provenance?.operation)return false;
    const id=feature?.properties?.usbf_id,identified=typeof id==='string'&&id.trim()!==''||typeof id==='number'&&Number.isFinite(id);
    return ['usbf','gba','nyc'].includes(layer?.cfg?.driver)||['dc-government','training-heights'].includes(layer?.cfg?.id)||['building','buildings'].includes(role)||layer?.cfg?.dataRole==='buildings'||identified&&['Polygon','MultiPolygon'].includes(feature?.geometry?.type);
  }
  function changeLabel(value){return value===true?'Changed from source':value===false?'Unchanged from source':'Not recorded';}
  function stableID(value){return typeof value==='string'&&value.trim()!==''||typeof value==='number'&&Number.isFinite(value);}
  const onDemand=layer=>layer?.cfg?.analysisMode==='on-demand'&&typeof layer.ensureData==='function';
  const tileDisplay=layer=>!!layer?.renderTiled||['pmtiles','vector'].includes(layer?.cfg?.type);
  function originalFeature(layer,feature){
    if(!layer||!feature||!['geojson','viewport'].includes(layer.cfg?.type)||!Array.isArray(layer.data?.features))return null;
    if(root.PortalAnalysisData&&root.PortalAnalysisData.capabilities(layer).geometryAnalysis!==true)return null;
    const provenance=layer.data.provenance||layer.cfg.provenance;if(provenance&&(provenance.spatialEligible===false||/tile|fragment/.test(provenance.geometryQuality||'')||/tile/.test(provenance.scope||''))||/tile[ -]fragments|clipped-or-simplified-tile/i.test(layer.data.scope||''))return null;
    if(tileDisplay(layer)&&!onDemand(layer))return null;
    const p=feature.properties||{},direct=stableID(p.usbf_id)?layer.featureById?.get(String(p.usbf_id)):null;if(direct&&layer.data.features.includes(direct))return direct;
    if(layer.data.features.includes(feature))return feature;
    const same=source=>{const q=source.properties||{};for(const key of ['usbf_id','model_id','doitt_id','OBJECTID','objectid','building_id'])if(stableID(p[key])&&stableID(q[key]))return String(p[key])===String(q[key]);if(stableID(p.source)&&stableID(p.id)&&stableID(q.source)&&stableID(q.id))return p.source===q.source&&String(p.id)===String(q.id);return stableID(feature.id)&&stableID(source.id)&&String(feature.id)===String(source.id);};
    const matches=layer.data.features.filter(same);return matches.length===1?matches[0]:null;
  }
  function footprintArea(layer,feature){const original=originalFeature(layer,feature);if(!original||!['Polygon','MultiPolygon'].includes(original.geometry?.type)||!root.turf)return null;try{const value=root.turf.area(original);return Number.isFinite(value)&&value>0?value:null;}catch(error){return null;}}
  function prettyDate(value){const text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,80)||'Not recorded';const date=new Date(text.slice(0,10)+'T12:00:00Z');return Number.isFinite(date.getTime())?date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Not recorded';}
  function renderFeature(layer,feature){
    if(!isBuilding(layer,feature))return null;const original=originalFeature(layer,feature);feature=original||feature;const preview=tileDisplay(layer)&&!original,props=feature?.properties||{},height=heightOf(layer,feature),area=footprintArea(layer,feature),id=props.usbf_id??props.doitt_id??props.OBJECTID??props.id??feature.id??'',provider=sourceName(props.source??props.bf_source??props.geom_source??layer.cfg.provider),sourceFields=Object.entries(props),safePage=typeof layer.cfg.page==='string'&&/^https:\/\//.test(layer.cfg.page)?layer.cfg.page:null,canDownload=!!original||onDemand(layer);
    const heightText=height===null?'Not available':formats.format(height)+' <small>m</small>',feet=height===null?'':integer.format(height/.3048)+' ft',basis=layer.cfg.driver==='nyc'?'Reported roof height, converted to metres.':layer.cfg.driver==='usbf'||layer.cfg.driver==='gba'?'Height estimate from GlobalBuildingAtlas.':'Height supplied by this dataset.';
    return '<section class="explorer-building"><span class="explorer-feature-type">'+(preview?'Building · tile preview':'Building')+'</span><h2>'+esc(props.name||'Building details')+'</h2>'+(preview?'<p class="explorer-building-note">Display preview · the outline may be clipped or simplified. Load the original building for its complete geometry and attributes.</p>':'')+'<div class="explorer-building-facts"><div><span>Height</span><strong>'+heightText+'</strong>'+(feet?'<small>'+esc(feet)+'</small>':'')+'</div><div><span>Footprint source</span><strong>'+esc(provider)+'</strong></div></div><dl class="explorer-building-summary">'+(area===null?'':'<div><dt>Footprint area</dt><dd>'+formats.format(area)+' m² <small>('+integer.format(area/.09290304)+' ft²)</small></dd></div>')+(props.state?'<div><dt>State</dt><dd>'+esc(props.state)+'</dd></div>':'')+('<div><dt>Footprint change</dt><dd>'+esc(changeLabel(props.modified))+'</dd></div>')+(props.update_date?'<div><dt>Record date</dt><dd>'+esc(prettyDate(props.update_date))+'</dd></div>':'')+'</dl><p class="explorer-building-note">'+esc(height===null?'This record has no available building height.':basis)+'</p><div class="explorer-building-actions"><button type="button" data-feature-zoom>Zoom to building</button>'+(height!==null?'<button type="button" data-explorer-3d>View in 3D</button>':'')+(preview&&onDemand(layer)?'<button type="button" data-explorer-load-building>Load original building</button>':'')+(canDownload?'<button type="button" data-explorer-download-building>Download building</button>':'')+(props.model_id?'<button type="button" data-model-id="'+esc(props.model_id)+'">Open roof model</button>':'')+'</div><details class="explorer-source-attributes"><summary>'+(preview?'Tile preview attributes':'All building attributes')+'</summary><p class="explorer-building-note">Height and elevation-data coverage are separate. Footprint change compares the published outline with its original source; it is not a quality rating.</p><dl>'+sourceFields.map(([key,value])=>'<div><dt>'+esc(fieldLabel(key))+'<small>'+esc(key)+'</small></dt><dd>'+esc(value===null||value===undefined?'Not recorded':typeof value==='boolean'?value?'Yes':'No':typeof value==='object'?JSON.stringify(value):value)+'</dd></div>').join('')+'</dl>'+(id!==''?'<p class="explorer-record-id">Building ID: '+esc(id)+'</p>':'')+'</details>'+(safePage?'<a class="source-detail-link" href="'+esc(safePage)+'" target="_blank" rel="noopener">Data source and license ↗</a>':'')+'</section>';
  }
  function summaryFor(layer,zoom){
    if(!layer||layer.cfg?.id!=='usbf-live'||!layer.visible)return {visible:false};
    if(onDemand(layer)){
      const coverage=layer.displayMode==='coverage',loading=!!layer.analysisState?.loading,error=layer.analysisState?.error;
      const notice=layer.displayStale?' The map and original data have different release dates. Each result records the original-data release.':'';
      return {visible:true,state:layer.error?'error':'browse',title:layer.error?'Building map is unavailable':coverage?'Building publication coverage':'Buildings on the map',canAnalyze:true,loadArea:coverage,loading,note:(layer.error?'The building display could not load. Try this area again or choose another place.':loading?'Loading original data for your request…':error?'Original data could not load. Try analyzing or downloading this area again.':coverage?'Choose a neighborhood and load its original buildings, or use the analysis and download tools.':'Original data loads when you analyze or download.')+notice};
    }
    if(layer.viewLoading)return {visible:true,state:'loading',title:'Loading buildings…',note:'The map will update when building data is ready.'};
    if(layer.error)return {visible:true,state:'error',title:'Building data is unavailable',note:'Try this area again or choose a nearby place.'};
    if(zoom<14)return {visible:true,state:'overview',title:'Choose a neighborhood',note:'Zoom in or choose a city to see individual buildings.'};
    if(!layer.loaded)return {visible:true,state:'empty',title:'No buildings loaded here',note:'Choose a nearby place or zoom in.'};
    const features=layer.data?.features||[],heights=features.map(f=>heightOf(layer,f)).filter(v=>v!==null),mean=heights.reduce((m,v,i)=>m+(v-m)/(i+1),0);return {visible:true,state:'ready',title:integer.format(features.length)+' buildings loaded nearby',count:features.length,heightCount:heights.length,meanHeight:heights.length?mean:null,limited:!!layer.viewLimited,note:layer.viewLimited?'This area is only partly loaded. Zoom in for a smaller area.':'Numbers cover only the buildings loaded around this map view.'};
  }
  function refresh(){
    if(!map)return;const zoom=map.getZoom(),quick=$('#explorer-quick-places');if(quick)quick.hidden=zoom>=14||!!root.PortalDraw?.active;const l=root.PortalLayers?.active,info=summaryFor(l,zoom),el=$('#explorer-neighborhood');if(!el)return;el.hidden=!info.visible;if(!info.visible)return;const signature=JSON.stringify([l.id,info,l.release?.updated]);if(signature===lastSummarySignature)return;lastSummarySignature=signature;const wasOpen=el.querySelector('details')?.open||false;el.innerHTML='<details '+(wasOpen?'open':'')+'><summary>'+esc(info.title)+'</summary><div class="explorer-neighborhood-body"><p>'+esc(info.note)+'</p>'+(info.state==='ready'?'<dl><div><dt>With a height</dt><dd>'+integer.format(info.heightCount)+'</dd></div><div><dt>Average available height</dt><dd>'+(info.meanHeight===null?'Not available':formats.format(info.meanHeight)+' m')+'</dd></div></dl>':'')+(info.canAnalyze||info.state==='ready'?'<div class="explorer-neighborhood-actions">'+(info.loadArea?'<button type="button" data-explorer-load-area'+(info.loading?' disabled':'')+'>Load original buildings for this area</button>':'')+'<button type="button" data-workspace-tool="statistics">Summarize area</button><button type="button" data-workspace-tool="download">Download buildings</button></div>':info.state==='error'?'<button type="button" data-explorer-retry>Try again</button>':'<button type="button" data-explorer-choose>Choose a place</button>')+'</div></details>';
  }
  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,180);}
  async function loadOriginalSelected(){
    const chosen=root.PortalLayers?.selection;if(!chosen){notify('Select a building first.');return;}const layer=PortalLayers.layers.get(chosen.layer);if(!layer)return;
    try{notify('Loading the original building…');const snapshot=await PortalAnalysisData.capture(layer,{scope:'selection',selection:chosen});if(snapshot.features.length!==1)throw Error('This building was not found in the original data. Select it again.');if(PortalLayers.selection===chosen&&PortalLayers.layers.get(layer.id)===layer)PortalLayers.inspect(layer,snapshot.features[0]);}catch(error){if(error.name!=='AbortError')notify(error.message||'The original building could not load. Try selecting it again.');}
  }
  async function loadOriginalArea(){
    const layer=root.PortalLayers?.active;if(!onDemand(layer)||!map)return;const b=map.getBounds(),bounds=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
    try{await layer.ensureData({scope:'view',bounds});}catch(error){if(error.name!=='AbortError')notify(error.message||'Original buildings could not load. Try a smaller area.');}finally{schedule();}
  }
  async function downloadSelected(){
    const chosen=root.PortalLayers?.selection;if(!chosen){notify('Select a building first.');return;}const layer=PortalLayers.layers.get(chosen.layer);if(!layer)return;
    try{const snapshot=await PortalAnalysisData.capture(layer,{scope:'selection',selection:chosen}),file=PortalComposer.prepareExport(snapshot,{format:'geojson',crs:'EPSG:4326',name:'building-'+String(chosen.feature.properties?.usbf_id??chosen.feature.id??'selected')}),url=URL.createObjectURL(new Blob([file.body],{type:file.mime})),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){notify(error.message||'The building could not be downloaded. Try selecting it again.');}
  }
  function init(){
    if(started||!root.portal?.ready)return;started=true;map=root.portal.map;
    map.addSource('explorer-address-location',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'explorer-address-point',type:'circle',source:'explorer-address-location',paint:{'circle-radius':7,'circle-color':'#ffffff','circle-opacity':.95,'circle-stroke-color':'#b96b32','circle-stroke-width':3}});
    let popup;if(root.maplibregl?.Popup){map.on('mouseenter','explorer-address-point',()=>{if(!selection)return;popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12}).setLngLat(selection.coordinates).setText('Approximate address location · U.S. Census Bureau').addTo(map);});map.on('mouseleave','explorer-address-point',()=>{popup?.remove();popup=null;});}
    const form=$('#search-form');if(form&&!$('#explorer-search-button')){const button=document.createElement('button');button.type='submit';button.id='explorer-search-button';button.textContent='Search';button.setAttribute('aria-label','Search for a U.S. city or address');form.append(button);const kbd=form.querySelector('kbd');if(kbd)kbd.hidden=true;}
    const quick=document.createElement('div');quick.id='explorer-quick-places';quick.className='explorer-quick-places';quick.innerHTML='<button type="button" data-explorer-place="explore-place:featured-dc">Washington, DC</button><button type="button" data-explorer-place="explore-place:featured-nyc">New York</button><button type="button" data-explorer-choose>Choose a place</button>';$('.map-top')?.append(quick);
    const summary=document.createElement('section');summary.id='explorer-neighborhood';summary.className='explorer-neighborhood';summary.hidden=true;summary.setAttribute('aria-label','Buildings near this view');const added=$('#added-layers');if(added)added.insertAdjacentElement('afterend',summary);
    map.on('moveend',schedule);map.on('idle',schedule);['portal-layers-changed','portal-style-changed'].forEach(e=>document.addEventListener(e,schedule));loadPlaces().catch(()=>{});refresh();
  }
  document.addEventListener('portal-ready',init);document.addEventListener('click',e=>{const button=e.target.closest('[data-explorer-place],[data-explorer-choose],[data-explorer-3d],[data-explorer-load-building],[data-explorer-load-area],[data-explorer-download-building],[data-explorer-retry]');if(!button)return;if(button.dataset.explorerPlace)navigate(button.dataset.explorerPlace);if(button.hasAttribute('data-explorer-choose'))openPlacePicker();if(button.hasAttribute('data-explorer-3d'))root.portal?.setViewMode(true,true);if(button.hasAttribute('data-explorer-load-building'))loadOriginalSelected();if(button.hasAttribute('data-explorer-load-area'))loadOriginalArea();if(button.hasAttribute('data-explorer-download-building'))downloadSelected();if(button.hasAttribute('data-explorer-retry'))root.PortalLayers?.active?.checkUpdates?.();});
  root.PortalExplorer={init,loadPlaces,configurePlaces,searchLocal,searchAddress,loadPlaceManifest,loadStatePlaces,searchState,navigate,renderFeature,fieldLabel,summaryFor,heightOf,changeLabel,parseAddress,originalFeature,footprintArea,openPlacePicker,clearLocation:()=>{selection=null;map?.getSource('explorer-address-location')?.setData({type:'FeatureCollection',features:[]});},metadata:()=>{if(!selection)return null;let visible=true;const b=map?.getBounds();if(b)visible=selection.coordinates[0]>=b.getWest()&&selection.coordinates[0]<=b.getEast()&&selection.coordinates[1]>=b.getSouth()&&selection.coordinates[1]<=b.getNorth();return {...JSON.parse(JSON.stringify(selection)),visible};},get ready(){return placesReady;},get places(){return places.slice();}};init();
})(globalThis);
