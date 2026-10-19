#!/usr/bin/env python3
import json,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RESULT=ROOT/'research/pcc-runtime-product/observable_fiber_prefix_law_result.json'
OUT=ROOT/'research/pcc-runtime-product/observable_fiber_prefix_law_audit.json'

def schedule(mask,n,t): return [[(mask>>(s*t+i))&1 for i in range(t)] for s in range(n)]
def safe(a,o,t):
 for p in range(1,t+1):
  seen={}
  for ar,ob in zip(a,o):
   key=tuple(ar[:p]); value=tuple(ob[:p])
   if key in seen and seen[key]!=value:return False
   seen[key]=value
 return True
def final_safe(a,o):
 seen={}
 for ar,ob in zip(a,o):
  key=tuple(ar);value=tuple(ob)
  if key in seen and seen[key]!=value:return False
  seen[key]=value
 return True
def future_refines(a,t):
 for p in range(1,t):
  seen={}
  for row in a:
   key=tuple(row[:p]);full=tuple(row)
   if key in seen and seen[key]!=full:return True
   seen[key]=full
 return False

expected=[]
for n in (2,3):
 for t in (1,2,3):
  m=1<<(n*t); counts={'worlds':n,'horizon':t,'total':0,'prefixSafe':0,'finalSafe':0,'finalOnlySafe':0,'prefixButFinalUnsafe':0,'futureRefiningAuthorized':0,'strictAuthorized':0,'boundaryDisagreements':0}
  for ai in range(m):
   a=schedule(ai,n,t);predicts=future_refines(a,t);observed=False;counts['futureRefiningAuthorized']+=predicts
   for oi in range(m):
    o=schedule(oi,n,t);p=safe(a,o,t);f=final_safe(a,o);strict=f and not p;observed|=strict;counts['total']+=1;counts['prefixSafe']+=p;counts['finalSafe']+=f;counts['finalOnlySafe']+=strict;counts['prefixButFinalUnsafe']+=p and not f
   counts['strictAuthorized']+=observed;counts['boundaryDisagreements']+=observed!=predicts
  expected.append(counts)

data=json.loads(RESULT.read_text())
checks={
 'schema':data['schema']=='hush.observable-fiber-prefix-law.v1',
 'all_shape_counts_reproduced':data['shapes']==expected,
 'frozen_total':sum(x['total'] for x in expected)==270672==data['totals']['total'],
 'prefix_implies_final':all(x['prefixButFinalUnsafe']==0 for x in expected),
 'one_step_equivalence':all(x['finalOnlySafe']==0 for x in expected if x['horizon']==1),
 'strict_two_step_gap':next(x for x in expected if x['worlds']==2 and x['horizon']==2)['finalOnlySafe']>0,
 'exact_structural_boundary':all(x['boundaryDisagreements']==0 and x['futureRefiningAuthorized']==x['strictAuthorized'] for x in expected),
 'minimal_witness':data['firstStrict']['worlds']==2 and data['firstStrict']['horizon']==2,
 'five_channels_rejected':len(data['fixtureResults'])==5 and all(not x['fullTraceSafe'] and x['finalAggregateControlSafe'] for x in data['fixtureResults'].values()),
 'gate':data['status']=='PASS_PREFIX_LAW_AND_CHECKER' and all(data['gates'].values())
}
payload={'schema':'hush.observable-fiber-prefix-law.audit.v1','checks':checks,'passed':sum(checks.values()),'total':len(checks),'allPass':all(checks.values())}
OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
print(json.dumps(payload,indent=2,sort_keys=True))
raise SystemExit(0 if payload['allPass'] else 1)
