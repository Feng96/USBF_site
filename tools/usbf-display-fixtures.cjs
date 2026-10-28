/* Synthetic acceptance data only. Never publish these bytes as actual buildings. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {buildPMTiles}=require('./pmtiles-fixtures.cjs');
const namespace='https://data.source.coop/opengeos/us-buildings/';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),copy=value=>JSON.parse(JSON.stringify(value));
function boundsOf(feature){const points=[];function walk(c){if(typeof c[0]==='number')points.push(c);else c.forEach(walk);}walk(feature.geometry.coordinates);return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
function createFixtures(options={}){
 const directory=options.directory||process.env.PORTAL_USBF_BROWSER_FIXTURE||'/lustre/isaac24/scratch/yfeng21/us_buildings_portal_20261028/usbf_analysis_fixtures_20261028/single';
 const sidecar=options.sidecar||JSON.parse(fs.readFileSync(path.join(directory,'fixtures.json'),'utf8')),features=sidecar.near?.features||sidecar.features,feature=options.feature||features?.[0];
 if(!feature||features?.length!==1)throw Error('Use the test-only single-courtyard fixture containing exactly one original building.');
 const tileInfo=sidecar.tile,parquetPath=options.parquetPath||path.join(directory,tileInfo.path),parquet=fs.readFileSync(parquetPath),properties=feature.properties||{},cx=properties.cx,cy=properties.cy;
 if(typeof properties.usbf_id!=='string'||!Number.isFinite(cx)||!Number.isFinite(cy)||feature.geometry.type!=='Polygon')throw Error('The browser fixture needs an original polygon with stable usbf_id and cx/cy.');
 if(tileInfo.sha256!==sha(parquet)||tileInfo.bytes!==parquet.length||tileInfo.rows!==1)throw Error('The Parquet sidecar does not match the original bytes.');
 const footprint=boundsOf(feature),half=Math.max(Math.min(footprint[2]-footprint[0],footprint[3]-footprint[1])*.16,.00001),ring=[[cx-half,cy-half],[cx+half,cy-half],[cx+half,cy+half],[cx-half,cy+half],[cx-half,cy-half]],tileProperties={usbf_id:properties.usbf_id,cx,cy,height_m:properties.height_m,source:properties.source,modified:properties.modified,height_missing:properties.height_missing,height_incomplete:properties.height_incomplete,name:'SYNTHETIC QA courtyard — not real building data'};
 const pmtiles=buildPMTiles({sourceLayer:'usbf',properties:tileProperties,ring,lng:cx,lat:cy,z:16}),updated='2026-10-28T12:00:00Z',release={name:'USBF_v1',updated,buildings:1,tiles:1},displayPath='USBF_display/releases/test-only-synthetic-courtyard.pmtiles';
 const display={schema_version:1,type:'pmtiles',url:namespace+displayPath,sha256:sha(pmtiles.archive),source_layer:'usbf',source_release:release,input_buildings:1,bounds:pmtiles.bounds,minzoom:16,maxzoom:16,fields:Object.keys(tileProperties),description:'SYNTHETIC ACCEPTANCE FIXTURE ONLY. Never publish as actual building data.'};
 const publication={release:'USBF_v1',updated_utc:updated,layout:'flat_half_degree_geographic_tiles',crs:'EPSG:4326',tile_degrees:.5,scope:'CONUS48+DC',tiles:1,buildings:1,files:[copy(tileInfo)],description:display.description};
 return {directory,sidecar,feature:copy(feature),bounds:sidecar.near.bounds,center:[cx,cy],parquet,parquetPath,pmtiles,display,publication,displayPath,parquetURL:namespace+'USBF_v1/'+tileInfo.path,namespace};
}
async function installRoutes(page,fixtures){
 const state={geoRequests:[],tileRequests:[],manifestRequests:[],holdRaw:false,failManifest:false,held:[]},cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'Range, If-Match','access-control-expose-headers':'Content-Range, Accept-Ranges, ETag, Content-Length','cache-control':'no-store'};
 function rangeResponse(request,body,etag,type){
  const value=request.headers().range;if(!value)return {status:200,contentType:type,headers:{...cors,etag,'accept-ranges':'bytes','content-length':String(body.length)},body};
  const match=/^bytes=(\d+)-(\d*)$/.exec(value);if(!match)return {status:416,headers:{...cors,'content-range':'bytes */'+body.length},body:''};
  const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):body.length-1,body.length-1);if(start>=body.length||end<start)return {status:416,headers:{...cors,'content-range':'bytes */'+body.length},body:''};
  return {status:206,contentType:type,headers:{...cors,etag,'accept-ranges':'bytes','content-range':'bytes '+start+'-'+end+'/'+body.length,'content-length':String(end-start+1)},body:body.subarray(start,end+1)};
 }
 const handler=async route=>{
  const request=route.request(),url=new URL(request.url());if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(url.pathname.endsWith('/USBF_display/manifest.json')||url.pathname.endsWith('/USBF_v1/manifest.json')){
   state.manifestRequests.push(url.href);if(state.failManifest)return route.fulfill({status:503,headers:cors,body:'Synthetic temporary publication failure'});
   return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(url.pathname.includes('/USBF_display/')?fixtures.display:fixtures.publication)});
  }
  if(url.pathname.endsWith('/'+fixtures.displayPath)){
   state.tileRequests.push({url:url.href,range:request.headers().range});return route.fulfill(rangeResponse(request,fixtures.pmtiles.archive,'"'+fixtures.display.sha256+'"','application/vnd.pmtiles'));
  }
  if(url.origin+decodeURIComponent(url.pathname)===fixtures.parquetURL){
   state.geoRequests.push({url:url.href,range:request.headers().range});if(state.holdRaw)await new Promise(resolve=>state.held.push(resolve));
   try{return await route.fulfill(rangeResponse(request,fixtures.parquet,'"'+fixtures.publication.files[0].sha256+'"','application/vnd.apache.parquet'));}catch(error){if(!/closed|disposed|handled|aborted|cancelled/i.test(error.message))throw error;return;}
  }
  return route.fulfill({status:404,headers:cors,body:'No synthetic acceptance fixture at this path'});
 };
 await page.route(namespace+'**',handler);
 state.releaseHeld=()=>{state.holdRaw=false;for(const release of state.held.splice(0))release();};
 state.dispose=async()=>{state.releaseHeld();await page.unroute(namespace+'**',handler);};
 return state;
}
module.exports={createFixtures,installRoutes,boundsOf,namespace};
