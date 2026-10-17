#!/usr/bin/env python3
"""Independent FER-PCC result auditor."""
import argparse,json,math,hashlib

def c(p,B):
 q=sum(p[i] for i in B); return max(0.,math.log2(max(p[i] for i in B)/(max(p)*q)))
def nrm(v):
 v=[max(1e-9,x) for x in v]; z=sum(v); return [x/z for x in v]
def fams(n):
 def g(mu,s): return nrm([math.exp(-.5*((i-mu)/s)**2) for i in range(n)])
 A=[g(f*(n-1),.16*n) for f in (.25,.375,.5,.625,.75)]; z=[2*i/(n-1)-1 for i in range(n)]; E=[nrm([math.exp(t*x) for x in z]) for t in (-1,-.5,0,.5,1)]; l=g(.25*(n-1),.1*n); r=g(.75*(n-1),.1*n); M=[nrm([w*x+(1-w)*y for x,y in zip(l,r)]) for w in (.1,.3,.5,.7,.9)]; return {"translated_gaussian":A,"exponential_tilt":E,"two_mode_mixture":M}
def control():
 from fractions import Fraction
 h=[Fraction(1,144)]*4+[Fraction(1,6)]+[Fraction(23,144)]*3+[Fraction(47,1152)]*8; kinds=[0]*3+[1]+[0]*4+[1]*8; p=[v/2 if k==0 else v*2 for v,k in zip(h,kinds)]; return [[float(v) for v in h],[float(v) for v in p]]
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("result"); a=ap.parse_args(); d=json.load(open(a.result)); failures=0; rows=[]; budgets=d["budgets_bits"]
 for cfg in d["configs"]:
  P=control() if cfg["name"]=="adversarial_tightness_control" else fams(cfg["n"])[cfg["name"]]; h=P[len(P)//2]; rho=max(max(max(x/y,y/x) for x,y in zip(p,h)) for p in P); failures+=int(abs(rho-cfg["rho"])>1e-12)
  efs=ufs=0; decisions={x:{str(b):{"false_safe":0,"false_deny":0,"correct_allow":0} for b in budgets} for x in ("cardinality","nominal","universal","ensemble")}
  for lo in range(cfg["n"]):
   for hi in range(lo,cfg["n"]):
    if lo==0 and hi==cfg["n"]-1: continue
    B=range(lo,hi+1); vals=[c(p,B) for p in P]; e=max(vals); raw=math.log2(max(h[i] for i in B)/(max(h)*sum(h[i] for i in B))); u=max(0.,raw+3*math.log2(rho)); nominal=c(h,B); cardinality=math.log2(cfg["n"]/(hi-lo+1)); efs+=sum(t>e+1e-12 for t in vals); ufs+=sum(t>u+1e-12 for t in vals)
    for t in vals:
     for budget in budgets:
      for policy,value in (("cardinality",cardinality),("nominal",nominal),("universal",u),("ensemble",e)):
       allow=value<=budget+1e-12; oracle=t<=budget+1e-12; cell=decisions[policy][str(budget)]; cell["false_safe"]+=int(allow and not oracle); cell["false_deny"]+=int(not allow and oracle); cell["correct_allow"]+=int(allow and oracle)
  failures+=int(efs!=cfg["safety"]["ensemble_shortfall"] or ufs!=cfg["safety"]["universal_shortfall"]); failures+=int(decisions!=cfg["decisions"]); rows.append((cfg["name"],cfg["n"],round(rho,15),efs,ufs,decisions))
 out={"checked_configs":len(rows),"complete_decision_tables_matched":failures==0,"failures":failures,"rows_sha256":hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(",",":")).encode()).hexdigest(),"source_canonical_sha256":d["canonical_payload_sha256"],"status":"PASS" if failures==0 else "FAIL"}; print(json.dumps(out,sort_keys=True,indent=2))
if __name__=="__main__": main()
