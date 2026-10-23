/* Phase 1 provider. Every feature and value below is synthetic.
   Phase 2: replace PortalData.load() with a release-manifest-backed provider.
   Preserve real source attributes and nulls; do not reuse demo values. */
(function () {
  'use strict';
  function createDemo() {
    var features = [], index = 0;
    var origin = [-77.0702, 38.9059];
    for (var blockY = 0; blockY < 4; blockY++) {
      for (var blockX = 0; blockX < 5; blockX++) {
        for (var row = 0; row < 2; row++) {
          for (var col = 0; col < 6; col++) {
            index++;
            var x = origin[0] + blockX * 0.00225 + col * 0.000265;
            var y = origin[1] + blockY * 0.0017 + row * 0.00055;
            var w = 0.00018 + (index % 3) * 0.00002;
            var h = 0.00030 + (index % 4) * 0.000025;
            var cut = index % 7 === 0 ? w * 0.36 : 0;
            var ring = [[x,y],[x+w,y],[x+w,y+h-cut],[x+w-cut,y+h-cut],[x+w-cut,y+h],[x,y+h],[x,y]];
            features.push({type:'Feature', id:'DEMO-'+String(index).padStart(3,'0'), geometry:{type:'Polygon',coordinates:[ring]}, properties:{building_id:'DEMO-'+String(index).padStart(3,'0'),data_status:'synthetic_demo',synthetic:true,demo_modified:index%9===0,demo_height_m:6+(index*7)%33,demo_area_m2:Math.round(w*111320*Math.cos(y*Math.PI/180)*h*111320),source:'procedurally_generated_demo',release:'interface-prototype-v0.1'}});
          }
        }
      }
    }
    return {type:'FeatureCollection',name:'Synthetic demonstration — not USBF observations',features:features};
  }
  window.PortalData = {
    mode:'demo',
    async load() { return createDemo(); },
    connections:{footprints:null,heights:null,lod2:null},
    releasePolicy:'Use accepted, published release manifests; exclude production workspaces and experimental candidates from current data.'
  };
})();
