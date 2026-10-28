/* Render identifiers stay separate from the original dataset and its record IDs. */
(function(root){
  'use strict';
  let next=0;
  function prepare(layer,data){
    if(!data||data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('A vector layer needs a FeatureCollection.');
    const lookup=new Map(),originals=new WeakSet();
    const features=data.features.map(feature=>{
      if(next>=Number.MAX_SAFE_INTEGER)throw Error('Reload the map before adding more data.');
      const id=++next;lookup.set(id,feature);originals.add(feature);
      return {...feature,id};
    });
    layer.sourceRecords=originals;layer.renderRecords=lookup;layer.data=data;
    return {...data,features};
  }
  function resolve(layer,feature){
    if(!layer||!feature)return null;
    if(layer.sourceRecords?.has(feature))return feature;
    if(feature.source===layer.id&&layer.renderRecords){
      // IDs never repeat within this page. A late tile from an older dataset
      // cannot resolve to a different row after a viewport or publication update.
      return layer.renderRecords.get(feature.id)||null;
    }
    return feature;
  }
  root.PortalSourceFeatures={prepare,resolve};
})(globalThis);
