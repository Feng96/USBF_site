/* Tiny synthetic PMTiles v3 files for genuine reader / browser import checks.
 * Reference: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 * No production or third-party dataset is embedded. */
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
const root=path.resolve(__dirname,'..');
const FixtureAbortController=global.AbortController||class{constructor(){this.signal={aborted:false,addEventListener(){},removeEventListener(){}};}abort(){this.signal.aborted=true;}};
function library(){const context={console,TextDecoder,TextEncoder,ArrayBuffer,DataView,Uint8Array,Map,Set,Promise,Math,Buffer,AbortController:FixtureAbortController};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'vendor/pmtiles-4.3.0.js'),'utf8'),context);return context.pmtiles;}
function varint(value){let n=BigInt(value),out=[];if(n<0n)throw Error('Negative unsigned varint.');do{let v=Number(n&127n);n>>=7n;if(n)v|=128;out.push(v);}while(n);return Buffer.from(out);}
const vi=(field,value)=>Buffer.concat([varint(field<<3),varint(value)]);
const bytes=(field,value)=>{const b=Buffer.isBuffer(value)?value:Buffer.from(value);return Buffer.concat([varint((field<<3)|2),varint(b.length),b]);};
function mvtTile(){
 const value12=Buffer.alloc(9);value12[0]=(3<<3)|1;value12.writeDoubleLE(12,1);
 const geometry=Buffer.concat([9,3800,3800,26,600,0,0,600,599,0,15].map(varint)),tags=Buffer.concat([0,0,1,1,2,2].map(varint));
 const feature=Buffer.concat([vi(1,1),bytes(2,tags),vi(3,3),bytes(4,geometry)]),layer=Buffer.concat([vi(15,2),bytes(1,'fixture-buildings'),bytes(2,feature),bytes(3,'height_m'),bytes(3,'name'),bytes(3,'source'),bytes(4,value12),bytes(4,bytes(1,'Synthetic QA building')),bytes(4,bytes(1,'synthetic_fixture')),vi(5,4096)]);
 return bytes(3,layer);
}
function crc32(buffer){let crc=0xffffffff;for(const value of buffer){crc^=value;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function pngChunk(name,data){const n=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([n,data])));return Buffer.concat([len,n,data,crc]);}
function pngTile(size=256){const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;const scanlines=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=y*(size*4+1)+1+x*4;scanlines[p]=40+((x>>5)&1)*55;scanlines[p+1]=120+((y>>5)&1)*40;scanlines[p+2]=150;scanlines[p+3]=210;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',zlib.deflateSync(scanlines)),pngChunk('IEND',Buffer.alloc(0))]);}
function tileCoordinate(lng,lat,z){const n=2**z,x=Math.floor((lng+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);return {z,x,y};}
function tileBounds({z,x,y}){const n=2**z,lat=row=>Math.atan(Math.sinh(Math.PI*(1-2*row/n)))*180/Math.PI;return [x/n*360-180,lat(y+1),(x+1)/n*360-180,lat(y)];}
function buildPMTiles(options={}){
 const kind=options.kind||'vector',pmtiles=library(),coordinate=tileCoordinate(options.lng??-77.071,options.lat??38.912,options.z??16),bbox=tileBounds(coordinate),tile=kind==='raster'?pngTile():mvtTile(),tileId=pmtiles.zxyToTileId(coordinate.z,coordinate.x,coordinate.y);
 const directory=Buffer.concat([varint(1),varint(tileId),varint(1),varint(tile.length),varint(1)]),metadata={name:'Synthetic QA '+kind,description:'Generated test fixture; not real building data.',attribution:'Synthetic QA fixture',format:kind==='raster'?'png':'pbf',...(kind==='vector'?{vector_layers:[{id:'fixture-buildings',fields:{height_m:'Number',name:'String',source:'String'},minzoom:coordinate.z,maxzoom:coordinate.z}]}:{tileSize:256})},meta=Buffer.from(JSON.stringify(metadata)),tileDataOffset=Math.max(options.tileDataOffset||65536,127+directory.length+meta.length),header=Buffer.alloc(127);
 header.write('PMTiles',0);header[7]=3;const uint64=(offset,value)=>header.writeBigUInt64LE(BigInt(value),offset);
 uint64(8,127);uint64(16,directory.length);uint64(24,127+directory.length);uint64(32,meta.length);uint64(40,0);uint64(48,0);uint64(56,tileDataOffset);uint64(64,tile.length);uint64(72,1);uint64(80,1);uint64(88,1);
 header[96]=1;header[97]=1;header[98]=1;header[99]=kind==='raster'?2:1;header[100]=coordinate.z;header[101]=coordinate.z;for(let i=0;i<4;i++)header.writeInt32LE(Math.round(bbox[i]*1e7),102+i*4);header[118]=coordinate.z;header.writeInt32LE(Math.round((bbox[0]+bbox[2])/2*1e7),119);header.writeInt32LE(Math.round((bbox[1]+bbox[3])/2*1e7),123);
 const archive=Buffer.alloc(tileDataOffset+tile.length);header.copy(archive);directory.copy(archive,127);meta.copy(archive,127+directory.length);tile.copy(archive,tileDataOffset);
 return {archive,tile,metadata,coordinate,bounds:bbox,center:[(bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2],tileDataOffset};
}
function writeFixtures(output){fs.mkdirSync(output,{recursive:true});const index={description:'Synthetic test data only',files:[]};for(const kind of ['vector','raster']){const f=buildPMTiles({kind}),name='local-'+kind+'.pmtiles';fs.writeFileSync(path.join(output,name),f.archive);fs.writeFileSync(path.join(output,kind==='vector'?'tile.pbf':'tile.png'),f.tile);index.files.push({kind,file:name,bytes:f.archive.length,tileBytes:f.tile.length,sourceLayer:kind==='vector'?'fixture-buildings':null,coordinate:f.coordinate,bounds:f.bounds,center:f.center});}fs.writeFileSync(path.join(output,'index.json'),JSON.stringify(index,null,2));return index;}
module.exports={buildPMTiles,writeFixtures,library,FixtureAbortController};
if(require.main===module){if(!process.argv[2])throw Error('Provide a scratch output directory.');console.log(JSON.stringify(writeFixtures(process.argv[2]),null,2));}
