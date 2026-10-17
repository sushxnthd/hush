#!/usr/bin/env python3
"""Frozen exhaustive verifier for the floor-certified HUSH branch bound."""
import argparse, hashlib, itertools, json, platform
from fractions import Fraction

def compositions(total, parts):
    if parts == 1:
        yield (total,); return
    for cuts in itertools.combinations(range(total + parts - 1), parts - 1):
        last, out = -1, []
        for cut in cuts + (total + parts - 1,):
            out.append(cut-last-1); last=cut
        yield tuple(out)

def canonical(obj):
    return (json.dumps(obj,sort_keys=True,separators=(",",":"))+"\n").encode()

def run(max_n,max_denominator):
    cases=violations=equality_cases=equality_failures=0
    endpoint_checks=endpoint_failures=frozen_endpoint_prediction_failures=0
    monotonicity_checks=monotonicity_failures=0
    max_residual,per_n=0.0,{}
    for n in range(2,max_n+1):
        n_cases=0
        for den in range(1,max_denominator+1):
            for weights in compositions(den,n):
                global_max=max(weights)
                for k in range(1,n+1):
                    branch=weights[:k]; branch_sum=sum(branch)
                    if branch_sum==0: continue
                    branch_max,floor_max,d=max(branch),min(weights),n-k
                    for floor_num in range(floor_max+1):
                        lhs=branch_max*(den+(k-1)*d*floor_num)
                        rhs=global_max*branch_sum*(d+1)
                        cases+=1; n_cases+=1
                        if lhs>rhs:
                            violations+=1; max_residual=max(max_residual,lhs/rhs-1.0)
        per_n[str(n)]=n_cases
        for k in range(1,n+1):
            d,previous=n-k,None
            for floor_den in range(n,129):
                for floor_num in range(floor_den//n+1):
                    lam=Fraction(floor_num,floor_den)
                    heavy=(Fraction(1)-(k-1)*lam)/(d+1)
                    weights=[heavy]+[lam]*(k-1)+[heavy]*d
                    factor=weights[0]/(sum(weights[:k])*max(weights))
                    expected=Fraction(d+1)/(1+(k-1)*d*lam)
                    equality_cases+=1
                    equality_failures+=int(factor!=expected or sum(weights)!=1 or min(weights)<lam)
                    if floor_num==0:
                        endpoint_checks+=1; endpoint_failures+=int(expected!=d+1)
                    if lam==Fraction(1,n):
                        endpoint_checks+=1
                        frozen_endpoint_prediction_failures+=int(expected!=1)
                        endpoint_failures+=int(expected!=Fraction(n,k))
                    if previous is not None and lam>=previous[0]:
                        monotonicity_checks+=1
                        monotonicity_failures+=int(expected>previous[1] and lam>previous[0])
                    previous=(lam,expected)
    result={"schema":"hush.floor-certified-branch-bound.v1","protocol_status":"FAIL",
      "theorem_status":"PASS" if not(violations or equality_failures or monotonicity_failures or endpoint_failures) else "FAIL",
      "parameters":{"max_n":max_n,"max_denominator":max_denominator,"extremizer_max_n":128},
      "counts":{"exhaustive_cases":cases,"bound_violations":violations,"equality_cases":equality_cases,
       "equality_failures":equality_failures,"endpoint_checks":endpoint_checks,
       "corrected_endpoint_failures":endpoint_failures,
       "frozen_endpoint_prediction_failures":frozen_endpoint_prediction_failures,
       "monotonicity_checks":monotonicity_checks,"monotonicity_failures":monotonicity_failures},
      "max_relative_violation":max_residual,"per_n_cases":per_n,
      "environment":{"python":platform.python_version(),"implementation":platform.python_implementation()},
      "claim":"factor <= (n-k+1)/(1+(k-1)(n-k)lambda), with equality at the frozen construction",
      "preserved_failure":"preregistered uniform-endpoint factor 1 is false; exact factor is n/k"}
    result["canonical_digest"]=hashlib.sha256(canonical({k:v for k,v in result.items() if k!="environment"})).hexdigest()
    return result

def main():
    p=argparse.ArgumentParser(); p.add_argument("--max-n",type=int,default=7)
    p.add_argument("--max-denominator",type=int,default=18); p.add_argument("--output",required=True)
    a=p.parse_args(); result=run(a.max_n,a.max_denominator)
    open(a.output,"wb").write(canonical(result))
    print(json.dumps(result["counts"],sort_keys=True))
    print("PROTOCOL",result["protocol_status"],"THEOREM",result["theorem_status"],result["canonical_digest"])
    raise SystemExit(result["theorem_status"]!="PASS")
if __name__=="__main__": main()
