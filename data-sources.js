/* Original-data connections share one contract, independent of map renderers.
   Remote geometry enters analysis only through an explicit saved study area. */
(function(root){
 'use strict';
 const providers=Object.freeze({
  'usbf':{providerId:'usbf',format:'GeoParquet',browserLoad:true,nativeLoad:true},
  'gba-usa':{providerId:'gba-usa',format:'GeoParquet',browserLoad:true,nativeLoad:true,releaseId:'2025-09'},
  'dc-government':{providerId:'dc-government',format:'GeoJSON · API',browserLoad:true,nativeLoad:true},
  'nyc-government':{providerId:'nyc-government',format:'GeoJSON · API',browserLoad:true,nativeLoad:true},
  'osm-buildings':{providerId:'osm-buildings',format:'GeoParquet',browserLoad:false,nativeLoad:true,originalLink:'https://layercake.openstreetmap.us/layers/buildings/'},
  'overture-buildings':{providerId:'overture-buildings',format:'GeoParquet',browserLoad:false,nativeLoad:true,originalLink:'https://docs.overturemaps.org/getting-data/cloud-sources/'}
 });
 function describe(layer){
  const cfg=layer?.cfg||layer||{},id=cfg.driver==='usbf'?'usbf':cfg.id,definition=providers[id];
  if(cfg.nativeSource)return {kind:'native-result',providerId:null,format:cfg.nativeSource.format||'GeoParquet',browserLoad:false,nativeLoad:true,originalAvailable:true,releaseId:cfg.nativeSource.release?.releaseId||null};
  if(definition){
   let releaseId=definition.releaseId||null;
   if(id==='overture-buildings'){
    releaseId=cfg.analysisSource?.releaseId||String(cfg.url||'').match(/\/tiles\/(\d{4}-\d{2}-\d{2}\.\d+)\//)?.[1]||null;
    if(!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(releaseId||''))return {...definition,kind:'provider',releaseId:null,nativeLoad:false,originalAvailable:false,reason:'This display has no matching original-data release. Reopen it from Add Data.'};
   }
   return {...definition,kind:'provider',releaseId,originalAvailable:true,policy:releaseId?'release':'latest'};
  }
  const capability=root.PortalAnalysisData?.capabilities(layer)||{};
  const fixed=cfg.type==='geojson'&&capability.geometryAnalysis&&!layer?.data?.provenance?.workspaceArea;
  return {kind:fixed?'workset':'display',providerId:null,format:root.PortalLayerPurpose?.format(layer)||cfg.sourceFormat||cfg.type||'Data',browserLoad:Boolean(fixed),nativeLoad:Boolean(fixed),originalAvailable:Boolean(fixed),releaseId:null,reason:fixed?'':'This preview has no automatic original-data connection. Use the provider’s original records or import a regional extract.'};
 }
 function runtime(layer){
  const source=describe(layer),engine=root.PortalNativeEngine?.status?.()||{},nativeProviders=engine.information?.capabilities?.originalDataProviders||[];
  const nativeAdapter=source.kind!=='provider'||source.providerId==='usbf'||Array.isArray(nativeProviders)&&nativeProviders.includes(source.providerId);
  return {...source,connected:Boolean(engine.connected),nativeReady:Boolean(source.nativeLoad&&engine.supported!==false&&engine.connected&&nativeAdapter),nativeAdapter,reason:!source.nativeLoad?source.reason||'This provider has no native original-data adapter yet. Use its bounded browser adapter or a regional file in Files.':engine.supported===false?'This source requires the local engine on a desktop computer.':!engine.connected?'Connect the local engine in Files & device':!nativeAdapter?'Update the local engine to load original records from this provider.':source.reason||''};
 }
 function providerInput(layer){
  const source=runtime(layer);
  if(source.kind!=='provider'||source.providerId==='usbf'||!source.nativeLoad)throw Error('This provider has no native original-data adapter yet. Use its bounded browser adapter or a regional file in Files.');
  if(!source.nativeReady)throw Error(source.reason);
  return {kind:'provider',providerId:source.providerId,...(source.releaseId?{releaseId:source.releaseId}:{})};
 }
 root.PortalDataSources={providers,describe,runtime,providerInput};
})(globalThis);
