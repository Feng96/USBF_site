/* Analysis always starts with an independent, explicitly scoped source snapshot. */
(function (root) {
  'use strict';
  const limits = Object.freeze({features:20000, vertices:500000, spatialFeatures:1500, spatialVertices:200000, geometryVertices:15000, pairs:50000});
  const polygon = f => ['Polygon','MultiPolygon'].includes(f?.geometry?.type);
  const tiled = l => ['pmtiles','vector'].includes(l?.cfg?.type);
  const clone = value => JSON.parse(JSON.stringify(value));
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  function freeze(value) { if(value && typeof value === 'object' && !Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }
  function number(value) { if(typeof value === 'number')return Number.isFinite(value)?value:null;if(typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())){const n=Number(value);return Number.isFinite(n)?n:null;}return null; }
  function abort(signal) { if(signal?.aborted){const e=Error('Analysis cancelled.');e.name='AbortError';throw e;} }
  function turf() { if(!root.turf)throw Error('The geometry tools could not load. Reload the workspace.');return root.turf; }
  function capabilities(layer) {
    if(!layer)return {supported:false,geometryAnalysis:false,wholeLayer:false,note:'Choose a vector layer first.'};
    const type=layer.cfg?.type, inherited=layer.data?.provenance||layer.cfg?.provenance;
    if(['raster','image','raster-pmtiles'].includes(type)||layer.cfg?.sourceKind==='raster')return {supported:false,geometryAnalysis:false,wholeLayer:false,kind:'display-only',note:'Raster display layers do not supply vector records. These tools require original vector data; imagery tiles cannot be used as raw analysis pixels.'};
    if(tiled(layer))return {supported:true,attributePreview:true,geometryAnalysis:false,wholeLayer:false,kind:'tile-preview',note:'Rendered tiles contain clipped or simplified fragments. Field previews are possible; building totals, geometry analysis and full-data exports require original vector data.'};
    if(['geojson','viewport'].includes(type) && Array.isArray(layer.data?.features)){
      const eligible=inherited?.spatialEligible!==false&&!/tile[ -]fragments|clipped-or-simplified-tile/i.test([inherited?.geometryQuality,layer.data?.scope].join(' '));
      if(!eligible)return {supported:true,attributePreview:true,geometryAnalysis:false,wholeLayer:false,kind:'tile-preview',note:'This file descends from display fragments. Only an explicit field preview is available; geometry analysis and unique-building totals remain unavailable.'};
      return {supported:true,attributePreview:false,geometryAnalysis:true,wholeLayer:type==='geojson',kind:type==='viewport'?'loaded-view':'source',note:type==='viewport'?'Only real records loaded for this neighborhood are available. This is a local snapshot, not a complete regional inventory.':'Original loaded vector geometry is available.'};
    }
    return {supported:false,geometryAnalysis:false,wholeLayer:false,kind:'display-only',note:'This display layer has no analysis-ready vector records. Connect original vector data for these tools. Raster pixel analysis requires the original raster and is separate from imagery tiles.'};
  }
  function vertices(geometry, validate=true) {
    let count=0;
    function walk(coordinates){if(!Array.isArray(coordinates))throw Error('Invalid geometry coordinates.');if(typeof coordinates[0]==='number'){
      if(validate && (coordinates.length<2 || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) || Math.abs(coordinates[0])>180 || Math.abs(coordinates[1])>90))throw Error('Analysis needs longitude/latitude geometry in EPSG:4326.');count++;
    }else coordinates.forEach(walk);}
    if(!geometry)return 0;
    if(geometry.type==='GeometryCollection'){if(!Array.isArray(geometry.geometries))throw Error('Invalid geometry collection.');for(const g of geometry.geometries)count+=vertices(g,validate);}
    else if(['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon'].includes(geometry.type))walk(geometry.coordinates);
    else throw Error('Unsupported geometry type: '+geometry.type);
    return count;
  }
  function extentOf(features){let box=[Infinity,Infinity,-Infinity,-Infinity];function walk(c){if(typeof c[0]==='number'){box[0]=Math.min(box[0],c[0]);box[1]=Math.min(box[1],c[1]);box[2]=Math.max(box[2],c[0]);box[3]=Math.max(box[3],c[1]);}else c.forEach(walk);}function geometry(g){if(!g)return;if(g.type==='GeometryCollection')g.geometries.forEach(geometry);else walk(g.coordinates);}features.forEach(f=>geometry(f.geometry));return box.every(Number.isFinite)?box:null;}
  const boxesIntersect=(a,b)=>a&&b&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
  function boundsOf(map){if(!map)return null;const b=map.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];}
  function filterFeature(f,l){const p=f.properties||{},sourceField=['bf_source','source','geom_source','SOURCE'].find(k=>l.fields?.includes(k)||Object.prototype.hasOwnProperty.call(p,k));if(l.sourceFilter && String(p[sourceField])!==l.sourceFilter)return false;if(l.cfg?.fixedSource && String(p[sourceField]).toLowerCase()!==l.cfg.fixedSource)return false;const a=number(p.area_in_meters??p.area_m2);return !(l.minArea>0 && (a===null||a<l.minArea));}
  function stableID(value){return typeof value==='string'&&value.trim()!==''||typeof value==='number'&&Number.isFinite(value);}
  function isBuildingLayer(layer){
    const p=layer?.data?.provenance||layer?.cfg?.provenance,c=capabilities(layer),features=layer?.data?.features;
    if(!c.geometryAnalysis||p?.operation||layer?.data?.analysis?.operation||layer?.cfg?.sourceKind==='drawing'||p?.role==='user-drawing')return false;
    return ['usbf','gba','nyc'].includes(layer.cfg.driver)||['dc-government','training-heights'].includes(layer.cfg.id)||layer.cfg.dataRole==='buildings'||p?.featureRole==='buildings'||!!(features?.length&&features.every(f=>polygon(f)&&stableID(f.properties?.usbf_id)));
  }
  function sameFeature(a,b){if(a===b)return true;const ap=a?.properties||{},bp=b?.properties||{};for(const key of ['usbf_id','model_id','doitt_id','OBJECTID','objectid','building_id'])if(stableID(ap[key])&&stableID(bp[key]))return String(ap[key])===String(bp[key]);if(stableID(ap.source)&&stableID(ap.id)&&stableID(bp.source)&&stableID(bp.id))return ap.source===bp.source&&String(ap.id)===String(bp.id);if(stableID(a?.id)&&stableID(b?.id))return String(a.id)===String(b.id)&&JSON.stringify(a.geometry)===JSON.stringify(b.geometry);return JSON.stringify([a?.geometry,ap])===JSON.stringify([b?.geometry,bp]);}
  function collectLicenses(features,layer){const licenses=new Set();if(layer.cfg?.license)licenses.add(layer.cfg.license);for(const f of features)for(const [key,value] of Object.entries(f.properties||{}))if(/licen[cs]e|copyright|attribution/i.test(key)&&value!==null&&value!=='')licenses.add(typeof value==='string'?value:JSON.stringify(value));return Array.from(licenses);}
  function captureBoundary(layer,capturedAt){
    const c=capabilities(layer);
    if(!c.wholeLayer||!c.geometryAnalysis||!layer.data?.features?.length||!layer.data.features.every(polygon))throw Error('Choose a complete polygon layer as your study area.');
    if(layer.data.features.length>100)throw Error('The study area has too many separate polygons. Choose a smaller area.');
    const features=clone(layer.data.features),vertexCount=features.reduce((n,f)=>n+vertices(f.geometry),0),t=turf();
    if(vertexCount>20000)throw Error('The study-area boundary has too many vertices. Draw a simpler area.');
    for(const f of features)if((t.booleanValid&&!t.booleanValid(f))||t.kinks(f).features.length||!(t.area(f)>0))throw Error('The study-area boundary crosses itself or has no area. Redraw it and try again.');
    return {layerId:layer.id,name:layer.cfg.name,capturedAt,crs:'EPSG:4326',features,extent:extentOf(features),vertexCount,licenses:collectLicenses(features,layer),provenance:layer.data.provenance?clone(layer.data.provenance):layer.cfg.provenance?clone(layer.cfg.provenance):null,selection:'intersects',geometryRule:'Complete source polygons touching or overlapping any study-area polygon; each source record is included once. Outlines are never clipped.'};
  }
  async function capture(layer, options={}) {
    const capturedAt=new Date().toISOString();
    if(layer)layer={...layer,cfg:{...layer.cfg,provenance:layer.cfg?.provenance?clone(layer.cfg.provenance):null},fields:layer.fields?.slice(),release:layer.release?clone(layer.release):null,viewBounds:layer.viewBounds?.slice(),data:layer.data?{...layer.data,features:layer.data.features?.slice(),provenance:layer.data.provenance?clone(layer.data.provenance):null}:null};
    const cap=capabilities(layer);if(!cap.supported)throw Error(cap.note);
    const map=options.map||root.portal?.map,requested=options.scope==='all'?'layer':options.scope||'layer',isTiles=tiled(layer),isFragments=cap.kind==='tile-preview';
    if(isFragments && (!options.allowTilePreview||requested!=='tile-preview'))throw Error('PMTiles/MVT and their exports are display fragments. Connect original GeoJSON or a full-geometry source before analysis or data download. You can explicitly enable a tile field preview in Statistics.');
    if(!['layer','view','selection','tile-preview','study-area'].includes(requested))throw Error('Unknown analysis scope.');
    if(!isTiles && layer.cfg.type==='viewport' && (layer.viewLoading||!layer.loaded||layer.error))throw Error('Wait for this neighborhood to finish loading, then capture a fresh snapshot.');
    const studyArea=requested==='study-area'?captureBoundary(options.studyArea,capturedAt):null;
    if(studyArea&&!isBuildingLayer(layer))throw Error('Choose an original building footprint layer. Drawings and other polygon layers are study areas, rather than building datasets.');
    const viewBounds=boundsOf(map),selected=options.selection||root.PortalLayers?.selection;
    let raw;
    if(isTiles){if(!map)throw Error('The map is not ready.');const ids=(layer.renderIds||[]).filter(id=>!map.getLayer||map.getLayer(id));raw=map.queryRenderedFeatures({layers:ids});}
    else raw=layer.data.features.slice();
    if(raw.length>limits.features && !['view','selection','study-area'].includes(requested))throw Error('This analysis can use up to '+limits.features.toLocaleString()+' records. Choose the current view or a smaller source file.');
    if(studyArea&&raw.length*studyArea.features.length>limits.pairs)throw Error('There are too many buildings and area polygons for this calculation. Choose a smaller study area or one boundary.');
    if(requested==='selection'){if(!selected||selected.layer!==layer.id)throw Error('Select a feature from this layer first.');const direct=raw.find(f=>f===selected.feature);raw=direct?[direct]:raw.filter(f=>sameFeature(f,selected.feature));if(raw.length>1)throw Error('This selection matches more than one source feature. Select the feature on the map again.');}
    let viewPolygon;
    if(requested==='view'){
      if(!viewBounds||viewBounds[0]>=viewBounds[2]||viewBounds[1]>=viewBounds[3]||viewBounds[0]<-180||viewBounds[2]>180)throw Error('Choose a map view within one longitude range before capturing it.');
      viewPolygon=turf().bboxPolygon(viewBounds);
    }
    const studyBoxes=studyArea?.features.map(f=>extentOf([f])),features=[],seen=new Set();let vertexCount=0;
    for(let i=0;i<raw.length;i++){
      if(i%128===127){options.onProgress?.(i+1,raw.length);await tick();}
      abort(options.signal);const f=raw[i];if(options.respectFilters!==false&&!filterFeature(f,layer))continue;
      if(requested==='view' && (!f.geometry||!boxesIntersect(extentOf([f]),viewBounds)||!turf().booleanIntersects(f,viewPolygon)))continue;
      if(studyArea){
        if(!polygon(f))throw Error('A record in this building layer has no polygon outline. Choose a building footprint layer with complete outlines.');
        const box=extentOf([f]);if(!boxesIntersect(box,studyArea.extent))continue;
        if(vertices(f.geometry)>limits.geometryVertices)throw Error('One building has too many vertices for this calculation. Choose another area or simplify its original outline.');
        if(!studyArea.features.some((zone,z)=>boxesIntersect(box,studyBoxes[z])&&turf().booleanIntersects(f,zone)))continue;
      }
      if(isTiles){const k=JSON.stringify([f.id??null,f.properties,f.geometry]);if(seen.has(k))continue;seen.add(k);}
      const item=isTiles?{type:'Feature',geometry:f.geometry?clone(f.geometry):null,properties:f.properties===null?null:clone(f.properties||{}),...(f.id===undefined?{}:{id:f.id})}:clone(f);
      vertexCount+=vertices(item.geometry);if(vertexCount>limits.vertices)throw Error('This snapshot exceeds '+limits.vertices.toLocaleString()+' vertices. Use a smaller area.');features.push(item);if(features.length>limits.features)throw Error('This snapshot exceeds '+limits.features.toLocaleString()+' records. Choose a smaller area.');
    }
    if(!features.length&&!studyArea)throw Error('No records in the chosen scope. Load a neighborhood or adjust the layer filters.');
    const local=layer.cfg.type==='viewport',baseProvenance=layer.data?.provenance||layer.cfg?.provenance||null;
    const sourceScope=isFragments?'tile-preview':local?'loaded-view':studyArea?'study-area-intersection':requested==='view'?'view-intersection':requested==='selection'?'selection':'whole-layer';
    const limited=local && (layer.viewLimited===true||layer.viewLimited===undefined&&/limit reached/i.test(layer.viewNote||''));
    const scopeLabel=isFragments?'Tile field preview — fragments, not unique buildings':studyArea?'Whole buildings touching or overlapping '+studyArea.name+(local?' among loaded neighborhood records':'')+(limited?' (source limit reached)':''):local?'Loaded neighborhood records'+(requested==='view'?' intersecting the current view':requested==='selection'?' restricted to the selected record':'')+(limited?' (source limit reached)':''):requested==='view'?'Whole source features intersecting the captured map view':requested==='selection'?'Selected source feature':'Complete loaded vector layer';
    const knownBuildings=isBuildingLayer(layer);
    const autoHeight=layer.cfg.allowHeight!==false&&baseProvenance?.autoHeight!==false&&!baseProvenance?.operation&&!layer.data?.analysis?.operation;
    const provenance={version:1,layerId:layer.id,name:layer.cfg.name,sourceType:layer.cfg.type,sourceDriver:layer.cfg.driver||null,sourceUrl:layer.cfg.page||layer.cfg.url||null,capturedAt,scope:sourceScope,requestedScope:requested,scopeLabel,featureRole:knownBuildings?'buildings':'features',autoHeight,heightField:autoHeight?(layer.heightField||['height_m','height','render_height'].find(k=>features.some(f=>Object.prototype.hasOwnProperty.call(f.properties||{},k)))||null):null,heightBasis:layer.cfg.driver==='usbf'?'Inherited GlobalBuildingAtlas height; lidar input coverage is separate':layer.cfg.driver==='gba'?'Estimated GlobalBuildingAtlas height':layer.cfg.driver==='nyc'?'Source roof height converted from feet to metres':baseProvenance?.heightBasis||null,geometryQuality:isFragments?'clipped-or-simplified-tile-fragments':'full-loaded-source-geometry',spatialEligible:cap.geometryAnalysis&&!isFragments,limited,extent:extentOf(features),requestedView:requested==='view'?viewBounds:null,loadedView:local?clone(layer.viewBounds||viewBounds):null,loadedAt:local?layer.viewLoadedAt||null:null,release:layer.release?clone(layer.release):null,filters:{source:layer.sourceFilter||'',fixedSource:layer.cfg.fixedSource||'',minArea:layer.minArea||0,respected:options.respectFilters!==false},licenses:collectLicenses(features,layer),lineage:baseProvenance?[clone(baseProvenance)]:[],vertexCount};
    if(baseProvenance){provenance.derived=true;provenance.scopeLabel=scopeLabel+' · inherited scope: '+(baseProvenance.scopeLabel||baseProvenance.scope||'see lineage');provenance.licenses=Array.from(new Set([...provenance.licenses,...(baseProvenance.licenses||[])]));}
    if(isFragments)provenance.fragmentCount=features.length;else provenance.featureCount=features.length;
    if(local && layer.viewSelection)provenance.selectionRule=layer.viewSelection;
    else if(local && layer.cfg.driver==='usbf')provenance.selectionRule='Published cx/cy ownership coordinates inside the loaded view plus a 0.002-degree buffer; not an exhaustive intersection query for large buildings centered outside that buffer.';
    if(baseProvenance?.limited)provenance.limited=true;
    if(studyArea){
      studyArea.sourceCoverage=local?'Loaded neighborhood records only':'Complete imported layer';
      const b=layer.viewBounds;studyArea.withinLoadedBounds=local&&b?studyArea.extent[0]>=b[0]&&studyArea.extent[1]>=b[1]&&studyArea.extent[2]<=b[2]&&studyArea.extent[3]<=b[3]:local?null:true;
      provenance.studyArea=studyArea;provenance.licenses=Array.from(new Set([...provenance.licenses,...studyArea.licenses]));
      if(local&&studyArea.withinLoadedBounds!==true)provenance.limited=true;
    }
    const fields=Array.from(new Set(features.length?features.flatMap(f=>Object.keys(f.properties||{})):layer.fields||[])).sort();
    return freeze({features,fields,provenance,capabilities:{...cap,geometryAnalysis:provenance.spatialEligible,buildingTotals:!isFragments}});
  }
  function captureStudyArea(layer,studyArea,options={}){return capture(layer,{...options,scope:'study-area',studyArea});}
  function sourceGeoJSON(snapshot){
    requireGeometry(snapshot);
    return {type:'FeatureCollection',name:snapshot.provenance.name,features:clone(snapshot.features),provenance:{...clone(snapshot.provenance),crs:'EPSG:4326'}};
  }
  function numericFields(snapshot){return snapshot.fields.filter(k=>snapshot.features.some(f=>number(f.properties?.[k])!==null));}
  function geometryValue(feature,field){const t=turf(),g=feature.geometry;if(!g)return null;if(field==='$area_m2')return polygon(feature)?t.area(feature):null;if(field==='$length_m'){if(polygon(feature))return t.length(t.polygonToLine(feature),{units:'meters'});return ['LineString','MultiLineString'].includes(g.type)?t.length(feature,{units:'meters'}):null;}throw Error('Unknown geometry measure.');}
  function fieldNumber(snapshot,field,value){const n=number(value);return snapshot.provenance.featureRole==='buildings'&&field===snapshot.provenance.heightField&&!(n>0)?null:n;}
  function values(snapshot,field){if(field==='$area_m2'||field==='$length_m'){if(!snapshot.capabilities.geometryAnalysis)throw Error('Geometry measures are unavailable for tile field previews.');return snapshot.features.map(f=>geometryValue(f,field));}return snapshot.features.map(f=>fieldNumber(snapshot,field,f.properties?.[field]));}
  async function valuesAsync(snapshot,field,options={}){if(field==='$area_m2'||field==='$length_m')requireGeometry(snapshot);const out=[];for(let i=0;i<snapshot.features.length;i++){abort(options.signal);const f=snapshot.features[i];out.push(field==='$area_m2'||field==='$length_m'?geometryValue(f,field):fieldNumber(snapshot,field,f.properties?.[field]));if(i%128===127){options.onProgress?.(i+1,snapshot.features.length);await tick();}}return out;}
  function summarize(input){const data=input.map(number).filter(v=>v!==null);if(!data.length)return {observations:input.length,valid:0,missing:input.length,sum:0,mean:null,median:null,min:null,max:null,stddev:null};let sum=0,correction=0,mean=0,m2=0,min=Infinity,max=-Infinity;for(let i=0;i<data.length;i++){const x=data[i],y=x-correction,next=sum+y;correction=(next-sum)-y;sum=next;const delta=x-mean;mean+=delta/(i+1);m2+=delta*(x-mean);min=Math.min(min,x);max=Math.max(max,x);}if(![sum,mean,m2].every(Number.isFinite))throw Error('Values exceed the supported numeric range. Choose a different field.');const sorted=data.slice().sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return {observations:input.length,valid:data.length,missing:input.length-data.length,sum,mean,median:sorted.length%2?sorted[middle]:(sorted[middle-1]/2+sorted[middle]/2),min,max,stddev:Math.sqrt(Math.max(0,m2/data.length))};}
  function frequencies(snapshot,field,maxGroups=25){const groups=new Map();for(const f of snapshot.features){const value=f.properties?.[field],key=JSON.stringify([typeof value,value??null]),label=value===null||value===undefined?'Not provided':value===''?'Empty string':typeof value==='object'?JSON.stringify(value):String(value);const row=groups.get(key)||{label,count:0};row.count++;groups.set(key,row);}const rows=Array.from(groups.values()).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));if(rows.length>maxGroups){const extra=rows.splice(maxGroups-1);rows.push({label:'Other categories ('+extra.length+')',count:extra.reduce((n,r)=>n+r.count,0)});}return rows;}
  function histogram(input,bins=10){const data=input.map(number).filter(v=>v!==null);if(!data.length)return [];bins=Math.min(30,Math.max(2,Math.floor(bins)));let low=Infinity,high=-Infinity;for(const x of data){low=Math.min(low,x);high=Math.max(high,x);}if(low===high){const padding=Math.max(Math.abs(low)*.05,1);low-=padding;high+=padding;}const step=(high-low)/bins;if(!Number.isFinite(step)||step<=0)throw Error('Values exceed the supported chart range.');const rows=Array.from({length:bins},(_,i)=>({low:low+step*i,high:low+step*(i+1),count:0}));for(const x of data)rows[Math.min(bins-1,Math.max(0,Math.floor((x-low)/step)))].count++;return rows;}
  async function measure(snapshot,options={}){requireGeometry(snapshot);const areas=[],lengths=[],types={};for(let i=0;i<snapshot.features.length;i++){abort(options.signal);const f=snapshot.features[i],type=f.geometry?.type||'Missing';types[type]=(types[type]||0)+1;areas.push(geometryValue(f,'$area_m2'));lengths.push(geometryValue(f,'$length_m'));if(i%64===63){options.onProgress?.(i+1,snapshot.features.length);await tick();}}return {area_m2:summarize(areas),length_m:summarize(lengths),types,measurement:'Turf spherical Earth measurements in metres and square metres; polygon length includes hole boundaries.',provenance:snapshot.provenance};}
  function requireGeometry(snapshot){if(!snapshot?.capabilities?.geometryAnalysis||snapshot.provenance?.spatialEligible===false)throw Error('Original vector geometry is required. Tile fragments cannot be used for spatial analysis.');}
  function spatialGuard(snapshot){requireGeometry(snapshot);if(snapshot.features.length>limits.spatialFeatures||snapshot.provenance.vertexCount>limits.spatialVertices)throw Error('Spatial tools support up to '+limits.spatialFeatures.toLocaleString()+' records and '+limits.spatialVertices.toLocaleString()+' vertices per input. Choose a smaller area.');for(const f of snapshot.features){if(!f.geometry)throw Error('A record has no geometry. Use a source with valid geometry.');if(vertices(f.geometry)>limits.geometryVertices)throw Error('One geometry exceeds '+limits.geometryVertices.toLocaleString()+' vertices. Simplify the original geometry or select another record.');if(turf().booleanValid && !turf().booleanValid(f))throw Error('A record contains invalid geometry. Repair the source before this spatial operation.');}}
  function prop(props,key,value){let name=key;while(Object.prototype.hasOwnProperty.call(props,name))name+='_';props[name]=value;}
  function item(source,geometry,attributes={}){const p=clone(source.properties||{});for(const [key,value] of Object.entries(attributes))prop(p,'analysis_'+key,value);return {type:'Feature',geometry,properties:p,...(source.id===undefined?{}:{id:source.id})};}
  function referenceGuard(reference){if(!reference?.capabilities?.wholeLayer||!reference.features.every(polygon))throw Error('Choose a complete loaded GeoJSON polygon layer as the reference or zones. View-dependent records and tile fragments cannot define complete analysis zones.');spatialGuard(reference);}
  function provenanceFor(snapshot,reference,operation,parameters){const licenses=new Set([...(snapshot.provenance.licenses||[]),...(reference?.provenance.licenses||[])]);return {version:1,operation,parameters,capturedAt:new Date().toISOString(),scope:'derived-from-explicit-snapshots',scopeLabel:'Derived from '+snapshot.provenance.scopeLabel+(reference?' using '+reference.provenance.name:''),spatialEligible:true,geometryQuality:'derived-source-geometry',limited:!!snapshot.provenance.limited||!!reference?.provenance.limited,licenses:Array.from(licenses),lineage:[clone(snapshot.provenance),...(reference?[clone(reference.provenance)]:[])],measurement:'Turf 7.2; geographic measurements use metres / square metres. This browser run is limited to the stated input snapshots.'};}
  async function run(snapshot,operation,options={}){
    spatialGuard(snapshot);const reference=options.reference,t=turf(),features=[],parameters={};let outputVertices=0;abort(options.signal);
    function append(feature){outputVertices+=vertices(feature.geometry);if(outputVertices>limits.vertices||features.length>=limits.features)throw Error('The result exceeds the browser analysis limits. Reduce the inputs.');features.push(feature);}
    const allowed=['buffer','clip','intersect','filter','aggregate','centroid','measure'];if(!allowed.includes(operation))throw Error('Unknown spatial operation.');
    if(['clip','intersect','filter','aggregate'].includes(operation)){referenceGuard(reference);if(snapshot.features.length*reference.features.length>limits.pairs)throw Error('This operation exceeds '+limits.pairs.toLocaleString()+' feature pairs. Reduce the inputs.');}
    if(operation==='buffer'){const d=number(options.distance);if(d===null||d<=0||d>100000)throw Error('Enter a buffer distance greater than 0 and up to 100,000 metres.');parameters.distance_m=d;}
    if(operation==='filter'){parameters.predicate=options.predicate==='representative-point'?'representative-point':'intersects';}
    const boxes=reference?.features.map(f=>extentOf([f]));let mask=null;
    if(operation==='clip'){
      if(reference.features.length>100||reference.provenance.vertexCount>20000)throw Error('Clip masks support up to 100 polygons and 20,000 vertices. Use a smaller zone layer.');
      mask=reference.features.length===1?reference.features[0]:t.union(t.featureCollection(reference.features));if(!mask)throw Error('The clipping mask is empty.');parameters.mask='Union of reference polygons; overlapping masks do not duplicate results.';
    }
    if(operation==='aggregate'){
      parameters.count_rule='Each input record intersecting a zone is counted once in that zone. A record may contribute to overlapping zones.';parameters.area_rule='Sum of per-record polygon intersection areas; overlapping input records may overlap. Points and lines contribute zero area.';
      const sourceBoxes=snapshot.features.map(f=>extentOf([f]));
      for(let z=0;z<reference.features.length;z++){
        abort(options.signal);const zone=reference.features[z];let count=0,area=0,polygons=0,points=0,lines=0;
        for(let i=0;i<snapshot.features.length;i++){
          const f=snapshot.features[i];if(boxesIntersect(sourceBoxes[i],boxes[z])&&t.booleanIntersects(f,zone)){
            count++;if(polygon(f)){polygons++;const clipped=t.intersect(t.featureCollection([f,zone]));if(clipped)area+=t.area(clipped);}else if(['Point','MultiPoint'].includes(f.geometry.type))points++;else lines++;
          }
          if(i%16===15){abort(options.signal);options.onProgress?.(z*snapshot.features.length+i+1,reference.features.length*snapshot.features.length);await tick();}
        }
        append(item(zone,clone(zone.geometry),{record_count:count,polygon_count:polygons,point_record_count:points,line_record_count:lines,intersection_area_m2:area}));await tick();
      }
    }else for(let i=0;i<snapshot.features.length;i++){
      abort(options.signal);const f=snapshot.features[i];
      if(operation==='buffer'){const buffered=t.buffer(f,parameters.distance_m,{units:'meters',steps:8});if(!buffered)throw Error('A buffer could not be constructed. Check the input geometry.');append(item(f,buffered.geometry,{buffer_m:parameters.distance_m}));}
      else if(operation==='centroid')append(item(f,t.centroid(f).geometry,{method:'vertex centroid; may lie outside a concave polygon'}));
      else if(operation==='measure')append(item(f,clone(f.geometry),{area_m2:geometryValue(f,'$area_m2'),length_m:geometryValue(f,'$length_m')}));
      else if(operation==='clip'){if(!polygon(f))throw Error('Clip supports polygon inputs. Use spatial selection to retain points or lines.');const clipped=t.intersect(t.featureCollection([f,mask]));if(clipped)append(item(f,clipped.geometry));}
      else if(operation==='intersect'){
        if(!polygon(f))throw Error('Intersection overlay supports polygon inputs.');const box=extentOf([f]);
        for(let z=0;z<reference.features.length;z++){if(boxesIntersect(box,boxes[z])){const clipped=t.intersect(t.featureCollection([f,reference.features[z]]));if(clipped)append(item(f,clipped.geometry,{zone_index:z+1,zone_properties:clone(reference.features[z].properties)}));}if(z%16===15){abort(options.signal);await tick();}}
        parameters.output_rule='One output for each intersecting input/zone pair. Overlapping reference zones may produce overlapping outputs.';
      }else if(operation==='filter'){
        const candidate=parameters.predicate==='representative-point'?t.pointOnFeature(f):f,box=extentOf([candidate]);
        for(let z=0;z<reference.features.length;z++){if(boxesIntersect(box,boxes[z]) && (parameters.predicate==='representative-point'?t.booleanPointInPolygon(candidate,reference.features[z]):t.booleanIntersects(candidate,reference.features[z]))){append(item(f,clone(f.geometry)));break;}if(z%32===31){abort(options.signal);await tick();}}
      }
      if(features.length>limits.features)throw Error('The result exceeds '+limits.features.toLocaleString()+' records. Reduce the inputs.');
      if(i%16===15){options.onProgress?.(i+1,snapshot.features.length);await tick();}
    }
    const provenance=provenanceFor(snapshot,reference,operation,parameters);provenance.featureCount=features.length;provenance.vertexCount=outputVertices;provenance.extent=extentOf(features);
    return {type:'FeatureCollection',name:operation+' — '+snapshot.provenance.name,features,provenance,analysis:{operation,parameters,createdAt:provenance.capturedAt,inputRecords:snapshot.features.length,outputRecords:features.length,referenceRecords:reference?.features.length||0}};
  }
  async function overview(snapshot,options={}){
    if(!snapshot?.features)throw Error('Choose some data first.');
    if(snapshot.capabilities.attributePreview)return {kind:'display-preview',records:null,fragments:snapshot.features.length,polygonRecords:null,height:null,area:null,provenance:snapshot.provenance};
    const heightField=snapshot.provenance.autoHeight===false?null:options.heightField||snapshot.provenance.heightField||['height_m','height','render_height'].find(k=>snapshot.fields.includes(k))||null;
    const heights=[],areas=[],coverage={recorded:0,missing:0,unknown:0};let polygonRecords=0;
    for(let i=0;i<snapshot.features.length;i++){
      abort(options.signal);const f=snapshot.features[i],p=f.properties||{},v=heightField?number(p[heightField]):null;
      heights.push(v!==null&&v>0?v:null);
      if(polygon(f)){polygonRecords++;areas.push(geometryValue(f,'$area_m2'));}
      if(p.height_missing===true)coverage.missing++;else if(p.height_missing===false)coverage.recorded++;else coverage.unknown++;
      if(i%128===127){options.onProgress?.(i+1,snapshot.features.length);await tick();}
    }
    const height=heightField?{field:heightField,...summarize(heights),basis:snapshot.provenance.heightBasis||null}:null;
    return {kind:snapshot.provenance.featureRole==='buildings'?'buildings':'features',records:snapshot.features.length,polygonRecords,height,area:areas.length?{...summarize(areas),units:'m2',overlapRule:'Per-feature areas are added; overlapping polygons may overlap.'}:null,lidarInputCoverage:coverage,provenance:snapshot.provenance};
  }
  async function scatter(snapshot,xField,yField,options={}){
    const xs=await valuesAsync(snapshot,xField,options),ys=await valuesAsync(snapshot,yField,options),pairs=[];
    let meanX=0,meanY=0,m2x=0,m2y=0,cov=0,xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    for(let i=0;i<xs.length;i++){
      abort(options.signal);const x=number(xs[i]),y=number(ys[i]);if(x===null||y===null)continue;
      const n=pairs.length+1,dx=x-meanX,dy=y-meanY;meanX+=dx/n;meanY+=dy/n;m2x+=dx*(x-meanX);m2y+=dy*(y-meanY);cov+=dx*(y-meanY);
      xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);pairs.push({x,y});
      if(i%256===255)await tick();
    }
    if(!pairs.length)throw Error('No records have values for both fields. Choose another pair of fields.');
    const maxPoints=Math.max(100,Math.min(5000,Math.floor(number(options.maxPoints)||3000))),points=pairs.length<=maxPoints?pairs:pairs.filter((_,i)=>Math.floor(i*maxPoints/pairs.length)!==Math.floor((i-1)*maxPoints/pairs.length));
    const correlation=m2x>0&&m2y>0?Math.max(-1,Math.min(1,cov/Math.sqrt(m2x)/Math.sqrt(m2y))):null;
    if(![meanX,meanY,m2x,m2y,cov,xmin,xmax,ymin,ymax].every(Number.isFinite))throw Error('Values exceed the supported chart range.');
    return {kind:'scatter',xField,yField,valid:pairs.length,missing:snapshot.features.length-pairs.length,pairs,points,drawn:points.length,sampled:points.length<pairs.length,sampling:'Evenly spaced records in source order; plot sampling only. Counts and correlation use all valid records.',correlation,range:{xmin,xmax,ymin,ymax},provenance:snapshot.provenance};
  }
  async function groupedStatistics(snapshot,groupField,valueField,options={}){
    const input=await valuesAsync(snapshot,valueField,options),groups=new Map(),maximum=Math.max(2,Math.min(25,Math.floor(number(options.maxGroups)||12)));
    for(let i=0;i<snapshot.features.length;i++){
      abort(options.signal);const value=snapshot.features[i].properties?.[groupField],key=value===null||value===undefined?'missing':JSON.stringify([typeof value,value]),label=value===null||value===undefined?'Not provided':value===''?'Empty string':typeof value==='object'?JSON.stringify(value):String(value);
      if(!groups.has(key))groups.set(key,{label,values:[]});groups.get(key).values.push(input[i]);
      if(i%256===255)await tick();
    }
    const rows=Array.from(groups.values()).sort((a,b)=>b.values.length-a.values.length||a.label.localeCompare(b.label));
    if(rows.length>maximum){const other=rows.splice(maximum-1);rows.push({label:'Other categories ('+other.length+')',values:other.flatMap(g=>g.values)});}
    return {kind:'grouped',groupField,valueField,rows:rows.map(g=>({label:g.label,...summarize(g.values)})),provenance:snapshot.provenance};
  }
  root.PortalAnalysisData={limits,capabilities,isBuildingLayer,capture,captureStudyArea,sourceGeoJSON,numericFields,values,valuesAsync,summarize,frequencies,histogram,measure,run,number,vertices,overview,scatter,groupedStatistics};
})(globalThis);
