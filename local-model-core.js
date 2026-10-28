/* Validation shared by local 3D import and non-browser acceptance checks. */
(function(){
 'use strict';
 const maxBytes=32*1024*1024,maxTriangles=150000;
 function placement(input){const out={anchor:[Number(input.lng),Number(input.lat)],altitude:Number(input.altitude),scale:Number(input.scale),heading:Number(input.heading),up:input.up,units:input.units};if(!out.anchor.every(Number.isFinite)||Math.abs(out.anchor[0])>180||Math.abs(out.anchor[1])>85)throw Error('Enter a valid longitude and latitude.');if(!Number.isFinite(out.altitude)||Math.abs(out.altitude)>12000||!Number.isFinite(out.scale)||out.scale<=0||out.scale>10000||!Number.isFinite(out.heading))throw Error('Check elevation, heading and positive scale.');if(!['y','z'].includes(out.up)||!['metres','feet'].includes(out.units))throw Error('Choose the model units and up axis.');return out;}
 function validateOBJ(text){let vertices=0,triangles=0;const rows=text.split(/\r?\n/);for(const row of rows){const parts=row.trim().split(/\s+/);if(parts[0]==='v'){if(parts.length<4||!parts.slice(1,4).every(v=>Number.isFinite(Number(v))&&Math.abs(Number(v))<1e8))throw Error('The OBJ contains an invalid vertex.');if(++vertices>450000)throw Error('The model has too many vertices.');}if(parts[0]==='f'){if(parts.length<4)throw Error('The OBJ contains an invalid face.');triangles+=parts.length-3;if(triangles>maxTriangles)throw Error('Use a model with at most 150,000 triangles.');for(const p of parts.slice(1)){const i=Number(p.split('/')[0]);if(!Number.isInteger(i)||i===0||Math.abs(i)>450000)throw Error('The OBJ contains an invalid face index.');}}}if(!vertices||!triangles)throw Error('The OBJ must contain vertices and polygon faces.');for(const row of rows){const parts=row.trim().split(/\s+/);if(parts[0]==='f'&&parts.slice(1).some(p=>Math.abs(Number(p.split('/')[0]))>vertices))throw Error('An OBJ face points outside its vertex array.');}return {vertices,triangles};}
 function validateGLB(buffer){const guard=globalThis.PortalModelAssetGuard;if(!guard)throw Error('Model checks could not load. Reload the page and try again.');return guard.validateGLB(buffer);}
 function placedOBJ(meshes,options={}){
  if(!Array.isArray(meshes)||!meshes.length)throw Error('This model has no mesh to download.');
  const altitude=Number(options.altitude||0);if(!Number.isFinite(altitude))throw Error('The model elevation is invalid.');
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],rows=['# US Buildings placed model','# Coordinates: local metres; x east, y north, z up. See location.json.','# Geometry includes unit, axis, scale, rotation and elevation settings.'];let vertices=0,triangles=0;
  for(let index=0;index<meshes.length;index++){
   const mesh=meshes[index],p=mesh.positions,m=mesh.matrix||identity;if(!p||p.length%3||!Array.from(m).every(Number.isFinite)||m.length!==16||m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)throw Error('A mesh has invalid coordinates or a non-affine transform.');
   const count=p.length/3,ids=mesh.indices||Array.from({length:count},(_,i)=>i);if(!count||ids.length%3)throw Error('Only triangle meshes can be downloaded.');if(vertices+count>450000||triangles+ids.length/3>maxTriangles)throw Error('This model is too large to download as OBJ.');
   rows.push('o '+String(mesh.name||'part-'+(index+1)).replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,80));
   for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2],point=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]+altitude];if(!point.every(Number.isFinite))throw Error('A mesh contains an invalid vertex.');rows.push('v '+point.map(v=>Number(v.toPrecision(12))).join(' '));}
   for(let i=0;i<ids.length;i+=3){const face=[ids[i],ids[i+1],ids[i+2]];if(!face.every(v=>Number.isSafeInteger(v)&&v>=0&&v<count))throw Error('A model face points outside its vertex array.');rows.push('f '+face.map(v=>v+vertices+1).join(' '));}
   vertices+=count;triangles+=ids.length/3;
  }
  return {text:rows.join('\n')+'\n',vertices,triangles};
 }
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 function zipFiles(files,date=new Date()){
  if(!Array.isArray(files)||!files.length||files.length>20)throw Error('Choose a small set of model files.');const encoder=new TextEncoder(),locals=[],central=[];let offset=0,total=0;
  const year=Math.max(1980,Math.min(2107,date.getUTCFullYear())),dosDate=(year-1980)<<9|(date.getUTCMonth()+1)<<5|date.getUTCDate(),dosTime=date.getUTCHours()<<11|date.getUTCMinutes()<<5|Math.floor(date.getUTCSeconds()/2);
  const names=new Set();for(const file of files){const name=String(file.name||'');if(!name||/[\\/\0]/.test(name)||name==='.'||name==='..'||names.has(name))throw Error('A download filename is invalid.');names.add(name);const n=encoder.encode(name),data=typeof file.data==='string'?encoder.encode(file.data):file.data instanceof Uint8Array?file.data:new Uint8Array(file.data);total+=data.byteLength;if(total>64*1024*1024||n.length>65535)throw Error('The model download is too large.');const crc=crc32(data),local=new Uint8Array(30+n.length),a=new DataView(local.buffer);a.setUint32(0,0x04034b50,true);a.setUint16(4,20,true);a.setUint16(6,0x0800,true);a.setUint16(10,dosTime,true);a.setUint16(12,dosDate,true);a.setUint32(14,crc,true);a.setUint32(18,data.length,true);a.setUint32(22,data.length,true);a.setUint16(26,n.length,true);local.set(n,30);locals.push(local,data);
   const entry=new Uint8Array(46+n.length),b=new DataView(entry.buffer);b.setUint32(0,0x02014b50,true);b.setUint16(4,20,true);b.setUint16(6,20,true);b.setUint16(8,0x0800,true);b.setUint16(12,dosTime,true);b.setUint16(14,dosDate,true);b.setUint32(16,crc,true);b.setUint32(20,data.length,true);b.setUint32(24,data.length,true);b.setUint16(28,n.length,true);b.setUint32(42,offset,true);entry.set(n,46);central.push(entry);offset+=local.length+data.length;
  }
  const directorySize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,directorySize,true);e.setUint32(16,offset,true);const out=new Uint8Array(offset+directorySize+end.length);let cursor=0;for(const chunk of [...locals,...central,end]){out.set(chunk,cursor);cursor+=chunk.length;}return out;
 }
 globalThis.PortalLocalModelCore={maxBytes,maxTriangles,placement,validateOBJ,validateGLB,placedOBJ,crc32,zipFiles};
})();
