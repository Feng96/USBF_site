/* Chart-image source metadata survives an actual PNG encode/decode structure. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {buildPMTiles}=require('./pmtiles-fixtures.cjs'),root=path.resolve(__dirname,'..'),checks=[];
const context={console,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,setTimeout,clearTimeout,document:{addEventListener(){},getElementById(){return null;}},localStorage:{getItem(){return null;},setItem(){}}};
context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'analysis-ui.js'),'utf8'),context);
const A=context.PortalAnalysis,ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
function crc32(data){let crc=0xffffffff;for(const value of data){crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunks(bytes){const b=Buffer.from(bytes),out=[];for(let offset=8;offset<b.length;){const length=b.readUInt32BE(offset),end=offset+length+12;assert(end<=b.length);const type=b.toString('ascii',offset+4,offset+8),data=b.subarray(offset+8,offset+8+length);assert.strictEqual(b.readUInt32BE(end-4),crc32(b.subarray(offset+4,end-4)));out.push({type,data});offset=end;}return out;}
ok(crc32(Buffer.from('123456789'))===0xcbf43926,'PNG CRC verification matches the standard CRC-32 control value');
const original=buildPMTiles({kind:'raster'}).tile,metadata={chart:{kind:'scatter',xField:'area_m2',yField:'height_m'},provenance:{name:'美国建筑 & footprints',scope:'loaded-view',featureRole:'buildings',featureCount:3,limited:true,licenses:['ODbL 1.0','CC BY-NC 4.0'],release:{updated:'2026-10-28T05:00:00Z'}}};
const output=A.pngWithMetadata(new Uint8Array(original),metadata),before=chunks(original),after=chunks(output);
ok(after[after.length-1]?.type==='IEND'&&after.filter(c=>c.type==='iTXt').length===1,'Chart provenance is inserted as a valid PNG international-text chunk before IEND');
ok(Buffer.from(output).subarray(0,8).equals(original.subarray(0,8))&&Buffer.concat(after.filter(c=>c.type==='IDAT').map(c=>c.data)).equals(Buffer.concat(before.filter(c=>c.type==='IDAT').map(c=>c.data))),'Adding source metadata preserves the PNG signature and every compressed image pixel');
const text=after.find(c=>c.type==='iTXt').data,separator=text.indexOf(0),parsed=JSON.parse(new TextDecoder().decode(text.subarray(separator+5)));
ok(text.subarray(0,separator).toString()==='US Buildings source'&&text[separator+1]===0,'The PNG metadata uses an uncompressed UTF-8 international text field');
ok(parsed.provenance.name===metadata.provenance.name&&parsed.provenance.licenses.length===2&&parsed.provenance.limited&&parsed.provenance.release.updated===metadata.provenance.release.updated,'PNG exports retain Unicode source names, component licenses, partial scope and publication time');
ok(A.fieldLabel('$area_m2').includes('m²')&&A.fieldLabel('$length_m').includes('m'),'Calculated geometry fields keep explicit physical units');
assert.throws(()=>A.pngWithMetadata(new Uint8Array([1,2,3]),metadata),/encoded/);ok(true,'Invalid image bytes cannot be presented as a successful chart PNG');
const report={passed:true,checks};if(process.env.PORTAL_QA_OUTPUT){fs.mkdirSync(process.env.PORTAL_QA_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.PORTAL_QA_OUTPUT,'analysis-export.json'),JSON.stringify(report,null,2));}console.log(JSON.stringify({passed:true,checks:checks.length}));
