#!/usr/bin/env python3
import hashlib, json, os, pathlib, re, urllib.request

URL='https://huggingface.co/datasets/Qiaoyuan/POLAR-Bench/resolve/main/data/privacy_benchmark_rendered_repaired.json?download=true'
OUT=pathlib.Path(os.environ.get('POLAR_FILE','/tmp/polar.json'))

with urllib.request.urlopen(URL, timeout=180) as r, OUT.open('wb') as f:
    while True:
        chunk=r.read(1024*1024)
        if not chunk: break
        f.write(chunk)
raw=OUT.read_bytes()
print('sha256='+hashlib.sha256(raw).hexdigest())
print('bytes='+str(len(raw)))
obj=json.loads(raw)

if isinstance(obj,list): records=obj
elif isinstance(obj,dict):
    candidates=[v for v in obj.values() if isinstance(v,list) and v and isinstance(v[0],dict)]
    records=max(candidates,key=len) if candidates else [obj]
else: raise SystemExit('Unsupported top-level JSON type')
print('records='+str(len(records)))

BLOCK_RE=re.compile(r'(scoring|target|allowed_values|do_not_disclose|gold|answer|protected_attributes|task_attributes)',re.I)
META_RE=re.compile(r'^(domain|policy(_level|_dimension|_type)?|privacy(_level|_dimension|_type)?|attack(_strategy|_type)?|strategy|source_format|format)$',re.I)

def walk(v,p='',depth=0,paths=None):
    if paths is None: paths={}
    if depth>4: return paths
    if isinstance(v,dict):
        for k,x in v.items():
            q=f'{p}.{k}' if p else k
            paths.setdefault(q,set()).add(type(x).__name__)
            if not BLOCK_RE.search(k): walk(x,q,depth+1,paths)
    elif isinstance(v,list) and v:
        q=f'{p}[]'
        paths.setdefault(q,set()).add(type(v[0]).__name__)
        if not isinstance(v[0],(str,int,float,bool,type(None))) and not BLOCK_RE.search(p): walk(v[0],q,depth+1,paths)
    return paths

paths={}
for rec in records[:min(25,len(records))]: walk(rec,paths=paths)
print('SCHEMA_PATHS_BEGIN')
for p in sorted(paths):
    print(p+':'+','.join(sorted(paths[p])))
print('SCHEMA_PATHS_END')

# Aggregate only benchmark metadata enums; never print source/policy/task text or scoring values.
meta={}
for rec in records:
    if not isinstance(rec,dict): continue
    for k,v in rec.items():
        if BLOCK_RE.search(k): continue
        if META_RE.match(k) and isinstance(v,(str,int,float,bool)):
            meta.setdefault(k,set()).add(str(v))
print('METADATA_ENUMS_BEGIN')
for k in sorted(meta):
    vals=sorted(meta[k])
    if len(vals)<=50: print(k+'='+json.dumps(vals,ensure_ascii=True))
    else: print(k+'=<'+str(len(vals))+' distinct values>')
print('METADATA_ENUMS_END')
