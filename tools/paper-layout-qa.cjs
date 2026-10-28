/* Readable physical paper type and unabridged source-page contracts. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),context={console,Date,Map,Set,JSON,Number,String,Array,Math,Error,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'map-paper.js'),'utf8'),context);const P=context.PortalMapPaper,checks=[],fixtures=[];
const ok=(v,n)=>{assert(v,n);checks.push(n);console.log('PASS',n);},near=(a,b,t=1e-6)=>Math.abs(a-b)<t;
const jpeg=cp.execFileSync('python3',['-c',`from PIL import Image,ImageDraw
import sys
im=Image.new('RGB',(600,400),'white');d=ImageDraw.Draw(im)
d.rectangle((0,0,299,199),fill=(205,55,50));d.rectangle((300,0,599,199),fill=(35,145,80))
d.rectangle((0,200,299,399),fill=(45,90,195));d.rectangle((300,200,599,399),fill=(230,190,35))
im.save(sys.stdout.buffer,format='JPEG',quality=95)`]);
const metadata={title:'Washington DC buildings',subtitle:'Building footprints and available heights',createdAt:'2026-10-28T06:15:00.000Z',placeName:'Washington, DC',camera:{displayCRS:'EPSG:3857',center:[-77.071,38.912],bounds:[-77.08,38.90,-77.06,38.92],bearing:-20,pitch:0},capture:{partial:false},decorations:{legend:true,north:true,scale:true,scaleSample:{groundMetres:50,widthFraction:.2,approximate:false}},sources:{basemaps:[{name:'Reference',attribution:'Esri, HERE, Garmin, USGS'}],layers:[{name:'USBF footprints',attribution:'USBF / opengeos · © 2026 source creators',licenses:['ODbL 1.0','CC BY-NC 4.0'],style:{color:'#287f76'},source:'https://source.coop/opengeos/us-buildings',release:{updated:'2026-10-27T22:25:21Z'}}],localModels:[]}};
ok(near(P.textWidth('WWWW',8),.944*4*8),'Text wrapping uses real standard-font widths in points');
ok(P.wrapText('ABCD'.repeat(80),120,8).every(line=>P.textWidth(line,8)<=120+.001),'Long URLs and unspaced source notes wrap without shrinking text');
const longWord='https://source.example.test/'+('abc0123456789'.repeat(70));ok(P.wrapText(longWord,220,8).join('')===longWord,'Wrapping retains every character of a long original source URL');
for(const paper of ['letter','a4','a3'])for(const orientation of ['portrait','landscape']){
 const options={paper,orientation,margin:12},result=P.makePDFBytes(new Uint8Array(jpeg),600,400,metadata,options),layout=result.layout;
 ok(layout.fontSizes.title===18&&layout.fontSizes.body===9&&layout.fontSizes.sources===8,'Paper typography keeps 18/9/8 point sizes: '+paper+' '+orientation);
 ok(near(layout.mapFrame.width/layout.mapFrame.height,1.5)&&layout.mapFrame.x>=layout.paper.marginPt-1e-7&&layout.mapFrame.y>=layout.paper.marginPt,'The map fits the remaining frame without stretching: '+paper+' '+orientation);
 const texts=layout.pages.flatMap(p=>p.texts);ok(texts.every(line=>line.size>=8&&line.x>=0&&line.y>0&&line.y<layout.paper.heightPt)&&texts.some(t=>t.text.includes('CC BY-NC')),'Readable source rights remain inside the paper: '+paper+' '+orientation);
 fixtures.push({name:'paper-'+paper+'-'+orientation+'.pdf',bytes:Buffer.from(result.bytes),page:result.page,layout,metadata});
}
const longMeta=JSON.parse(JSON.stringify(metadata));longMeta.title='Building data comparison';longMeta.sources.layers=Array.from({length:11},(_,i)=>({name:'Dataset '+(i+1),attribution:('Creator '+(i+1)+' retains copyright. ').repeat(18)+'Final license clause '+i+'.',licenses:['CC BY-NC 4.0; preserve attribution and noncommercial terms'],source:'https://source.example.test/data/'+i+'/'+('quadkey'.repeat(30)),style:{color:'#287f76'}}));
let result=P.makePDFBytes(new Uint8Array(jpeg),600,400,longMeta,{paper:'letter',orientation:'landscape',margin:12});ok(result.layout.pages.length>2&&result.page.sourceAppendix,'Long source credits receive additional pages instead of tiny type');
const all=result.layout.pages.flatMap(p=>p.texts).map(t=>t.text).join('').replace(/\s/g,'');ok(longMeta.sources.layers.every(l=>all.includes(l.attribution.replace(/\s/g,''))&&all.includes(l.source.replace(/\s/g,''))),'Every complete source credit and URL survives the source-page layout');
ok(result.layout.pages.slice(1).every(p=>p.texts.filter(t=>t.text!=='Data sources').every(t=>t.size>=8)),'Source pages never reduce copyright or license text below eight points');fixtures.push({name:'paper-long-sources.pdf',bytes:Buffer.from(result.bytes),page:result.page,layout:result.layout,metadata:longMeta});
result=P.makePDFBytes(new Uint8Array(jpeg),600,400,longMeta,{paper:'a4',orientation:'portrait',margin:0});ok(result.layout.pages.flatMap(p=>p.texts).every(t=>t.y<result.page.heightPt),'Page numbers and long source notes stay on paper even at zero margins');
const unicode=JSON.parse(JSON.stringify(metadata));unicode.title='美国建筑';const planned=P.plan(unicode,{},600,400);ok(planned.fallback.some(t=>t.text==='美国建筑'&&t.size===18),'Unicode titles retain their original text and physical size for image fallback');
const partial=JSON.parse(JSON.stringify(metadata));partial.capture.partial=true;partial.sources.layers[0].limited=true;partial.sources.locator={visible:true,source:'U.S. Census Bureau',quality:'Approximate street address location'};const partialPlan=P.plan(partial,{},600,400);ok(partialPlan.pages[0].texts.some(t=>t.text.includes('unavailable'))&&partialPlan.pages[0].texts.some(t=>t.text.includes('not loaded'))&&partialPlan.pages[0].texts.some(t=>t.text.includes('approximate street')),'Partial data and approximate address markers keep a readable explanation on the map page');
assert.throws(()=>P.plan(metadata,{margin:41},600,400),/margin/);ok(true,'Invalid margins fail with a paper-specific action message');
if(process.env.PORTAL_QA_OUTPUT){const dir=process.env.PORTAL_QA_OUTPUT;fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'map-fixture.jpg'),jpeg);for(const f of fixtures)fs.writeFileSync(path.join(dir,f.name),f.bytes);fs.writeFileSync(path.join(dir,'paper-layout.json'),JSON.stringify({passed:true,checks,fixtures:fixtures.map(({bytes,...f})=>f)},null,2));}
console.log(JSON.stringify({passed:true,checks:checks.length,documents:fixtures.length}));
