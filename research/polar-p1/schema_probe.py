#!/usr/bin/env python3
import hashlib, json, os, pathlib, re, urllib.request

URL='https://huggingface.co/datasets/Qiaoyuan/POLAR-Bench/resolve/main/data/privacy_benchmark_rendered_repaired.json?download=true'
OUT=pathlib.Path(os.environ.get('POLAR_FILE','/tmp/polar.json'))

req=urllib.request.Request(URL,method='GET')
with urllib.request.urlopen(req, timeout=180) as r, OUT.open('wb') as f:
    print('repo_commit='+str(r.headers.get('x-repo-commit') or r.headers.get('X-Repo-Commit') or 'unknown'))
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

def walk(v,p='',depth=0,paths=None,block=True):
    if paths is None: paths={}
    if depth>5: return paths
    if isinstance(v,dict):
        for k,x in v.items():
            q=f'{p}.{k}' if p else k
            paths.setdefault(q,set()).add(type(x).__name__)
            if not (block and BLOCK_RE.search(k)): walk(x,q,depth+1,paths,block=block)
    elif isinstance(v,list):
        q=f'{p}[]'
        if v:
            paths.setdefault(q,set()).add(type(v[0]).__name__)
            if not isinstance(v[0],(str,int,float,bool,type(None))): walk(v[0],q,depth+1,paths,block=block)
        else:
            paths.setdefault(q,set()).add('empty')
    return paths

paths={}
for rec in records[:min(25,len(records))]: walk(rec,paths=paths,block=True)
print('SCHEMA_PATHS_BEGIN')
for p in sorted(paths): print(p+':'+','.join(sorted(paths[p])))
print('SCHEMA_PATHS_END')

# Scoring schema only: keys/types/length ranges, never target values.
score_paths={}
score_lengths={}
for rec in records:
    s=rec.get('scoring_targets') if isinstance(rec,dict) else None
    if s is None: continue
    walk(s,p='scoring_targets',paths=score_paths,block=False)
    def lengths(v,p='scoring_targets',depth=0):
        if depth>5: return
        if isinstance(v,dict):
            for k,x in v.items(): lengths(x,f'{p}.{k}',depth+1)
        elif isinstance(v,list):
            score_lengths.setdefault(p,[]).append(len(v))
            if v and not isinstance(v[0],(str,int,float,bool,type(None))): lengths(v[0],p+'[]',depth+1)
    lengths(s)
print('SCORING_SCHEMA_BEGIN')
for p in sorted(score_paths): print(p+':'+','.join(sorted(score_paths[p])))
for p in sorted(score_lengths):
    vals=score_lengths[p]
    print(f'{p}#len:min={min(vals)},max={max(vals)}')
print('SCORING_SCHEMA_END')

# Aggregate benchmark metadata enums only; never source/policy/task/scoring contents.
meta={}
def collect_meta(v,p=''):
    if isinstance(v,dict):
        for k,x in v.items():
            q=f'{p}.{k}' if p else k
            if BLOCK_RE.search(k): continue
            leaf=k.lower()
            if isinstance(x,(str,int,float,bool)) and leaf in {'domain','privacy_level','privacy_type','attack_strength','attack_type','document_form','task_type'}:
                meta.setdefault(q,set()).add(str(x))
            elif isinstance(x,dict): collect_meta(x,q)
for rec in records: collect_meta(rec)
print('METADATA_ENUMS_BEGIN')
for k in sorted(meta):
    vals=sorted(meta[k])
    print(k+'='+json.dumps(vals,ensure_ascii=True) if len(vals)<=50 else k+'=<'+str(len(vals))+' distinct values>')
print('METADATA_ENUMS_END')
