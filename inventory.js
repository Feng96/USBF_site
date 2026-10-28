(function(){
'use strict';const $=s=>document.querySelector(s);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const places=[['United States',-98.5,39.5,4],['Washington, DC',-77.071,38.912,16],['New York',-73.985,40.748,15],['Los Angeles',-118.244,34.052,15],['Chicago',-87.63,41.88,15],['Knoxville',-83.9207,35.9606,15],['Denver',-104.99,39.74,15],['Boston',-71.06,42.36,15],['Seattle',-122.335,47.608,15],['San Francisco',-122.419,37.775,15],['Austin',-97.743,30.267,15],['Miami',-80.192,25.762,15]];
let api,map,rows=[],filtered=[],page=0,timer,lastLayer=null,shownColumns=[],columnSignature='';const size=50,tableLimit=20000,states=new WeakMap(),areaCache=new WeakMap(),tableLimits=new WeakMap();
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())&&Number.isFinite(Number(v))?Number(v):null;
const tiled=l=>['pmtiles','vector'].includes(l.cfg.type);
const format=v=>v===null?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:1});
function key(f){const p=f.properties||{};return p.usbf_id?String(p.usbf_id):p.geohash?[p.country_iso,p.geohash,p.bf_source,p.area_in_meters].join('|'):p.doitt_id?String(p.doitt_id):p.OBJECTID?String(p.OBJECTID):p.id&&p.source?[p.source,p.id].join('|'):f.id!==undefined?JSON.stringify([f.id,f.geometry]):JSON.stringify([p,f.geometry]);}
function matches(a,b,l){return tiled(l)?key(a)===key(b):a===b;}
function source(f){return f.properties?.bf_source??f.properties?.source??f.properties?.geom_source??f.properties?.SOURCE??'Not provided';}
function height(f,l){const h=l?.heightField?number(f.properties?.[l.heightField]):null;return h!==null&&h>0?h:null;}
function area(f){return number(f.properties?.area_in_meters??f.properties?.area_m2);}
function building(l){
 const p=l?.data?.provenance||l?.cfg?.provenance;
 if(!l||p?.operation||l.data?.analysis?.operation||p?.role==='user-drawing'||['features','feature','derived'].includes(p?.featureRole))return false;
 if(window.PortalAnalysisData?.isBuildingLayer(l))return true;
 return tiled(l)&&(l.cfg.dataRole==='buildings'||/^vida-/.test(l.cfg.id||'')||['microsoft-usa','overture-buildings'].includes(l.cfg.id));
}
function textValue(value){return value===null||value===undefined?'—':value===''?'""':typeof value==='object'?JSON.stringify(value):String(value);}
function ownValue(feature,key){const p=feature.properties;return p&&Object.prototype.hasOwnProperty.call(p,key)?p[key]:undefined;}
function fieldsFor(l,features){return Array.from(new Set([...(l.fields||[]),...features.flatMap(f=>Object.keys(f.properties||{}))])).filter(k=>typeof k==='string');}
function columnsFor(l,features){
 const known=building(l),base=known?[{id:'@id',label:'Building / record ID',kind:'id'},{id:'@source',label:'Footprint source',kind:'source'},{id:'@area',label:'Area · m²',kind:'area'},{id:'@height',label:'Height · m',kind:'height'},{id:'@country',label:'Country',kind:'country'}]:[{id:'@row',label:'Record',kind:'row'}];
 const properties=fieldsFor(l,features).map(key=>({id:'field:'+key,key,label:known&&window.PortalExplorer?.fieldLabel?PortalExplorer.fieldLabel(key):key,kind:'field'})),featureID=(l.data?.features||features).some(f=>f.id!==undefined)?[{id:'@feature-id',label:'Original feature ID',kind:'feature-id'}]:[];
 return base.concat(properties,featureID);
}
function defaultColumns(definitions,l){return definitions.slice(0,building(l)?5:7).map(c=>c.id);}
function tableState(l,definitions){
 let state=states.get(l);const known=building(l);
 if(!state||state.building!==known){state={building:known,columns:defaultColumns(definitions,l),sort:known?'@source':'@row',descending:false};states.set(l,state);}
 state.columns=state.columns.filter(id=>definitions.some(c=>c.id===id));if(!state.columns.length)state.columns=defaultColumns(definitions,l);
 if(!definitions.some(c=>c.id===state.sort)){state.sort=definitions[0].id;state.descending=false;}
 return state;
}
function valueFor(f,column,l,index){
 const p=f.properties||{};
 if(column.kind==='field')return ownValue(f,column.key);
 if(column.kind==='row')return index+1;
 if(column.kind==='feature-id')return f.id;
 if(column.kind==='id'){for(const key of ['usbf_id','building_id','id','doitt_id','OBJECTID','bin','geohash','model_id']){const value=ownValue(f,key);if(value!==null&&value!==undefined)return value;}return f.id??('Record '+(index+1));}
 if(column.kind==='source')return p.bf_source??p.source??p.geom_source??p.SOURCE;
 if(column.kind==='height')return height(f,l);
 if(column.kind==='country')return p.country_iso;
 if(column.kind==='area'){
  const supplied=area(f);if(supplied!==null)return supplied;
  if(!areaCache.has(f))areaCache.set(f,!tiled(l)&&window.PortalExplorer?.footprintArea?PortalExplorer.footprintArea(l,f):null);
  return areaCache.get(f);
 }
}
function numeric(value){
 if(typeof value==='number')return Number.isFinite(value)?{n:value,i:Number.isSafeInteger(value)?BigInt(value):null}:null;
 if(typeof value!=='string'||!/^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*$/i.test(value))return null;
 const n=Number(value);return Number.isFinite(n)?{n,i:/^[+-]?\d+$/.test(value.trim())?BigInt(value.trim()):null}:null;
}
function compareValues(a,b,descending=false){
 const missing=v=>v===null||v===undefined||typeof v==='number'&&!Number.isFinite(v),am=missing(a),bm=missing(b);if(am||bm)return am===bm?0:am?1:-1;
 const x=numeric(a),y=numeric(b);let order;
 if(x&&y)order=x.i!==null&&y.i!==null?(x.i>y.i?1:x.i<y.i?-1:0):x.n>y.n?1:x.n<y.n?-1:0;
 else if(typeof a==='boolean'&&typeof b==='boolean')order=a===b?0:a?1:-1;
 else order=textValue(a).localeCompare(textValue(b),'en',{numeric:true,sensitivity:'base'});
 return descending?-order:order;
}
function sortRecords(features,column,l,descending=false,positions=new Map(features.map((f,i)=>[f,i]))){return features.map((feature,index)=>({feature,index})).sort((a,b)=>compareValues(valueFor(a.feature,column,l,positions.get(a.feature)??a.index),valueFor(b.feature,column,l,positions.get(b.feature)??b.index),descending)||a.index-b.index).map(r=>r.feature);}
function metadataFor(l){
 const p=l.data?.provenance||l.cfg.provenance||{},bounds=map?.getBounds(),isTile=tiled(l)||window.PortalAnalysisData?.capabilities(l).attributePreview;
 const tableLimited=!!tableLimits.get(l),sourceLimited=!!(l.viewLimited||p.limited),scope=isTile?'Visible tile fragments; clipped or simplified, not unique buildings':l.cfg.type==='viewport'?'Visible original records from the loaded neighborhood':'Original records visible in the current map view';
 return {dataset:l.cfg.name,scope:scope+(tableLimited?'; first '+tableLimit.toLocaleString('en-US')+' visible records only; search and sorting apply to this subset':''),viewBounds:bounds?[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()]:null,loadedBounds:l.viewBounds||null,sourceUrl:l.cfg.sourceUrl||l.cfg.url||l.cfg.page||null,release:l.release||p.release||null,dataTime:l.viewLoadedAt||p.capturedAt||null,downloadedAt:new Date().toISOString(),licenses:Array.from(new Set([l.cfg.license,...(p.licenses||[])].filter(Boolean))),filters:{source:l.sourceFilter||'',fixedSource:l.cfg.fixedSource||'',minArea:l.minArea||0},limited:sourceLimited||tableLimited,sourceLimited,tableLimited,tableRecordLimit:tableLimit,inputScope:p.scopeLabel||p.scope||null,studyArea:p.studyArea?.name||null};
}
function tableCSV(l,features,metadata=metadataFor(l)){
 const fields=fieldsFor(l,features),entries=[['__map_dataset',metadata.dataset],['__map_scope',metadata.scope],['__map_view_bounds',metadata.viewBounds],['__map_loaded_bounds',metadata.loadedBounds],['__map_source_url',metadata.sourceUrl],['__map_release',metadata.release],['__map_data_time',metadata.dataTime],['__map_downloaded_at',metadata.downloadedAt],['__map_licenses',metadata.licenses],['__map_filters',metadata.filters],['__map_partial',metadata.limited],['__map_table_partial',metadata.tableLimited],['__map_table_record_limit',metadata.tableRecordLimit],['__map_input_scope',metadata.inputScope],['__map_study_area',metadata.studyArea]],used=new Set(fields),extra=entries.map(([key,value])=>{while(used.has(key))key+='_';used.add(key);return [key,value];});
 let featureID=null;if(features.some(f=>f.id!==undefined)){featureID='__feature_id';while(used.has(featureID))featureID+='_';used.add(featureID);}
 const cell=x=>{let s=x===null||x===undefined?'':typeof x==='object'?JSON.stringify(x):String(x);if(typeof x==='string'&&/^\s*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const header=fields.concat(featureID?[featureID]:[],extra.map(([key])=>key)),body=[header.map(cell).join(','),...features.map(f=>fields.map(k=>ownValue(f,k)).concat(featureID?[f.id]:[],extra.map(([,value])=>value)).map(cell).join(','))].join('\r\n');
 return {name:(tiled(l)?'visible-tile-fragments':'visible-records')+'.csv',mime:'text/csv;charset=utf-8',body,fields:header,metadata};
}
function boundedRecords(l,found,resolve){const seen=new Set(),out=[];let limited=false;for(const displayed of found){const f=resolve(displayed);if(!f)continue;const k=tiled(l)?key(f):f;if(seen.has(k))continue;seen.add(k);if(out.length===tableLimit){limited=true;break;}out.push(f);}tableLimits.set(l,limited);return {features:out,limited};}
function records(l){if(!map||!l||!l.visible||PortalLayers.isRaster(l)){if(l)tableLimits.set(l,false);return [];}const layer=l.id+(api.view3d&&l.heightField?'-fill-extrusion':'-fill');const ids=[layer,l.id+'-circle',l.id+'-line'].filter(x=>map.getLayer(x));return boundedRecords(l,map.queryRenderedFeatures({layers:ids}),f=>PortalLayers.sourceFeature(l,f)).features;}
function createTableControls(){
 if($('#table-columns'))return;
 const direction=document.createElement('button');direction.id='table-sort-direction';direction.type='button';direction.className='inventory-sort-direction';$('#table-sort').parentElement.insertAdjacentElement('afterend',direction);$('#table-sort').setAttribute('aria-label','Sort table by field');
 const details=document.createElement('details');details.id='table-columns';details.className='inventory-columns';details.innerHTML='<summary>Columns <span id="table-columns-count"></span></summary><div class="inventory-column-panel"><input type="search" id="table-column-search" placeholder="Find a field…" aria-label="Find a table field"><div id="table-column-options"></div><button type="button" id="table-columns-reset">Reset columns</button></div>';direction.insertAdjacentElement('afterend',details);
 $('#table-column-search').oninput=()=>{const q=$('#table-column-search').value.trim().toLowerCase();for(const label of document.querySelectorAll('#table-column-options label'))label.hidden=!label.textContent.toLowerCase().includes(q);};
 $('#table-columns-reset').onclick=()=>{const l=PortalLayers.active;if(!l)return;const definitions=columnsFor(l,rows),state=tableState(l,definitions);state.columns=defaultColumns(definitions,l);render();};
 $('#table-sort-direction').onclick=()=>{const l=PortalLayers.active;if(!l)return;const state=tableState(l,columnsFor(l,rows));state.descending=!state.descending;page=0;render();};
}
function columnControls(l,definitions,state){
 const signature=JSON.stringify([l.id,definitions.map(c=>[c.id,c.label])]);
 if(columnSignature!==signature){
  columnSignature=signature;$('#table-column-search').value='';
  $('#table-column-options').innerHTML=definitions.map((c,i)=>'<label title="'+esc(c.key??c.label)+'"><input type="checkbox" data-table-column="'+esc(c.id)+'" '+(i===0?'disabled':'')+'><span>'+esc(c.label)+(c.key&&c.key!==c.label?'<small>'+esc(c.key)+'</small>':'')+'</span></label>').join('');
 }
 for(const input of document.querySelectorAll('[data-table-column]'))input.checked=state.columns.includes(input.dataset.tableColumn);
 $('#table-columns-count').textContent=state.columns.length+'/'+definitions.length;
 $('#table-sort').innerHTML=definitions.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>').join('');$('#table-sort').value=state.sort;
 const direction=$('#table-sort-direction');direction.textContent=state.descending?'↓':'↑';direction.title=state.descending?'Descending · click for ascending':'Ascending · click for descending';direction.setAttribute('aria-label',direction.title);direction.setAttribute('aria-pressed',String(state.descending));
}
function setSort(id,fromHeader=false){
 const l=PortalLayers.active;if(!l)return;const definitions=columnsFor(l,rows),state=tableState(l,definitions);if(!definitions.some(c=>c.id===id))return;
 if(fromHeader&&state.sort===id)state.descending=!state.descending;else{state.sort=id;state.descending=false;}page=0;render();
 if(fromHeader)Array.from(document.querySelectorAll('[data-table-sort-field]')).find(b=>b.dataset.tableSortField===id)?.focus({preventScroll:true});
}
function refresh(){
 if(!map)return;const l=PortalLayers.active;$('#inventory-controls').hidden=!l||PortalLayers.isRaster(l);
 const choices=Array.from(PortalLayers.layers.values()).filter(x=>!PortalLayers.isRaster(x));$('#inventory-layer').innerHTML=choices.map(x=>'<option value="'+x.id+'" '+(x.id===l?.id?'selected':'')+'>'+esc(x.cfg.name)+'</option>').join('');
 if(!l||PortalLayers.isRaster(l)){rows=[];if(!$('#attribute-table').hidden)render();return;}
 if(lastLayer!==l.id){lastLayer=l.id;page=0;$('#table-search').value='';$('#selected-only').checked=false;$('#table-columns').open=false;}
 rows=records(l);const tableLimited=!!tableLimits.get(l);$('#visible-records').textContent=rows.length.toLocaleString()+(tableLimited?'+':'');$('#height-records').textContent=rows.filter(f=>(height(f,l)??0)>0).length.toLocaleString();
 $('#inventory-scope').textContent=tableLimited?'First 20,000 visible records · zoom in to see fewer':tiled(l)?'Loaded tile records · geometries may be simplified':l.cfg.type==='viewport'?(l.viewNote||'Current API view · not a national count'):'Features visible in this map view';
 const known=building(l);$('#inventory-color').value=l.colorMode;$('#inventory-change-note').hidden=!known||l.colorMode!=='change';$('#inventory-color').querySelector('[value=change]').disabled=!known||!l.fields?.includes('modified');$('#inventory-color').querySelector('[value=height]').disabled=!l.heightField;$('#inventory-color').querySelector('[value=source]').disabled=!l.fields?.some(f=>['bf_source','source','geom_source','SOURCE'].includes(f));$('#inventory-color').querySelector('[value=source]').textContent=known?'Footprint source':'Source field';
 const pool=map.getSource(l.id)?map.querySourceFeatures(l.id,tiled(l)?{sourceLayer:l.cfg.sourceLayer}:{}):[];l.sourceValues=Array.from(new Set([...(l.sourceValues||[]),...pool.slice(0,20000).map(source).filter(x=>x!=='Not provided')])).sort();
 $('#inventory-source').innerHTML='<option value="">All sources</option>'+l.sourceValues.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');$('#inventory-source').value=l.sourceFilter;$('#inventory-source').disabled=!l.sourceValues.length;
 $('#inventory-area').value=l.minArea;$('#inventory-area').disabled=!l.fields?.some(f=>['area_in_meters','area_m2'].includes(f));
 $('#inventory-height-note').textContent=l.heightField?'3D uses '+l.heightField+' in metres. '+(l.cfg.driver==='nyc'?'Converted from the source’s roof height in feet. ':l.cfg.driver==='usbf'?'Inherited GBA height; nDSM input coverage is separate. ':'')+'Missing heights stay missing.':known?'This source does not supply building height.':'No height field is selected for 3D.';
 if(!$('#attribute-table').hidden)render();
}
function schedule(){clearTimeout(timer);timer=setTimeout(refresh,150);}
function render(){
 const l=PortalLayers.active;if(!l||PortalLayers.isRaster(l)){filtered=[];shownColumns=[];$('#attribute-head').innerHTML='';$('#attribute-rows').innerHTML='<tr><td>Choose a vector layer to see its records.</td></tr>';$('#table-count').textContent='';$('#table-page').textContent='0 records';$('#table-prev').disabled=true;$('#table-next').disabled=true;const download=$('#attribute-table [data-export-table="csv"]');if(download)download.disabled=true;return;}
 const query=$('#table-search').value.trim().toLowerCase(),selection=PortalLayers.selection;
 const definitions=columnsFor(l,rows),state=tableState(l,definitions),positions=new Map((l.data?.features||rows).map((f,i)=>[f,i]));shownColumns=definitions.filter(c=>state.columns.includes(c.id));columnControls(l,definitions,state);
 filtered=rows.filter(f=>(!$('#selected-only').checked||(selection?.layer===l.id&&matches(selection.feature,f,l)))&&(!query||JSON.stringify([f.id??null,f.properties]).toLowerCase().includes(query)));
 filtered=sortRecords(filtered,definitions.find(c=>c.id===state.sort),l,state.descending,positions);
 page=Math.min(page,Math.max(0,Math.ceil(filtered.length/size)-1));const p=page*size;
 const metadata=metadataFor(l);$('#table-layer-name').textContent=l.cfg.name;$('#table-kind').textContent=tiled(l)?'TILE VIEW':'IN VIEW';$('#table-count').textContent=filtered.length.toLocaleString()+' '+($('#selected-only').checked?'selected records':building(l)&&!tiled(l)?'visible buildings':'visible records')+(metadata.tableLimited?' in the first 20,000':'');$('#table-scope-note').textContent=metadata.tableLimited?'Search, sort and download cover the first 20,000 visible records. Zoom in to see fewer.':tiled(l)?'Clipped / simplified tiles · not full dataset':'Map view · '+(metadata.inputScope?'input: '+metadata.inputScope:'source attributes');$('#table-scope-note').title=metadata.scope;
 $('#attribute-head').innerHTML='<tr>'+shownColumns.map(c=>'<th scope="col" aria-sort="'+(state.sort===c.id?(state.descending?'descending':'ascending'):'none')+'"><button type="button" data-table-sort-field="'+esc(c.id)+'" title="'+esc((c.key?'Original field: '+c.key+'. ':'')+'Sort by '+c.label)+'">'+esc(c.label)+(state.sort===c.id?'<span aria-hidden="true">'+(state.descending?'↓':'↑')+'</span>':'')+'</button></th>').join('')+'</tr>';
 $('#attribute-rows').innerHTML=filtered.slice(p,p+size).map((f,i)=>{const selected=!!(selection&&selection.layer===l.id&&matches(selection.feature,f,l)),index=positions.get(f)??(p+i);return '<tr tabindex="0" data-table-record="'+(p+i)+'" data-source-row="'+(index+1)+'" aria-selected="'+selected+'" class="'+(selected?'selected':'')+'">'+shownColumns.map(c=>{const value=valueFor(f,c,l,index),shown=['height','area'].includes(c.kind)?format(value??null):textValue(value),title=value===undefined?'Field not provided':value===null?'Null value':textValue(value),preview=shown.length>1200?shown.slice(0,1200)+'…':shown,tooltip=title.length>1200?title.slice(0,1200)+'… (download data for the full value)':title;return '<td data-column-id="'+esc(c.id)+'"'+(value===null||value===undefined?' class="inventory-missing"':'')+' title="'+esc(tooltip)+'"><span class="inventory-cell-value">'+esc(preview)+'</span></td>';}).join('')+'</tr>';}).join('')||'<tr><td colspan="'+shownColumns.length+'">No matching visible records. Zoom in or adjust the filters.</td></tr>';
 const download=$('#attribute-table [data-export-table="csv"]');if(download){download.disabled=!filtered.length;download.title=(metadata.tableLimited?'Download this table subset with all original attributes':'Download all original attributes, including hidden fields')+', with source and map scope';}
 $('#table-page').textContent=(filtered.length?p+1:0)+'–'+Math.min(p+size,filtered.length)+' of '+filtered.length.toLocaleString();$('#table-prev').disabled=page===0;$('#table-next').disabled=p+size>=filtered.length;
}
function toggleTable(){const t=$('#attribute-table');t.hidden=!t.hidden;$('#table-toggle').setAttribute('aria-expanded',String(!t.hidden));$('#table-toggle').classList.toggle('active',!t.hidden);refresh();setTimeout(()=>map.resize(),10);}
function saveFile(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportDialog(){if(window.PortalComposer){PortalComposer.open('download');return;}const l=PortalLayers.active;if(!l){PortalLayers.open();return;}refresh();render();$('#export-scope-note').textContent=tiled(l)?'Exports contain the currently loaded, filtered tile fragments. For complete original building geometries, use the source download.':'Exports contain visible, filtered features. The original GeoJSON remains available from the layer details.';const a=$('#export-source-link');a.href=l.cfg.page||l.cfg.url||'#';a.hidden=!l.cfg.page&&!l.cfg.url;$('#inventory-export-dialog').showModal();}
function exportTable(type){const l=PortalLayers.active;if(!l||PortalLayers.isRaster(l))return;refresh();render();const scope=tiled(l)?'visible-tile-fragments':'visible-features',metadata=metadataFor(l);
 if(type==='geojson'){const base=l.data?.provenance||l.cfg.provenance,cap=window.PortalAnalysisData?.capabilities(l),fragments=tiled(l)||cap?.attributePreview;saveFile(scope+'.geojson',JSON.stringify({type:'FeatureCollection',name:l.cfg.name,scope:metadata.scope,features:filtered,provenance:{...(base||{}),scope:'visible-map-records',scopeLabel:metadata.scope,limited:metadata.limited,featureCount:fragments?null:filtered.length,fragmentCount:fragments?filtered.length:null,geometryQuality:fragments?'clipped-or-simplified-tile-fragments':base?.geometryQuality||'full-loaded-source-geometry',spatialEligible:!fragments&&cap?.geometryAnalysis!==false,featureRole:building(l)?'buildings':'features',tableView:metadata,...(base?{lineage:[base]}:{})}}),'application/geo+json');}
 else{const file=tableCSV(l,filtered,metadata);saveFile(file.name,file.body,file.mime);}
}
function search(query){if(!query)return [];let result=places.map((p,i)=>({label:p[0],note:'Indexed place · jump to map',action:'place-'+i})).filter(x=>x.label.toLowerCase().includes(query));
 const coords=query.split(/[,\s]+/).map(Number);if(coords.length===2&&coords.every(Number.isFinite)&&Math.abs(coords[0])<=180&&Math.abs(coords[1])<=85)result.unshift({label:coords.join(', '),note:'Longitude, latitude',action:'coords:'+coords.join(',')});
 if(window.PortalModels?.manifest)for(const m of PortalModels.manifest.models)if((m.id+' '+m.label+' '+m.city).toLowerCase().includes(query))result.push({label:m.label+' · '+m.city,note:m.kind,action:'model:'+m.id});
 result=result.slice(0,8);if(result.length){$('#search-results').innerHTML=result.map(x=>'<button type="button" data-search-result="'+esc(x.action)+'">'+esc(x.label)+'<small>'+esc(x.note)+'</small></button>').join('');$('#search-results').hidden=false;}return result;}
function navigate(action){if(action.startsWith('model:')){PortalModels.open(action.slice(6));return true;}if(action.startsWith('coords:')){window.PortalModels?.hide();const c=action.slice(7).split(',').map(Number);map.jumpTo({center:c,zoom:16,pitch:0});$('#map-place-name').textContent='Custom location';return true;}if(!action.startsWith('place-'))return false;const p=places[Number(action.slice(6))];if(!p)return false;window.PortalModels?.hide();api.setViewMode(false,false);map.jumpTo({center:p.slice(1,3),zoom:p[3],pitch:0,bearing:0});$('#map-place-name').textContent=p[0];$('#welcome-card').hidden=true;return true;}
function selectRow(i){const f=filtered[i],l=PortalLayers.active;if(f&&l)PortalLayers.inspect(l,f);render();}
function init(portal){api=portal;map=api.map;createTableControls();map.on('moveend',schedule);map.on('idle',schedule);['portal-layers-changed','portal-selection-changed','portal-style-changed'].forEach(e=>document.addEventListener(e,schedule));
 $('#inventory-layer').onchange=e=>PortalLayers.selectLayer(e.target.value);$('#inventory-color').onchange=e=>PortalLayers.setStyle(PortalLayers.active.id,{colorMode:e.target.value});$('#inventory-source').onchange=e=>PortalLayers.setStyle(PortalLayers.active.id,{sourceFilter:e.target.value});$('#inventory-area').onchange=e=>{const n=Number(e.target.value);PortalLayers.setStyle(PortalLayers.active.id,{minArea:Number.isFinite(n)?Math.max(0,n):0});};$('#reset-filters').onclick=()=>{if(PortalLayers.active)PortalLayers.setStyle(PortalLayers.active.id,{colorMode:'uniform',sourceFilter:'',minArea:0});};
 $('#table-search').oninput=()=>{page=0;render();};$('#table-sort').onchange=()=>setSort($('#table-sort').value);$('#table-prev').onclick=()=>{page--;render();};$('#table-next').onclick=()=>{page++;render();};$('#selected-only').addEventListener('change',()=>{page=0;render();});$('#close-inventory-export').onclick=()=>$('#inventory-export-dialog').close();
 document.addEventListener('change',e=>{const id=e.target.dataset.tableColumn,l=PortalLayers.active;if(id===undefined||!l)return;const definitions=columnsFor(l,rows),state=tableState(l,definitions);if(e.target.checked){if(!state.columns.includes(id))state.columns.push(id);}else state.columns=state.columns.filter(k=>k!==id);render();});
 document.addEventListener('click',e=>{if(!e.target.closest('#table-columns'))$('#table-columns').open=false;const b=e.target.closest('[data-table-record],[data-export-table],[data-place],[data-table-sort-field]');if(!b)return;if(b.dataset.tableSortField!==undefined){setSort(b.dataset.tableSortField,true);return;}if(b.dataset.tableRecord!==undefined)selectRow(Number(b.dataset.tableRecord));if(b.dataset.exportTable)exportTable(b.dataset.exportTable);if(b.dataset.place){const i=places.findIndex(p=>p[0]===b.dataset.place);if(i>=0)navigate('place-'+i);}});
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-table-record]')){e.preventDefault();selectRow(Number(e.target.dataset.tableRecord));}});refresh();
}
window.PortalInventory={init,refresh:schedule,toggleTable,exportDialog,exportTable,search,navigate,tableData:{columns:columnsFor,defaults:defaultColumns,value:valueFor,text:textValue,compare:compareValues,sort:sortRecords,csv:tableCSV,metadata:metadataFor,isBuilding:building,collect:boundedRecords},get rows(){return rows;},get filtered(){return filtered;},get columns(){return shownColumns.map(c=>({...c}));}};
})();
