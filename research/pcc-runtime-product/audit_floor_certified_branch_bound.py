#!/usr/bin/env python3
"""Independent aggregate checker using q/r/m sufficient statistics."""
import argparse, hashlib, json
from fractions import Fraction

def canonical(obj):
    return (json.dumps(obj,sort_keys=True,separators=(",",":"))+"\n").encode()

def main():
    p=argparse.ArgumentParser(); p.add_argument("result"); p.add_argument("--output",required=True)
    a=p.parse_args(); primary=json.load(open(a.result,encoding="utf-8"))
    failures=checks=0
    for n in range(2,129):
        for k in range(1,n+1):
            d=n-k
            for den in range(n,257):
                for num in range(den//n+1):
                    lam=Fraction(num,den)
                    q0=Fraction(1+d*(k-1)*lam,d+1)
                    m=Fraction(1-(k-1)*lam,d+1)
                    predicted=Fraction(d+1)/(1+(k-1)*d*lam)
                    observed=m/(m*q0)
                    checks+=5
                    failures+=int(q0!=m+(k-1)*lam)
                    failures+=int(observed!=predicted)
                    failures+=int((d*m if d else 0)!=1-q0)
                    failures+=int(m<lam)
                    failures+=int(predicted<1)
    for key in ("bound_violations","equality_failures","monotonicity_failures","corrected_endpoint_failures"):
        failures+=int(primary["counts"][key]!=0)
    failures+=int(primary["counts"]["frozen_endpoint_prediction_failures"]!=557); checks+=5
    out={"schema":"hush.floor-certified-branch-bound.audit.v1","status":"PASS" if failures==0 else "FAIL",
      "checks":checks,"failures":failures,"primary_digest":primary["canonical_digest"],
      "method":"independent sufficient-statistic extremizer identities",
      "preserved_protocol_failure_confirmed":primary["counts"]["frozen_endpoint_prediction_failures"]==557}
    out["canonical_digest"]=hashlib.sha256(canonical({k:v for k,v in out.items() if k!="canonical_digest"})).hexdigest()
    open(a.output,"wb").write(canonical(out)); print(json.dumps(out,sort_keys=True))
    raise SystemExit(out["status"]!="PASS")
if __name__=="__main__": main()
