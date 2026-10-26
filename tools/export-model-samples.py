"""Export a small, provenance-bound display collection. Never modifies experiments."""
import argparse,json,gzip,hashlib,math
from pathlib import Path
import numpy as np
from pyproj import Transformer
p=argparse.ArgumentParser();p.add_argument('--us-viewer',required=True);p.add_argument('--us-summary',required=True);p.add_argument('--teachers-root',required=True);p.add_argument('--output',required=True);args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def dump(name,d):
 b=json.dumps(d,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode();(out/name).write_bytes(b);return hashlib.sha256(b).hexdigest()
index={'schema':1,'collections':[{'id':'us-experiment','name':'US LoD2 experiments','location':'Georgetown, Washington, DC','kind':'Experimental reconstruction','count':8,'description':'Eight real US cases. Shared-input reconstruction and refinement comparison; independent roof accuracy has not been established.','attribution':'Yinan Feng · NAIP / USGS 3DEP / GBA-derived input footprints','url':'https://feng96.github.io/research-daily/lod2/paper/'},{'id':'training-reference','name':'3DBAG training roofs','location':'10 cities · Netherlands','kind':'Training reference','count':20,'description':'A small sample from the actual frozen training roster. Automatic reference roof surfaces, not US production models or independent roof ground truth.','attribution':'3DBAG by 3D geoinformation research group & 3DGI · CC BY 4.0','url':'https://docs.3dbag.nl/en/copyright/'}],'models':[]}
def add_model(d):
 name=d['id'].replace('.','_').replace(':','_')+'.json';s=dump(name,d)
 index['models'].append({k:d[k] for k in ['id','label','collection','city','center','bounds','footprint','source','kind','height_m','height_basis']})
 index['models'][-1].update(file=name,sha256=s,methods=list(d['methods']))
us=json.loads(gzip.decompress(Path(args.us_viewer).read_bytes()));summary=json.loads(Path(args.us_summary).read_text());rows={r['id']:r for r in summary['rows'] if r['block']=='guarded'}
for b in us['buildings']:
 methods={}
 for k,g in b['groups'].items():
  q=rows[b['id']]['methods'][k]['quality'];methods[k]={'name':{'initial':'Shared initial reconstruction','paper':'Image-line refinement · adaptation','ours':'DL-assisted local candidate'}[k],'positions':g['positions'],'edges':g['edges'],'roof_edges':g.get('roofEdges',g['edges']),'roof_mask':g['roofTriangleMask'],'roof_count':g['roofCount'],'edge_check_passed':q['passed'],'certified_solid':False,'accuracy_verified':False,'geometry_audit':g['geometryAudit']}
 pos=np.array(methods['initial']['positions']).reshape(-1,3);heights=pos[:,2]+b.get('displayOffsetZ',0)
 add_model({'id':b['id'],'label':b['shortId'],'collection':'us-experiment','city':'Washington, DC','center':b['center'],'bounds':b['bounds'],'anchor':us['anchor'],'display_offset_z':b.get('displayOffsetZ',0),'footprint':b['footprintGeometryLngLat'],'source':'NAIP 2014 + USGS 3DEP 2014; GBA-derived footprint','kind':'Experimental LoD2','height_m':float(heights.max()-heights.min()),'height_basis':'Displayed initial model vertical extent; not an independently measured building height','methods':methods,'provenance':{'viewer_sha256':sha(args.us_viewer),'summary_sha256':sha(args.us_summary),'input_setting':'guarded','model_date':'2026-10-22','observation_year':2014,'local_axes':us['localAxes'],'native_ground_z_m':{k:g['nativeGroundZ'] for k,g in b['groups'].items()},'source_url':'https://feng96.github.io/research-daily/lod2/paper/','independent_ground_truth':False},'notes':'Research candidates; edge checks are not accuracy certification. Geometry is displayed with the existing experiment ground offset. No identity match to a VIDA feature is asserted.'})
root=Path(args.teachers_root);manifest=json.loads((root/'teacher_data/manifest.json').read_text());subsets=json.loads((root/'teacher_data/subsets.json').read_text());ids=set(subsets['subsets']['train_20000']);xy=Transformer.from_crs(28992,4326,always_xy=True);merc=Transformer.from_crs(28992,3857,always_xy=True)
selected=[]
for city in manifest['train_cities']:
 records=sorted((r for r in manifest['records'] if r['split']=='train' and r['city']==city and r['id'] in ids),key=lambda r:r['id'])
 selected.extend([records[0],next(r for r in records if r['plane_count']>=5 and r['id']!=records[0]['id'])])
for r in selected:
 path=root/r['mesh_path'];assert sha(path)==r['mesh_sha256'];a=np.load(path);tris=a['triangles_m'];assert np.isfinite(tris).all();cx,cy=r['center'];lng,lat=xy.transform(cx,cy);ax,ay=merc.transform(cx,cy);cos=math.cos(math.radians(lat));x,y=merc.transform(tris[:,:,0],tris[:,:,1]);z=tris[:,:,2]-r['ground_m'];positions=np.stack(((x-ax)*cos,(y-ay)*cos,z),axis=-1).reshape(-1).tolist()
 # Preserve all source triangles and their holes. Lines are actual triangle edges.
 edges=tris[:,[0,1,1,2,2,0],:];ex,ey=merc.transform(edges[:,:,0],edges[:,:,1]);ez=edges[:,:,2]-r['ground_m'];edgepositions=np.stack(((ex-ax)*cos,(ey-ay)*cos,ez),axis=-1).reshape(-1).tolist()
 rings=[]
 for ring in r['footprint']['coordinates']:
  lx,ly=xy.transform(*zip(*ring));rings.append(list(map(list,zip(lx,ly))))
 flat=[c for ring in rings for c in ring];bounds=[[min(x[0] for x in flat),min(x[1] for x in flat)],[max(x[0] for x in flat),max(x[1] for x in flat)]]
 methods={'reference':{'name':'Frozen training roof reference','positions':positions,'edges':edgepositions,'roof_mask':[True]*len(tris),'roof_count':r['source_roof_faces'],'edge_check_passed':None,'certified_solid':False,'accuracy_verified':False}}
 add_model({'id':r['id'],'label':r['id'].split('.')[-1],'collection':'training-reference','city':r['city'],'center':[lng,lat],'bounds':bounds,'anchor':[lng,lat],'display_offset_z':0,'footprint':{'type':'Polygon','coordinates':rings},'source':'3DBAG automatic reconstruction · actual training roster','kind':'Training roof reference','height_m':float(z.max()),'height_basis':'Highest sampled roof Z minus recorded b3_h_maaiveld ground, metres','methods':methods,'provenance':{'source_crs':'EPSG:7415','source_mesh_sha256':r['mesh_sha256'],'source_response_sha256':r['response_sha256'],'training_manifest_sha256':sha(root/'teacher_data/manifest.json'),'split':'train','included_in_train_20000':True,'ahn_year':r['source_ahn_year'],'license':manifest['source_license'],'source_url':'https://api.3dbag.nl/collections/pand/items/'+r['id'],'native_ground_z_m':r['ground_m'],'original_roof_triangles_m':tris.tolist(),'independent_ground_truth':False,'display_transform':'RD New XY to Web Mercator, scaled to local metres at anchor latitude; NAP Z minus recorded ground'},'notes':'Roof surfaces only: these are the exact triangles used for training, not complete closed buildings. No new reconstruction or training was performed.'})
assert len(index['models'])==28
index['selection']='Eight existing US cases; two actual training-roster examples per source city, selected by ID and plane count, not model performance.'
dump('manifest.json',index)
print(json.dumps({'models':len(index['models']),'files':len(list(out.glob('*.json'))),'bytes':sum(p.stat().st_size for p in out.glob('*.json'))}))
