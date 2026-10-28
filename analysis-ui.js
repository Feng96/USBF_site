/* User-facing statistics and charts; each action binds an independent source input. */
(function(root){
  'use strict';
  const A=()=>root.PortalAnalysisData,$=id=>document.getElementById('analysis-'+id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=1)=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
  const storage='usbf-analysis-options-v2',objects=new WeakMap(),jobs=new WeakMap();
  let dialog,tab='stats',snapshot=null,summary=null,lastStats=null,lastChart=null,lastResult=null,binding=null;
  let controller=null,busy=false,initialized=false,objectSequence=0,activeJob=Promise.resolve(),autoPending=false,lastError='',fieldChartKind=null,generation=0;
  const operationLabels={buffer:'Surrounding area',filter:'Keep features in an area',clip:'Trim outlines to an area',intersect:'Compare overlapping areas',aggregate:'Summarize by area',measure:'Add area and boundary length',centroid:'Create center points'};
  let preferences={};
  try{const stored=JSON.parse(localStorage.getItem(storage)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))preferences=stored;}catch(e){}
  function remember(){try{preferences={...preferences,chartOptions:{...preferences.chartOptions,[$('chart-kind').value]:{field:$('chart-field').value,y:$('chart-y').value,group:$('chart-group').value}},scope:$('scope').value,numeric:$('numeric-field').value,category:$('group-field').value,chartKind:$('chart-kind').value,chartField:$('chart-field').value,chartY:$('chart-y').value,chartGroup:$('chart-group').value,operation:$('operation').value,distance:$('distance').value};localStorage.setItem(storage,JSON.stringify(preferences));}catch(e){}}
  function identity(object){if(!object||typeof object!=='object')return null;if(!objects.has(object))objects.set(object,++objectSequence);return objects.get(object);}
  function layer(){return root.PortalLayers?.layers.get($('layer')?.value);}
  function available(){const l=layer(),c=A().capabilities(l);return !!(c.supported&&(!c.attributePreview||$('tile-optin').checked)&&!(l.cfg.type==='viewport'&&(l.viewLoading||!l.loaded||l.error)));}
  function bounds(){const b=root.portal?.map.getBounds();return b?[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]:null;}
  function inputBinding(){
    const l=layer();if(!l)return '';
    const scope=$('scope').value,selected=root.PortalLayers.selection;
    return JSON.stringify([l.id,identity(l.data),l.data?.features.length,l.sourceFilter||'',l.cfg.fixedSource||'',l.minArea||0,l.viewLoadedAt,l.release?[l.release.name,l.release.updated,l.release.tiles,l.release.buildings]:null,l.viewLoading,scope,scope==='view'||l.cfg.type==='viewport'?bounds():null,scope==='selection'?[selected?.layer,identity(selected?.feature)]:null,$('tile-optin').checked]);
  }
  function fieldLabel(key){
    if(key==='$area_m2')return snapshot?.provenance.featureRole==='buildings'?'Footprint area · m²':'Area · m²';
    if(key==='$length_m')return 'Boundary length · m';
    if(snapshot?.provenance.featureRole!=='buildings'&&key==='height_m')return 'Height · m';
    if(root.PortalExplorer?.fieldLabel)return root.PortalExplorer.fieldLabel(key);
    const names={height_m:'Building height · m',height:'Original height value',render_height:'Building height · m',source:'Footprint source',bf_source:'Footprint source',state:'State',usbf_id:'Building ID',modified:'Footprint change'};
    return names[key]||String(key).replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
  }
  function sourceNote(l,c){
    if(!l)return 'Choose a dataset, or add a file to the map.';
    if(!c.supported)return 'This layer is an image. Choose building footprints or another vector layer for these tools.';
    if(c.attributePreview)return 'This map uses display tiles. Open the original outlines for building counts, areas and spatial analysis.';
    if(l.cfg.type==='viewport'&&l.viewLoading)return 'Buildings are loading for this area.';
    if(l.cfg.type==='viewport'&&l.error)return 'Buildings could not be loaded here. Return to the map and try another area.';
    if(l.cfg.type==='viewport'&&!l.loaded)return 'Zoom into a neighborhood to see building statistics.';
    return l.cfg.type==='viewport'?'Results cover the records available in this neighborhood.':'Choose this map area, the whole dataset, or one selected feature.';
  }
  function scopeLabel(p){
    if(p.fragmentCount!==undefined)return 'Display samples from the current map';
    if(p.operation)return 'Study-area result';
    if(p.requestedScope==='selection'||p.scope==='selection')return 'Selected feature';
    if(p.scope==='whole-layer')return 'Whole dataset';
    if(p.scope==='view-intersection'||p.requestedView)return 'Current map area';
    return 'Loaded neighborhood';
  }
  function featureWord(s=snapshot){return s?.provenance.featureRole==='buildings'?'buildings':'features';}
  function save(name,data,type){const u=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
  function csv(rows){return rows.map(row=>row.map(v=>{let s=v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);if(typeof v==='string'&&/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
  function friendlyError(error){
    const s=error?.message||'The tool could not finish. Try again.';
    if(error?.name==='AbortError')return 'Cancelled.';
    if(/1,500|50,000 feature pairs|20,000 records|vertices|analysis limits|exceeds.*records|more.*records/i.test(s))return 'There is too much data for this calculation. Zoom in, choose a smaller study area, or select one building.';
    if(/finish loading|fresh snapshot/i.test(s))return 'Buildings are still loading. Wait a moment, then try again.';
    if(/No records|No data in/i.test(s))return 'No features are available in this area. Search for a place or zoom into a neighborhood, then try again.';
    if(/Original vector geometry|display fragments|PMTiles\/MVT/i.test(s))return 'This layer shows display tiles. Add the original outlines to count buildings, measure areas or use spatial tools.';
    if(/invalid geometry|invalid.*coordinates|unsupported.*geometry/i.test(s))return 'Some outlines cannot be used by this tool. Try another area or check the original file.';
    if(/EPSG:4326/i.test(s))return 'The coordinates do not match the map. Check the source coordinate system when adding this file.';
    if(/complete loaded GeoJSON|reference.*polygon|zone.*polygon/i.test(s))return 'Choose a study-area polygon, or use the current map area.';
    return s;
  }
  function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('analysis-error',error);$('message').hidden=!text;$('return-map').hidden=!error;}
  function updateFreshness(){
    if(!dialog)return;
    const changed=!!snapshot&&binding!==inputBinding();$('changed').hidden=!changed;
    if(changed)$('changed').textContent='The map or data has changed. Refresh to use the latest area and records.';
  }
  function setBusy(on){
    busy=on;dialog.setAttribute('aria-busy',String(on));
    dialog.querySelectorAll('button:not([data-analysis-close]):not([data-analysis-cancel]),select,input').forEach(el=>el.disabled=on);
    $('cancel').hidden=!on;
    if(!on){updateScope();updateOperation();updateButtons();updateFreshness();}
  }
  function aborted(){const error=Error('Cancelled.');error.name='AbortError';return error;}
  function currentJob(signal){const own=jobs.get(signal);if(!own||own.generation!==generation||signal.aborted)throw aborted();return own;}
  function inputFor(signal){const own=currentJob(signal);if(!own.snapshot)throw Error('Choose a dataset first.');return own.snapshot;}
  function invalidate(){generation++;controller?.abort();}
  function cancel(options={}){autoPending=false;invalidate();if(options.clear)clearSnapshot();return activeJob;}
  function job(task){
    if(busy)return activeJob;
    controller=new AbortController();const own=controller,token=++generation;
    jobs.set(own.signal,{generation:token,snapshot,binding});setBusy(true);lastError='';message('Calculating…');
    activeJob=(async()=>{try{await task(own.signal);if(token===generation&&!own.signal.aborted)message('');}catch(e){if(token===generation){lastError=e.message||String(e);message(friendlyError(e),e.name!=='AbortError');}}finally{if(controller===own){controller=null;setBusy(false);maybeAuto();}}})();
    return activeJob;
  }
  function progress(done,total){message('Calculating… '+Math.round(done/Math.max(total,1)*100)+'%');}
  function clearProducts(){summary=null;lastStats=null;lastChart=null;lastResult=null;$('overview').innerHTML='';$('stats-result').innerHTML='';$('geometry-result').innerHTML='';$('chart-result').innerHTML='';$('spatial-result').innerHTML='';}
  function clearSnapshot(){invalidate();snapshot=null;binding=null;clearProducts();$('snapshot').hidden=true;$('changed').hidden=true;updateButtons();}
  function fieldsForSource(){
    const l=layer();if(!l)return [];
    return Array.from(new Set([...(l.fields||[]),...l.data?.features.slice(0,200).flatMap(f=>Object.keys(f.properties||{}))||[]]));
  }
  function fillSelect(id,options,preferred){
    const el=$(id),old=el.value,wanted=preferred??old;
    el.innerHTML=options.map(([v,text])=>'<option value="'+esc(v)+'"'+(v===wanted?' selected':'')+'>'+esc(text)+'</option>').join('')||'<option value="">'+(id==='layer'?'No data added':id==='numeric-field'?'No numeric values':'No suitable field')+'</option>';
    if(options.some(o=>o[0]===wanted))el.value=wanted;
  }
  function valueFields(){
    const c=A().capabilities(layer()),names=snapshot?snapshot.fields:fieldsForSource();
    const numeric=snapshot?A().numericFields(snapshot):names.filter(k=>['height_m','height','render_height'].includes(k)||layer()?.data?.features.some(f=>A().number(f.properties?.[k])!==null));
    const options=numeric.map(k=>[k,fieldLabel(k)]);
    if(c.geometryAnalysis)options.push(['$area_m2',fieldLabel('$area_m2')],['$length_m',fieldLabel('$length_m')]);
    if(!options.length&&c.attributePreview)return names.map(k=>[k,fieldLabel(k)]);
    return options;
  }
  function populateFields(){
    const choices=valueFields(),names=(snapshot?snapshot.fields:fieldsForSource()).map(k=>[k,fieldLabel(k)]),l=layer();
    const bestHeight=l?.heightField&&choices.some(o=>o[0]===l.heightField)?l.heightField:choices.find(o=>o[0]==='height_m')?.[0];
    const preferredNumeric=$('numeric-field').value||preferences.numeric||bestHeight||(choices.some(o=>o[0]==='$area_m2')?'$area_m2':choices[0]?.[0]);
    fillSelect('numeric-field',choices,preferredNumeric);
    const source=names.find(o=>['source','bf_source','geom_source','state'].includes(o[0]))?.[0];
    fillSelect('group-field',names,$('group-field').value||preferences.category||source);
    fillSelect('chart-group',names,$('chart-group').value||preferences.chartGroup||source);
    fillSelect('chart-y',choices,$('chart-y').value||preferences.chartY||bestHeight||choices[1]?.[0]||choices[0]?.[0]);
    updateChartFields();
  }
  function refreshLayers(){
    if(!dialog)return;const layers=root.PortalLayers?.layers;if(!layers)return;
    const old=$('layer').value,selected=old&&layers.has(old)?old:root.PortalLayers.active?.id;
    fillSelect('layer',Array.from(layers.values()).map(l=>[l.id,l.cfg.name]),selected);
    const reference=$('reference').value;
    fillSelect('reference',[['__map__','Current map area'],...Array.from(layers.values()).filter(l=>{const c=A().capabilities(l);return c.wholeLayer&&c.geometryAnalysis&&l.data?.features.length&&l.data.features.every(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type));}).map(l=>[l.id,l.cfg.name])],reference||'__map__');
    if(old&&old!==$('layer').value){clearSnapshot();autoPending=tab==='stats'&&dialog.open;}
    updateScope();if(!snapshot)populateFields();updateFreshness();maybeAuto();
  }
  function updateScope(){
    if(!dialog||busy)return;
    const l=layer(),c=A().capabilities(l),tiles=c.kind==='tile-preview',previous=$('scope').value||preferences.scope||'view';
    $('source-note').textContent=sourceNote(l,c);$('tile-preview').hidden=!tiles;$('original-data').hidden=!(tiles||!l||!c.supported);$('return-map').hidden=!(lastError||l?.cfg.type==='viewport'&&!l.loaded);
    const choices=tiles?[['tile-preview','Map display samples']]:c.wholeLayer?[['view','Current map area'],['layer','Whole dataset'],['selection','Selected feature']]:[['view','Current map area'],['layer','Loaded neighborhood'],['selection','Selected feature']];
    fillSelect('scope',choices,previous);
    $('capture').disabled=!available();$('scope').disabled=!c.supported;
    $('original-data').textContent=tiles?'Open original building data':l?'Add building footprints':'Add data';
    updateButtons();
  }
  function updateButtons(){
    if(!dialog||busy)return;
    const can=available(),c=A().capabilities(layer());
    $('run-stats').disabled=!can||!$('numeric-field').value;$('run-groups').disabled=!can||!$('group-field').value;
    $('run-geometry').disabled=!can||!c.geometryAnalysis;$('run-chart').disabled=!can||!$('chart-field').value;
    $('run-spatial').disabled=!can||!c.geometryAnalysis;$('snapshot-download').disabled=!snapshot;
    $('stats-download').disabled=!lastStats&&!summary;$('chart-svg').disabled=!lastChart;$('chart-csv').disabled=!lastChart;$('chart-png').disabled=!lastChart;
    $('spatial-add').disabled=!lastResult?.features.length;$('spatial-download').disabled=!lastResult;
  }
  function switchTab(name){
    tab=['analysis','spatial'].includes(name)?'spatial':['chart','charts'].includes(name)?'chart':'stats';
    dialog.querySelectorAll('[data-analysis-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.analysisTab===tab));b.tabIndex=b.dataset.analysisTab===tab?0:-1;});
    ['stats','chart','spatial'].forEach(t=>$('panel-'+t).hidden=t!==tab);
  }
  function renderSnapshot(){
    const p=snapshot.provenance,word=featureWord(),count=p.fragmentCount!==undefined?fmt(p.fragmentCount,0)+' display samples':fmt(p.featureCount,0)+' '+word;
    $('snapshot').hidden=false;$('snapshot-name').textContent=p.name;$('snapshot-scope').textContent=count+' · '+scopeLabel(p);
    $('snapshot-time').textContent='Data used: '+new Date(p.capturedAt).toLocaleString();$('snapshot-limit').hidden=!p.limited;
    $('snapshot-provenance').innerHTML=sourceFacts(p);populateFields();
  }
  function sourceFacts(p){
    const rows=[['Dataset',p.name],['Area',scopeLabel(p)],['Data used',new Date(p.capturedAt).toLocaleString()]];
    if(p.release?.updated)rows.push(['Published',new Date(p.release.updated).toLocaleString()]);
    if(p.sourceUrl)rows.push(['Source',p.sourceUrl]);
    if(p.heightBasis)rows.push(['Height source',p.sourceDriver==='usbf'||p.sourceDriver==='gba'?'GlobalBuildingAtlas estimates':p.heightBasis]);
    if(p.licenses?.length)rows.push(['Terms',p.licenses.join(' · ')]);
    if(p.lineage?.length)rows.push(['Based on',p.lineage.map(l=>l.name||l.scopeLabel||'Source data').join(' · ')]);
    return rows.map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd></div>').join('');
  }
  async function prepare(signal){
    const l=layer();if(!l)throw Error('Add a dataset to the map first.');
    const start=inputBinding(),captured=await A().capture(l,{scope:$('scope').value,map:root.portal.map,selection:root.PortalLayers.selection,allowTilePreview:$('tile-optin').checked,signal,onProgress:progress});
    const own=currentJob(signal);if(binding!==start)clearProducts();own.snapshot=captured;own.binding=start;snapshot=captured;binding=start;renderSnapshot();return captured;
  }
  function metric(value,label,detail=''){return '<div class="analysis-metric"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</div>';}
  async function renderOverview(signal){
    const data=inputFor(signal),result=await A().overview(data,{signal,onProgress:progress});currentJob(signal);summary=result;
    if(summary.kind==='display-preview'){$('overview').innerHTML='<p class="analysis-note">These samples can describe displayed fields. They cannot give a building count or footprint area.</p>';return;}
    const word=summary.kind==='buildings'?'Buildings':'Features',h=summary.height;
    let html=metric(fmt(summary.records,0),word,scopeLabel(summary.provenance));
    if(h){const fraction=summary.records?h.valid/summary.records:0;html+=metric((fraction*100).toFixed(0)+'%','Have a height',fmt(h.valid,0)+' of '+fmt(summary.records,0));html+=metric(h.mean===null?'—':fmt(h.mean)+' m','Average height',h.median===null?'No supplied heights':'Median '+fmt(h.median)+' m');}
    if(summary.area)html+=metric(fmt(summary.area.sum/1000000,3)+' km²',summary.kind==='buildings'?'Total footprint area':'Total polygon area',fmt(summary.polygonRecords,0)+' polygons');
    $('overview').innerHTML='<div class="analysis-metrics">'+html+'</div>';
    $('overview-note').textContent=summary.provenance.sourceDriver==='usbf'||summary.provenance.sourceDriver==='gba'?'Heights are estimates from GlobalBuildingAtlas, not on-site measurements.':h?'Missing height values are left out of height averages.':'No height field was supplied for this dataset.';
  }
  function validateField(field,data=snapshot){if(!data||!field||!data.fields.includes(field)&&!['$area_m2','$length_m'].includes(field))throw Error('That field is no longer available. Choose another field.');}
  function table(headers,rows){return '<div class="analysis-table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
  async function statistics(signal,requested){
    const data=inputFor(signal),field=requested||$('numeric-field').value;validateField(field,data);
    const stats=A().summarize(await A().valuesAsync(data,field,{signal,onProgress:progress}));currentJob(signal);
    lastStats={kind:'numeric',field,summary:stats,provenance:data.provenance};
    const names={observations:data.capabilities.attributePreview?'Display samples':'Features',valid:'With a value',missing:'No usable value',sum:'Total',mean:'Average',median:'Middle value (median)',min:'Lowest',max:'Highest',stddev:'Spread (standard deviation)'};
    $('stats-result').innerHTML='<h3>'+esc(fieldLabel(field))+'</h3>'+table(['Measure','Value'],Object.entries(stats).map(([k,v])=>[names[k],fmt(v)]))+'<p class="analysis-note">Missing and nonnumeric values are left out of calculations.</p>';
    updateButtons();
  }
  function groups(requested,signal){
    const data=inputFor(signal),field=requested||$('group-field').value;validateField(field,data);const rows=A().frequencies(data,field);currentJob(signal);
    lastStats={kind:'groups',field,rows,provenance:data.provenance};
    $('stats-result').innerHTML='<h3>'+esc(fieldLabel(field))+'</h3>'+table(['Category',data.capabilities.attributePreview?'Display samples':featureWord(data)],rows.map(r=>[r.label,fmt(r.count,0)]));updateButtons();
  }
  async function geometry(signal){
    const data=inputFor(signal),result=await A().measure(data,{signal,onProgress:progress});currentJob(signal);
    $('geometry-result').innerHTML='<h3>'+(data.provenance.featureRole==='buildings'?'Footprint area and boundary length':'Area and boundary length')+'</h3>'+table(['Measure','Value'],[['Polygons',fmt(result.area_m2.valid,0)],['Total area · m²',fmt(result.area_m2.sum)],['Average area · m²',fmt(result.area_m2.mean)],['Total boundary / line length · m',fmt(result.length_m.sum)]])+'<p class="analysis-note">Whole outlines are measured, including holes. Overlapping polygons can contribute to the area more than once.</p>';
    lastStats={kind:'geometry',result,provenance:data.provenance};updateButtons();
  }
  async function refreshStatistics(signal){await prepare(signal);currentJob(signal);await renderOverview(signal);if($('numeric-field').value){await statistics(signal);currentJob(signal);lastStats.automatic=true;}}
  function maybeAuto(){
    if(!autoPending||busy||!dialog?.open||tab!=='stats'||!available())return;
    autoPending=false;job(refreshStatistics);
  }
  function updateChartFields(){
    if(!dialog)return;const kind=$('chart-kind').value,choices=valueFields(),categories=(snapshot?snapshot.fields:fieldsForSource()).map(k=>[k,fieldLabel(k)]),changed=fieldChartKind!==kind,saved=preferences.chartOptions?.[kind]||{};
    const height=choices.find(o=>o[0]===snapshot?.provenance.heightField)?.[0]||choices.find(o=>o[0]==='height_m')?.[0]||choices[0]?.[0],source=categories.find(o=>['source','bf_source','geom_source','state'].includes(o[0]))?.[0]||categories[0]?.[0];
    const preferred=changed?saved.field||(kind==='category'?source:kind==='scatter'&&choices.some(o=>o[0]==='$area_m2')?'$area_m2':height):$('chart-field').value;
    fillSelect('chart-field',kind==='category'?categories:choices,preferred);
    fillSelect('chart-group',categories,changed?saved.group||source:$('chart-group').value);
    fillSelect('chart-y',choices,changed?saved.y||height:$('chart-y').value);
    if(kind==='scatter'&&$('chart-y').value===$('chart-field').value){const other=choices.find(o=>o[0]!==$('chart-field').value);if(other)$('chart-y').value=other[0];}
    fieldChartKind=kind;$('bins-wrap').hidden=kind!=='histogram';$('chart-y-wrap').hidden=kind!=='scatter';$('chart-group-wrap').hidden=kind!=='grouped';
    $('chart-field-label').textContent=kind==='scatter'?'Horizontal axis':kind==='grouped'?'Value to compare':'Field';updateButtons();
  }
  function compact(v){if(v===null)return '—';if(Math.abs(v)>=1000000)return fmt(v/1000000,1)+'m';if(Math.abs(v)>=1000)return fmt(v/1000,1)+'k';return fmt(v,2);}
  function chartSVG(chart,data=snapshot){
    const p=chart.provenance,w=900,h=560,kind=chart.kind,category=['category','grouped'].includes(kind),left=category?245:85,right=category?100:50,top=110,bottom=120,width=w-left-right,height=h-top-bottom;
    const name=kind==='scatter'?fieldLabel(chart.xField)+' and '+fieldLabel(chart.yField):kind==='grouped'?'Average '+fieldLabel(chart.valueField)+' by '+fieldLabel(chart.groupField):fieldLabel(chart.field);
    let body='',axis='',rows=chart.rows||[];
    if(kind==='scatter'){
      let {xmin,xmax,ymin,ymax}=chart.range;if(xmin===xmax){const d=Math.max(1,Math.abs(xmin)*.05);xmin-=d;xmax+=d;}if(ymin===ymax){const d=Math.max(1,Math.abs(ymin)*.05);ymin-=d;ymax+=d;}
      for(let i=0;i<=4;i++){const f=i/4,x=left+width*f,y=top+height-height*f;body+='<line x1="'+x+'" y1="'+top+'" x2="'+x+'" y2="'+(top+height)+'" stroke="#e5ebe7"/><line x1="'+left+'" y1="'+y+'" x2="'+(left+width)+'" y2="'+y+'" stroke="#e5ebe7"/><text x="'+x+'" y="'+(top+height+23)+'" text-anchor="middle">'+esc(compact(xmin+(xmax-xmin)*f))+'</text><text x="'+(left-12)+'" y="'+(y+4)+'" text-anchor="end">'+esc(compact(ymin+(ymax-ymin)*f))+'</text>';}
      for(const point of chart.points){const x=left+(point.x-xmin)/(xmax-xmin)*width,y=top+height-(point.y-ymin)/(ymax-ymin)*height;body+='<circle cx="'+x+'" cy="'+y+'" r="3.1" fill="#287f76" fill-opacity=".55"><title>'+esc(compact(point.x)+', '+compact(point.y))+'</title></circle>';}
      body+='<text x="'+(left+width/2)+'" y="'+(top+height+49)+'" text-anchor="middle">'+esc(fieldLabel(chart.xField))+'</text><text transform="translate(23 '+(top+height/2)+') rotate(-90)" text-anchor="middle">'+esc(fieldLabel(chart.yField))+'</text>';
      axis=fmt(chart.valid,0)+' paired values'+(chart.sampled?' · showing '+fmt(chart.drawn,0)+' evenly spaced points':'');
    }else{
      const values=rows.map(r=>kind==='grouped'?r.mean:r.count).filter(v=>v!==null),low=kind==='grouped'?Math.min(0,...values):0,high=Math.max(1,...values),range=high-low;
      for(let i=0;i<=4;i++){const f=i/4;if(category){const x=left+width*f;body+='<line x1="'+x+'" y1="'+top+'" x2="'+x+'" y2="'+(top+height)+'" stroke="#e5ebe7"/><text x="'+x+'" y="'+(top+height+22)+'" text-anchor="middle">'+esc(compact(low+range*f))+'</text>';}else{const y=top+height-height*f;body+='<line x1="'+left+'" y1="'+y+'" x2="'+(left+width)+'" y2="'+y+'" stroke="#e5ebe7"/><text x="'+(left-12)+'" y="'+(y+4)+'" text-anchor="end">'+esc(compact(high*f))+'</text>';}}
      rows.forEach((r,i)=>{const value=kind==='grouped'?r.mean:r.count;if(category){const slot=height/rows.length,y=top+slot*i+slot*.14,zero=left+(0-low)/range*width,end=value===null?zero:left+(value-low)/range*width,bar=Math.abs(end-zero);body+='<rect x="'+Math.min(zero,end)+'" y="'+y+'" width="'+bar+'" height="'+slot*.68+'" rx="2" fill="#287f76"><title>'+esc(r.label+': '+(value===null?'No value':compact(value)))+'</title></rect><text x="'+(left-10)+'" y="'+(y+slot*.47)+'" text-anchor="end">'+esc(r.label.length>31?r.label.slice(0,28)+'…':r.label)+'</text><text x="'+Math.min(w-20,Math.max(zero,end)+8)+'" y="'+(y+slot*.47)+'">'+esc(value===null?'No value':compact(value))+'</text>';}else{const slot=width/rows.length,x=left+slot*i,y=top+height-height*r.count/high;body+='<rect x="'+(x+1)+'" y="'+y+'" width="'+Math.max(1,slot-2)+'" height="'+(top+height-y)+'" fill="#287f76"><title>'+esc(compact(r.low)+' – '+compact(r.high)+': '+r.count)+'</title></rect>';if(i===0||i===rows.length-1||i%Math.max(1,Math.floor(rows.length/5))===0)body+='<text x="'+x+'" y="'+(top+height+25)+'">'+esc(compact(r.low))+'</text>';}});axis=kind==='grouped'?'Average values; groups with no value are marked.':data.capabilities.attributePreview?'Map display samples':featureWord(data);
    }
    const scope=scopeLabel(p)+(p.limited?' · partial coverage':''),foot=axis+' · '+new Date(p.capturedAt).toISOString().slice(0,16).replace('T',' ')+' UTC';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(name)+'"><metadata>'+esc(JSON.stringify({chart:{...chart,svg:undefined,pairs:undefined},provenance:p}))+'</metadata><rect width="'+w+'" height="'+h+'" fill="#fff"/><g font-family="Arial,sans-serif" fill="#203f34" font-size="12"><text x="28" y="34" font-size="21" font-weight="600">'+esc(name.slice(0,110))+'</text><text x="28" y="60" fill="#607267">'+esc(p.name.slice(0,110))+'</text><text x="28" y="81" fill="#607267">'+esc(scope)+'</text>'+body+'<text x="28" y="492" fill="#607267">'+esc(foot)+'</text><text x="28" y="518" font-size="11" fill="#607267">'+esc((p.licenses||[]).join(' · ').slice(0,145))+'</text><text x="28" y="541" font-size="10" fill="#718277"></text></g></svg>';
  }
  async function chart(signal,definition){
    const data=inputFor(signal),def=definition||chartDefinition();validateField(def.field,data);let result;
    if(def.kind==='scatter'){validateField(def.y,data);result=await A().scatter(data,def.field,def.y,{signal,onProgress:progress});}
    else if(def.kind==='grouped'){validateField(def.group,data);result=await A().groupedStatistics(data,def.group,def.field,{signal,onProgress:progress,maxGroups:10});if(!result.rows.some(r=>r.valid))throw Error('No numeric values are available in these groups. Choose another field.');}
    else{const rows=def.kind==='category'?A().frequencies(data,def.field,10):A().histogram(await A().valuesAsync(data,def.field,{signal,onProgress:progress}),def.bins);if(!rows.length)throw Error('No numeric values are available. Choose another field.');result={kind:def.kind,field:def.field,rows,provenance:data.provenance};}
    currentJob(signal);lastChart=result;lastChart.svg=chartSVG(lastChart,data);$('chart-result').innerHTML=lastChart.svg;updateButtons();
  }
  function chartDefinition(){return {kind:$('chart-kind').value,field:$('chart-field').value,y:$('chart-y').value,group:$('chart-group').value,bins:Number($('bins').value)};}
  function updateOperation(){
    if(!dialog)return;const op=$('operation').value;
    $('distance-wrap').hidden=op!=='buffer';$('reference-wrap').hidden=!['filter','clip','intersect','aggregate'].includes(op);$('predicate-wrap').hidden=op!=='filter';
    const notes={buffer:'Create an area around each outline. For example, 50 m around every building.',filter:'Keep whole features that touch or lie within your study area.',clip:'Cut the outlines at the study-area boundary. Buildings crossing the edge are trimmed.',intersect:'Split outlines where they overlap the selected areas. A building can appear in more than one overlapping area.',aggregate:'Count features and add their footprint areas inside each study area. Overlapping areas can share the same building.',measure:'Add footprint area and boundary length to each record.',centroid:'Create a center point for each feature. For irregular shapes the center can be outside the outline.'};
    $('operation-note').textContent=notes[op];$('run-spatial').textContent=op==='aggregate'?'Summarize areas':op==='buffer'?'Create surrounding areas':'Run';
  }
  async function spatial(signal,definition){
    const data=inputFor(signal),def=definition||{operation:$('operation').value,distance:Number($('distance').value),reference:$('reference').value,predicate:$('predicate').value,mapBounds:bounds()},options={signal,onProgress:progress,distance:def.distance,predicate:def.predicate};
    if(['clip','intersect','filter','aggregate'].includes(def.operation)){
      let reference;
      if(def.reference==='__map__'){if(!def.mapBounds||def.mapBounds[0]>=def.mapBounds[2])throw Error('Choose a map area within one longitude range.');reference={id:'current-map-area',cfg:{type:'geojson',name:'Current map area'},data:root.turf.featureCollection([root.turf.bboxPolygon(def.mapBounds)])};}
      else reference=root.PortalLayers.layers.get(def.reference);
      if(!reference)throw Error('Choose a study area first.');
      options.reference=await A().capture(reference,{scope:'layer',respectFilters:true,signal,onProgress:progress});currentJob(signal);
    }
    const output=await A().run(data,def.operation,options);currentJob(signal);lastResult=output;
    $('spatial-result').innerHTML='<h3>'+esc(operationLabels[def.operation])+'</h3><p>'+fmt(lastResult.features.length,0)+' result features from '+fmt(data.features.length,0)+' '+featureWord(data)+'.</p>'+(lastResult.provenance.limited?'<p class="analysis-warning">Some source data was unavailable. This result covers the available features only.</p>':'')+'<div class="analysis-actions"><button type="button" data-analysis-add-result>Add to map</button><button type="button" data-analysis-download-result>Download result</button></div><details><summary>Data sources and area</summary><dl class="analysis-source-facts">'+sourceFacts(lastResult.provenance)+'</dl></details>';updateButtons();
  }
  function statsDownload(){
    const s=lastStats,p=s?.provenance||summary?.provenance;if(!p)return;let rows;
    if(!s||s.automatic&&summary&&summary.kind!=='display-preview')rows=[['measure','value'],[summary.kind==='buildings'?'buildings':'features',summary.records],['with_height',summary.height?.valid],['without_usable_height',summary.height?.missing],['average_height_m',summary.height?.mean],['median_height_m',summary.height?.median],['polygon_area_m2',summary.area?.sum]];
    else rows=s.kind==='numeric'?[['measure','value'],...Object.entries(s.summary)]:s.kind==='groups'?[['category','count'],...s.rows.map(r=>[r.label,r.count])]:[['measure','value'],...Object.entries(s.result.area_m2).map(([k,v])=>['area_m2_'+k,v]),...Object.entries(s.result.length_m).map(([k,v])=>['length_m_'+k,v])];
    rows=rows.map((r,i)=>r.concat(i===0?['source','area','data_time','licenses']:[p.name,p.scopeLabel,p.capturedAt,p.licenses]));save('building-statistics.csv',csv(rows),'text/csv;charset=utf-8');
  }
  function chartDownload(){
    if(!lastChart)return;const c=lastChart,p=c.provenance;let rows;
    if(c.kind==='scatter')rows=[['x','y'],...(c.pairs||c.points).map(point=>[point.x,point.y])];
    else if(c.kind==='grouped')rows=[['category','records','with_value','average','median','total','lowest','highest'],...c.rows.map(r=>[r.label,r.observations,r.valid,r.mean,r.median,r.sum,r.min,r.max])];
    else rows=c.kind==='category'?[['category','count'],...c.rows.map(r=>[r.label,r.count])]:[['bin_low','bin_high','count'],...c.rows.map(r=>[r.low,r.high,r.count])];
    rows=rows.map((r,i)=>r.concat(i===0?['field','source','area','data_time','licenses','sampling']:[c.kind==='scatter'?[c.xField,c.yField].join(' / '):c.field||c.valueField,p.name,p.scopeLabel,p.capturedAt,p.licenses,c.kind==='scatter'?'All '+c.valid+' paired values; the plot shows '+c.drawn+'.':'']));save('chart-data.csv',csv(rows),'text/csv;charset=utf-8');
  }
  function crc32(data){let crc=0xffffffff;for(const value of data){crc^=value;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  function pngWithMetadata(bytes,metadata){
    if(bytes.length<20||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw Error('The chart image could not be encoded.');
    const encoder=new TextEncoder(),keyword=encoder.encode('US Buildings source'),json=encoder.encode(JSON.stringify(metadata)),data=new Uint8Array(keyword.length+5+json.length);data.set(keyword);data.set(json,keyword.length+5);
    const type=encoder.encode('iTXt'),chunk=new Uint8Array(data.length+12),view=new DataView(chunk.buffer);view.setUint32(0,data.length);chunk.set(type,4);chunk.set(data,8);view.setUint32(chunk.length-4,crc32(chunk.slice(4,-4)));
    const result=new Uint8Array(bytes.length+chunk.length);result.set(bytes.slice(0,-12));result.set(chunk,bytes.length-12);result.set(bytes.slice(-12),result.length-12);return result;
  }
  async function chartImage(){
    if(!lastChart?.svg)throw Error('Make a chart first.');const chart=lastChart,u=URL.createObjectURL(new Blob([chart.svg],{type:'image/svg+xml'})),image=new Image();
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('The chart image could not be rendered.'));image.src=u;});const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1120;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export is unavailable in this browser.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const raw=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('The chart image is empty.')),'image/png'));const data=pngWithMetadata(new Uint8Array(await raw.arrayBuffer()),{chart:{kind:chart.kind,field:chart.field,xField:chart.xField,yField:chart.yField,groupField:chart.groupField,valueField:chart.valueField,sampling:chart.sampling},provenance:chart.provenance});return {blob:new Blob([data],{type:'image/png'}),provenance:chart.provenance};}finally{URL.revokeObjectURL(u);}
  }
  async function addResult(signal){
    if(!lastResult?.features.length)return;currentJob(signal);const result=lastResult,name=operationLabels[result.analysis.operation]+' · '+(result.provenance.lineage?.[0]?.name||'Result'),meta={allowHeight:false,provenance:result.provenance,license:result.provenance.licenses.join('; '),attribution:result.provenance.licenses.join('; '),color:'#b1763b'};
    if(root.PortalLayers.addGeoJSON)await root.PortalLayers.addGeoJSON(name,result,meta);else await root.PortalLayers.add({type:'geojson',name,data:result,...meta});dialog.close();
  }
  function ensure(){
    if(initialized)return;initialized=true;dialog=document.createElement('dialog');dialog.id='analysis-workspace';dialog.className='analysis-workspace';dialog.setAttribute('aria-labelledby','analysis-title');
    dialog.innerHTML=[
      '<header class="analysis-header"><h2 id="analysis-title">Statistics and analysis</h2><button type="button" class="analysis-close" data-analysis-close aria-label="Close">×</button></header>',
      '<div class="analysis-tabs" role="tablist" aria-label="Data tools"><button type="button" role="tab" id="analysis-tab-stats" data-analysis-tab="stats" aria-controls="analysis-panel-stats">Statistics</button><button type="button" role="tab" id="analysis-tab-spatial" data-analysis-tab="spatial" aria-controls="analysis-panel-spatial">Spatial tools</button><button type="button" role="tab" id="analysis-tab-chart" data-analysis-tab="chart" aria-controls="analysis-panel-chart">Charts</button></div>',
      '<div class="analysis-body"><section class="analysis-inputs"><div class="analysis-grid"><label>Dataset<select id="analysis-layer"></select></label><label>Area<select id="analysis-scope"></select></label></div><p id="analysis-source-note" class="analysis-note"></p><div class="analysis-input-actions"><button type="button" id="analysis-capture" class="analysis-text-button">Refresh data</button><button type="button" id="analysis-original-data" hidden>Open original building data</button></div><details id="analysis-tile-preview" hidden><summary>Preview displayed fields</summary><label id="analysis-tile-optin-wrap" class="analysis-optin"><input id="analysis-tile-optin" type="checkbox"> Use map display samples. These can contain parts of the same building.</label></details></section>',
      '<p id="analysis-message" class="analysis-message" role="status" aria-live="polite" hidden></p><button type="button" id="analysis-cancel" data-analysis-cancel hidden>Cancel</button><button type="button" id="analysis-return-map" class="analysis-text-button" hidden>Return to map</button>',
      '<p id="analysis-changed" class="analysis-warning" hidden></p>',
      '<section id="analysis-snapshot" class="analysis-snapshot" hidden><strong id="analysis-snapshot-name"></strong><p id="analysis-snapshot-scope"></p><span id="analysis-snapshot-time" class="analysis-note"></span><p id="analysis-snapshot-limit" class="analysis-warning" hidden>Some data was unavailable. Results cover the available features only.</p><details><summary>Data source and area</summary><dl id="analysis-snapshot-provenance" class="analysis-source-facts"></dl><button type="button" id="analysis-snapshot-download" class="analysis-text-button">Download source details</button></details></section>',
      '<section id="analysis-panel-stats" role="tabpanel" aria-labelledby="analysis-tab-stats"><div id="analysis-overview"></div><p id="analysis-overview-note" class="analysis-note"></p><details class="analysis-more-statistics"><summary>Explore a field</summary><div class="analysis-grid"><div><label>Numeric value<select id="analysis-numeric-field"></select></label><button type="button" id="analysis-run-stats">Calculate</button></div><div><label>Group by<select id="analysis-group-field"></select></label><button type="button" id="analysis-run-groups">Count groups</button></div></div><div class="analysis-actions"><button type="button" id="analysis-run-geometry">Measure outlines</button></div><div id="analysis-stats-result" class="analysis-result"></div><div id="analysis-geometry-result" class="analysis-result"></div></details><div class="analysis-actions"><button type="button" id="analysis-stats-download">Download statistics</button></div></section>',
      '<section id="analysis-panel-spatial" role="tabpanel" aria-labelledby="analysis-tab-spatial" hidden><label>What would you like to do?<select id="analysis-operation"><option value="buffer">Add an area around each feature (buffer)</option><option value="filter">Keep features in a study area</option><option value="clip">Trim outlines to a study area (clip)</option><option value="aggregate">Count and measure features by area</option><option value="intersect">Compare overlapping areas</option><option value="measure">Add area and boundary length</option><option value="centroid">Create center points</option></select></label><p id="analysis-operation-note" class="analysis-note"></p><div class="analysis-grid"><label id="analysis-distance-wrap">Distance · m<input id="analysis-distance" type="number" value="50" min=".01" max="100000" step="any"></label><label id="analysis-reference-wrap" hidden>Study area<select id="analysis-reference"></select></label><label id="analysis-predicate-wrap" hidden>Include features that<select id="analysis-predicate"><option value="intersects">Touch or overlap the area</option><option value="representative-point">Have a point inside the area</option></select></label></div><div class="analysis-actions"><button type="button" id="analysis-run-spatial" class="analysis-primary">Run</button><button type="button" id="analysis-spatial-add" hidden>Add result to map</button><button type="button" id="analysis-spatial-download" hidden>Download result</button></div><div id="analysis-spatial-result" class="analysis-result"></div></section>',
      '<section id="analysis-panel-chart" role="tabpanel" aria-labelledby="analysis-tab-chart" hidden><div class="analysis-grid"><label>Chart type<select id="analysis-chart-kind"><option value="histogram">Distribution</option><option value="category">Counts by category</option><option value="scatter">Compare two values</option><option value="grouped">Average by category</option></select></label><label><span id="analysis-chart-field-label">Field</span><select id="analysis-chart-field"></select></label><label id="analysis-chart-y-wrap" hidden>Vertical axis<select id="analysis-chart-y"></select></label><label id="analysis-chart-group-wrap" hidden>Group by<select id="analysis-chart-group"></select></label><label id="analysis-bins-wrap">Number of groups<input id="analysis-bins" type="number" value="10" min="2" max="30" step="1"></label></div><div class="analysis-actions"><button type="button" id="analysis-run-chart" class="analysis-primary">Make chart</button><button type="button" id="analysis-chart-png">PNG image</button><button type="button" id="analysis-chart-svg">SVG</button><button type="button" id="analysis-chart-csv">Chart data</button></div><div id="analysis-chart-result" class="analysis-chart-result"></div></section></div>'
    ].join('');
    document.body.append(dialog);
    dialog.querySelector('[data-analysis-close]').onclick=()=>{controller?.abort();dialog.close();};
    dialog.addEventListener('cancel',()=>controller?.abort());$('cancel').onclick=()=>controller?.abort();$('return-map').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-analysis-tab]').forEach(b=>{b.onclick=()=>{switchTab(b.dataset.analysisTab);if(tab==='stats'&&!snapshot){autoPending=true;maybeAuto();}};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const tabs=['stats','spatial','chart'],next=tabs[(tabs.indexOf(tab)+(e.key==='ArrowRight'?1:2))%3];$('tab-'+next).click();$('tab-'+next).focus();}};});
    $('layer').onchange=()=>{clearSnapshot();updateScope();populateFields();autoPending=tab==='stats';maybeAuto();};
    $('scope').onchange=()=>{clearSnapshot();populateFields();remember();autoPending=tab==='stats';maybeAuto();};
    $('tile-optin').onchange=()=>{clearSnapshot();updateScope();populateFields();};
    $('capture').onclick=()=>job(tab==='stats'?refreshStatistics:prepare);
    $('original-data').onclick=()=>{const original=A().capabilities(layer()).attributePreview;dialog.close();if(original&&root.PortalImport)root.PortalImport.open('url');else root.PortalLayers.open('catalog');};
    $('run-stats').onclick=()=>{const field=$('numeric-field').value;remember();job(async signal=>{await prepare(signal);await renderOverview(signal);await statistics(signal,field);});};
    $('run-groups').onclick=()=>{const field=$('group-field').value;remember();job(async signal=>{await prepare(signal);groups(field,signal);});};
    $('run-geometry').onclick=()=>job(async signal=>{await prepare(signal);await geometry(signal);});
    $('run-chart').onclick=()=>{const definition=chartDefinition();remember();job(async signal=>{await prepare(signal);await chart(signal,definition);});};
    $('run-spatial').onclick=()=>{const definition={operation:$('operation').value,distance:Number($('distance').value),reference:$('reference').value,predicate:$('predicate').value,mapBounds:bounds()};remember();job(async signal=>{await prepare(signal);await spatial(signal,definition);});};
    $('operation').onchange=()=>{remember();updateOperation();};$('chart-kind').onchange=()=>{updateChartFields();remember();};
    ['numeric-field','group-field','chart-field','chart-y','chart-group'].forEach(id=>$(id).onchange=()=>{remember();updateButtons();});
    $('snapshot-download').onclick=()=>snapshot&&save('data-sources.json',JSON.stringify(snapshot.provenance,null,2),'application/json');
    $('stats-download').onclick=statsDownload;$('chart-csv').onclick=chartDownload;$('chart-svg').onclick=()=>lastChart&&save('building-chart.svg',lastChart.svg,'image/svg+xml');
    $('chart-png').onclick=()=>job(async signal=>{const image=await chartImage();currentJob(signal);save('building-chart.png',image.blob);});
    $('spatial-download').onclick=()=>lastResult&&save('analysis-result.geojson',JSON.stringify(lastResult),'application/geo+json');$('spatial-add').onclick=()=>job(addResult);
    dialog.addEventListener('click',e=>{if(e.target.closest('[data-analysis-add-result]'))job(addResult);if(e.target.closest('[data-analysis-download-result]'))$('spatial-download').click();});
    document.addEventListener('portal-layers-changed',refreshLayers);['portal-style-changed','portal-selection-changed'].forEach(e=>document.addEventListener(e,()=>{updateFreshness();if(!snapshot)populateFields();}));
    root.portal?.map.on('moveend',updateFreshness);
    if(['histogram','category','scatter','grouped'].includes(preferences.chartKind))$('chart-kind').value=preferences.chartKind;
    if(Object.prototype.hasOwnProperty.call(operationLabels,preferences.operation))$('operation').value=preferences.operation;
    if(Number(preferences.distance)>0&&Number(preferences.distance)<=100000)$('distance').value=preferences.distance;
    switchTab(tab);refreshLayers();updateOperation();updateButtons();
  }
  function open(name='stats',options={}){
    ensure();refreshLayers();
    if(options.layerId&&root.PortalLayers.layers.has(options.layerId)){$('layer').value=options.layerId;clearSnapshot();}
    else if(root.PortalLayers.active?.id&&$('layer').value!==root.PortalLayers.active.id){$('layer').value=root.PortalLayers.active.id;clearSnapshot();}
    updateScope();if(options.scope&&Array.from($('scope').options).some(o=>o.value===options.scope))$('scope').value=options.scope;
    populateFields();switchTab(name);if(!dialog.open)dialog.showModal();updateFreshness();
    if(tab==='stats'&&options.auto!==false){autoPending=true;maybeAuto();}
    return activeJob;
  }
  root.PortalAnalysis={open,cancel,fieldLabel,whenReady:()=>activeJob,chartImage,pngWithMetadata,get busy(){return busy;},get error(){return lastError;},get overview(){return summary;},get snapshot(){return snapshot;},get result(){return lastResult;},get chart(){return lastChart;},get statistics(){return lastStats;}};
  document.addEventListener('portal-ready',ensure);if(root.portal?.ready)ensure();
})(globalThis);
