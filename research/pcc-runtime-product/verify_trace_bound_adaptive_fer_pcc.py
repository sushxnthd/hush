#!/usr/bin/env python3
import argparse,hashlib,json,math,platform
from pathlib import Path

NS=(16,32,64); BUDGETS=(.25,.5,1.,2.,3.,4.); FLOOR=1e-12
def norm(v):
 v=[max(FLOOR,float(x)) for x in v]; z=sum(v); return [x/z for x in v]
def lap(n,c,s): return norm([math.exp(-abs(i-c)/s) for i in range(n)])
def gauss(n,s): return norm([math.exp(-.5*((i-(n-1)/2)/s)**2) for i in range(n)])
def fams(n):
 return {"laplace_location":[lap(n,f*(n-1),.12*n) for f in (.2,.35,.5,.65,.8)],"power_tilt":[norm([(i+1)**a for i in range(n)]) for a in (-2,-1,0,1,2)],"variance_family":[gauss(n,s*n) for s in (.06,.10,.16,.24,.36)]}
def posterior(p,S):
 z=sum(p[i] for i in S); return [p[i]/z for i in S]
def risk(p,S): return max(0.,math.log2(max(posterior(p,S))/max(p)))
def rawrisk(p,S): return math.log2(max(posterior(p,S))/max(p))
def trace(n,secret,kind,nominal):
 S=list(range(n)); out=[tuple(S)]
 for step in range(5):
  if len(S)<=1: break
  lo,hi=S[0],S[-1]
  if kind=="bisection": cut=(lo+hi)//2
  elif kind=="tercile":
   cut=lo+max(0,len(S)//3-1) if step%2==0 else lo+max(0,math.ceil(2*len(S)/3)-1)
  else:
   weights=posterior(nominal,S); acc=0.; cut=S[-1]
   for i,w in zip(S,weights):
    acc+=w
    if acc>=.5: cut=i; break
  S=[i for i in S if (i<=cut)==(secret<=cut)]
  out.append(tuple(S))
 return out
def rho_post(P,h,S):
 ps=[posterior(p,S) for p in P]; hh=posterior(h,S)
 return max(max(max(a/b,b/a) for a,b in zip(q,hh)) for q in ps)
def evaluate(name,n,P,kind):
 h=P[len(P)//2]; dec={x:{str(b):{"false_safe":0,"false_deny":0} for b in BUDGETS} for x in ("trace_bound","independent_step","cardinality","nominal","universal","static_per_item")}; safety={"trace":0,"independent":0,"dominance":0,"telescoping":0}; strict=0; completed=0; switches=0; switch_opportunities=0; negatives=0; step_events=0
 for secret in range(n):
  sets=trace(n,secret,kind,h); completed+=1
  R=[[risk(p,S) for S in sets] for p in P]; raw=[[rawrisk(p,S) for S in sets] for p in P]
  Aseries=[max(R[i][s] for i in range(len(P)) for s in range(j+1)) for j in range(len(sets))]; A=Aseries[-1]; adelta=[Aseries[j]-Aseries[j-1] for j in range(1,len(Aseries))]; inc=[]; worst=[]
  for j in range(1,len(sets)):
   vals=[max(0.,R[i][j]-R[i][j-1]) for i in range(len(P))]; inc.append(max(vals)); worst.append(max(range(len(vals)),key=lambda i:vals[i])); negatives+=sum(raw[i][j]-raw[i][j-1]<-1e-12 for i in range(len(P))); step_events+=len(P)
  Qseries=[0.];
  for v in inc: Qseries.append(Qseries[-1]+v)
  Q=Qseries[-1]; strict+=int(A<Q-1e-12); switches+=sum(worst[j]!=worst[j-1] for j in range(1,len(worst))); switch_opportunities+=max(0,len(worst)-1)
  safety["trace"]+=sum(any(R[i][j]>Aseries[j]+1e-12 for j in range(len(sets))) for i in range(len(P)))
  safety["independent"]+=sum(any(R[i][j]>Qseries[j]+1e-12 for j in range(len(sets))) for i in range(len(P)))
  safety["dominance"]+=sum(Qseries[j]+1e-12<Aseries[j] for j in range(len(sets))); safety["telescoping"]+=int(abs(sum(adelta)-A)>1e-12 or any(x< -1e-12 for x in adelta))
  cardinality=math.log2(n/len(sets[-1])); nominal=max(risk(h,S) for S in sets); static=max(math.log2(len(sets[j-1])/len(sets[j])) for j in range(1,len(sets))) if len(sets)>1 else 0.
  U=0.
  for j in range(1,len(sets)):
   delta=rawrisk(h,sets[j])-rawrisk(h,sets[j-1]); U+=max(0.,delta+3*math.log2(rho_post(P,h,sets[j-1])))
  policies={"trace_bound":A,"independent_step":Q,"cardinality":cardinality,"nominal":nominal,"universal":U,"static_per_item":static}
  for oracle_row in R:
   oracle=max(oracle_row)
   for b in BUDGETS:
    for pol,val in policies.items():
     allow=val<=b+1e-12; truth=oracle<=b+1e-12; dec[pol][str(b)]["false_safe"]+=int(allow and not truth); dec[pol][str(b)]["false_deny"]+=int(not allow and truth)
 return {"family":name,"n":n,"task":kind,"members":len(P),"traces":completed,"strict_gap_traces":strict,"switch_rate":switches/switch_opportunities if switch_opportunities else 0.,"negative_step_rate":negatives/step_events if step_events else 0.,"safety":safety,"decisions":dec}
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--output",required=True); a=ap.parse_args(); rows=[]
 for n in NS:
  for name,P in fams(n).items():
   for kind in ("bisection","tercile","mode_chasing"): rows.append(evaluate(name,n,P,kind))
 summary={}
 for fam in ("laplace_location","power_tilt","variance_family"):
  rr=[r for r in rows if r["family"]==fam]; traces=sum(r["traces"] for r in rr); strict=sum(r["strict_gap_traces"] for r in rr); policies={p:{"false_safe":0,"false_deny":0} for p in rr[0]["decisions"]}
  for r in rr:
   for p in policies:
    for b in BUDGETS:
     for k in policies[p]: policies[p][k]+=r["decisions"][p][str(b)][k]
  q=policies["independent_step"]["false_deny"]; x=policies["trace_bound"]["false_deny"]
  summary[fam]={"traces":traces,"strict_gap_traces":strict,"strict_gap_rate":strict/traces,"false_deny_reduction_vs_independent":(q-x)/q if q else 0.,"policies":policies,"mean_switch_rate":sum(r["switch_rate"] for r in rr)/len(rr),"mean_negative_step_rate":sum(r["negative_step_rate"] for r in rr)/len(rr)}
 gates={"positive_normalized":all(abs(sum(p)-1)<1e-12 and min(p)>0 for n in NS for P in fams(n).values() for p in P),"trace_prefix_safe":sum(r["safety"]["trace"] for r in rows)==0,"independent_prefix_safe":sum(r["safety"]["independent"] for r in rows)==0,"dominance":sum(r["safety"]["dominance"] for r in rows)==0,"telescoping":sum(r["safety"]["telescoping"] for r in rows)==0,"strict_gap_two_families":sum(summary[f]["strict_gap_rate"]>=.10 for f in summary)>=2,"twenty_percent_two_families":sum(summary[f]["false_deny_reduction_vs_independent"]>=.20 for f in summary)>=2}
 payload={"schema":"hush.trace-bound-fer-pcc.v1","created_at_utc":"2026-10-13T04:55:00Z","python":platform.python_version(),"budgets_bits":list(BUDGETS),"rows":rows,"summary":summary,"gates":gates,"status":"PASS" if all(gates.values()) else "FAIL"}; canon=json.dumps(payload,sort_keys=True,separators=(",",":")).encode(); payload["canonical_payload_sha256"]=hashlib.sha256(canon).hexdigest(); data=(json.dumps(payload,sort_keys=True,indent=2)+"\n").encode(); Path(a.output).write_bytes(data); print(json.dumps({"status":payload["status"],"sha256":hashlib.sha256(data).hexdigest(),"canonical":payload["canonical_payload_sha256"],"summary":{f:{"gap":v["strict_gap_rate"],"reduction":v["false_deny_reduction_vs_independent"]} for f,v in summary.items()}},sort_keys=True))
if __name__=="__main__": main()
