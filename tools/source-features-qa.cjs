const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../source-features.js'),'utf8'),ctx);
const A=ctx.PortalSourceFeatures,checks=[];
const ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);};
const feature=(id,x)=>({type:'Feature',...(id===undefined?{}:{id}),properties:null,geometry:{type:'Polygon',coordinates:[[[x,39],[x+.002,39],[x+.002,39.002],[x,39.002],[x,39]]]}});
const data={type:'FeatureCollection',name:'Original source',provenance:{scope:'whole-layer'},features:[feature(undefined,-77),feature(7,-76),feature(7,-75)]},before=JSON.stringify(data),l={id:'layer-1'};
const rendered=A.prepare(l,data);
ok(l.data===data&&JSON.stringify(data)===before,'Render preparation leaves original IDs, null attributes, geometry and provenance unchanged');
ok(new Set(rendered.features.map(f=>f.id)).size===3,'Duplicate or absent source IDs still receive distinct display identities');
for(let i=0;i<3;i++){
 const shown={...rendered.features[i],source:l.id,geometry:{type:'Point',coordinates:[0,0]}};
 ok(A.resolve(l,shown)===data.features[i],'Clipped display record '+i+' resolves to its exact complete original');
}
ok(A.resolve(l,data.features[1])===data.features[1],'Selecting a raw attribute-table row preserves that exact record');
const old={...rendered.features[0],source:l.id},replacement={type:'FeatureCollection',features:[feature(undefined,-74)]},next=A.prepare(l,replacement);
ok(A.resolve(l,old)===null,'A late rendered tile cannot select a new row after the layer data changes');
ok(next.features[0].id>rendered.features[2].id,'Display identities are never recycled for another dataset generation');
const other={id:'layer-2'},otherDisplay=A.prepare(other,data);
ok(A.resolve(other,{...otherDisplay.features[1],source:other.id})===data.features[1],'Another layer resolves its own original record');
ok(A.resolve(l,{...otherDisplay.features[1],source:l.id})===null,'A display identity from another layer cannot select an unrelated source record');
const tile={id:7,source:'tiles',geometry:{type:'Point',coordinates:[1,2]},properties:{id:7}};
ok(A.resolve({id:'tiles'},tile)===tile,'Display-only tile layers do not gain invented original geometry');
ok(JSON.stringify(data)===before,'All source-feature recovery operations preserve the original export exactly');
console.log(JSON.stringify({passed:true,checks:checks.length}));
