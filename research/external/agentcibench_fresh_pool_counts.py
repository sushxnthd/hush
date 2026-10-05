#!/usr/bin/env python3
import argparse, hashlib, json
from collections import Counter, defaultdict
from pathlib import Path

DEV_SEED=20261005
DEV_PER_MODE=60

def stable_bucket(text:str)->int:
    return int(hashlib.sha256((str(DEV_SEED)+'|'+text).encode()).hexdigest()[:16],16)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--source-dir',type=Path,required=True); ap.add_argument('--old-holdout-dir',type=Path,required=True); a=ap.parse_args()
    old={p.stem for p in a.old_holdout_dir.glob('*.json') if p.name!='manifest.json'}
    groups=defaultdict(list)
    raws=[]
    for p in a.source_dir.glob('*.json'):
        if p.name=='manifest.json': continue
        r=json.loads(p.read_text(encoding='utf-8')); sid=str(r.get('scenario_id') or p.stem)
        gt=r.get('ground_truth') or {}
        if sid in old or not r.get('task_prompt') or not isinstance(r.get('initial_states'),dict) or not gt.get('must_share') or not gt.get('must_not_share'): continue
        mode=str(r.get('failure_mode') or r.get('scenario_family') or 'unknown')
        groups[mode].append((stable_bucket(sid),sid)); raws.append((sid,mode))
    dev=set()
    for mode,xs in groups.items():
        xs.sort(key=lambda x:x[0]); dev.update(sid for _,sid in xs[:DEV_PER_MODE])
    remaining=Counter(mode for sid,mode in raws if sid not in dev)
    print('eligible_before_dev='+json.dumps({m:len(v) for m,v in sorted(groups.items())},sort_keys=True))
    print('dev_selected='+str(len(dev)))
    print('old_holdout='+str(len(old)))
    print('remaining_after_all_exclusions='+json.dumps(dict(sorted(remaining.items())),sort_keys=True))

if __name__=='__main__': main()
