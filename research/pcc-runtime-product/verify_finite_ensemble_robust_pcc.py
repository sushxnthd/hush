#!/usr/bin/env python3
"""Frozen FER-PCC structured-prior evaluation."""

import argparse, hashlib, json, math, platform
from pathlib import Path

NS=(8,16,32); BUDGETS=(0.0,.25,.5,1.0,2.0,4.0); FLOOR=1e-9

def norm(xs):
    ys=[max(FLOOR,float(x)) for x in xs]; s=sum(ys); return [x/s for x in ys]

def gaussian(n,c,s): return norm([math.exp(-.5*((i-c)/s)**2) for i in range(n)])

def families(n):
    gauss=[gaussian(n,f*(n-1),.16*n) for f in (.25,.375,.5,.625,.75)]
    z=[-1+2*i/(n-1) for i in range(n)]
    expo=[norm([math.exp(a*x) for x in z]) for a in (-1,-.5,0,.5,1)]
    left=gaussian(n,.25*(n-1),.10*n); right=gaussian(n,.75*(n-1),.10*n)
    mix=[norm([w*a+(1-w)*b for a,b in zip(left,right)]) for w in (.1,.3,.5,.7,.9)]
    return {"translated_gaussian":gauss,"exponential_tilt":expo,"two_mode_mixture":mix}

def tightness_control():
    from fractions import Fraction
    R=2; N=3; M=Fraction(1,6); x=Fraction(1,144)
    h=[x]*4+[M]+[Fraction(23,144)]*3+[Fraction(47,1152)]*8
    kinds=[0]*3+[1]+[0]*4+[1]*8
    p=[v/Fraction(R) if k==0 else v*R for v,k in zip(h,kinds)]
    return [[float(v) for v in h],[float(v) for v in p]]

def branches(n): return [tuple(range(a,b+1)) for a in range(n) for b in range(a,n) if not (a==0 and b==n-1)]

def raw_l(prior,B):
    q=sum(prior[i] for i in B); return math.log2(max(prior[i] for i in B)/(max(prior)*q))

def charge(prior,B): return max(0.0,raw_l(prior,B))

def rho_of(P,h): return max(max(max(p[i]/h[i],h[i]/p[i]) for i in range(len(h))) for p in P)

def evaluate(name,n,P):
    h=P[len(P)//2]; rho=rho_of(P,h); out={x:{str(b):{"false_safe":0,"false_deny":0,"correct_allow":0} for b in BUDGETS} for x in ("cardinality","nominal","universal","ensemble")}
    safety={"ensemble_shortfall":0,"universal_shortfall":0}; branch_count=0
    for B in branches(n):
        branch_count+=1
        truths=[charge(p,B) for p in P]
        e=max(truths); u=max(0.0,raw_l(h,B)+3*math.log2(rho)); nominal=charge(h,B); cardinality=math.log2(n/len(B))
        safety["ensemble_shortfall"]+=sum(t>e+1e-12 for t in truths)
        safety["universal_shortfall"]+=sum(t>u+1e-12 for t in truths)
        for t in truths:
            for budget in BUDGETS:
                for policy,val in (("cardinality",cardinality),("nominal",nominal),("universal",u),("ensemble",e)):
                    allow=val<=budget+1e-12; oracle=t<=budget+1e-12; cell=out[policy][str(budget)]
                    cell["false_safe"]+=int(allow and not oracle); cell["false_deny"]+=int(not allow and oracle); cell["correct_allow"]+=int(allow and oracle)
    return {"name":name,"n":n,"members":len(P),"branches":branch_count,"rho":rho,"safety":safety,"decisions":out}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--output",required=True); a=ap.parse_args()
    configs=[]
    for n in NS:
        for name,P in families(n).items(): configs.append(evaluate(name,n,P))
    configs.append(evaluate("adversarial_tightness_control",16,tightness_control()))
    summary={}
    for fam in ("translated_gaussian","exponential_tilt","two_mode_mixture","adversarial_tightness_control"):
        rows=[x for x in configs if x["name"]==fam]
        s={p:{"false_safe":0,"false_deny":0,"correct_allow":0} for p in ("cardinality","nominal","universal","ensemble")}
        for row in rows:
            for p in s:
                for b in BUDGETS:
                    for k in s[p]: s[p][k]+=row["decisions"][p][str(b)][k]
        u=s["universal"]["false_deny"]; e=s["ensemble"]["false_deny"]
        summary[fam]={"policies":s,"false_deny_reduction_vs_universal":(u-e)/u if u else 0.0}
    structured=("translated_gaussian","exponential_tilt","two_mode_mixture")
    gates={
      "positive_normalized":all(all(abs(sum(p)-1)<1e-12 and min(p)>0 for p in P) for n in NS for P in families(n).values()),
      "ensemble_upper":sum(x["safety"]["ensemble_shortfall"] for x in configs)==0,
      "universal_upper":sum(x["safety"]["universal_shortfall"] for x in configs)==0,
      "ensemble_zero_false_safe":all(summary[f]["policies"]["ensemble"]["false_safe"]==0 for f in summary),
      "universal_zero_false_safe":all(summary[f]["policies"]["universal"]["false_safe"]==0 for f in summary),
      "strict_reduction_each_structured":all(summary[f]["policies"]["ensemble"]["false_deny"]<summary[f]["policies"]["universal"]["false_deny"] for f in structured),
      "thirty_percent_two_families":sum(summary[f]["false_deny_reduction_vs_universal"]>=.30 for f in structured)>=2,
    }
    payload={"schema":"hush.fer-pcc.v1","created_at_utc":"2026-10-13T03:55:00Z","python":platform.python_version(),"budgets_bits":list(BUDGETS),"configs":configs,"summary":summary,"gates":gates,"status":"PASS" if all(gates.values()) else "FAIL"}
    canon=json.dumps(payload,sort_keys=True,separators=(",",":")).encode(); payload["canonical_payload_sha256"]=hashlib.sha256(canon).hexdigest(); data=(json.dumps(payload,sort_keys=True,indent=2)+"\n").encode(); Path(a.output).write_bytes(data)
    print(json.dumps({"status":payload["status"],"sha256":hashlib.sha256(data).hexdigest(),"canonical":payload["canonical_payload_sha256"],"reductions":{f:summary[f]["false_deny_reduction_vs_universal"] for f in summary}},sort_keys=True))

if __name__=="__main__": main()
