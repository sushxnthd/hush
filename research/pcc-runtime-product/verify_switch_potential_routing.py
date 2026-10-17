#!/usr/bin/env python3
import argparse, hashlib, json, math, platform
from pathlib import Path

NS=(24,48,96); BUDGETS=(.25,.5,1.,2.,3.,4.); FLOOR=1e-12; THRESHOLD=.30
FAMILIES=("student_location","two_peak_weight","geometric_ratio","cosine_phase")
TASKS=("golden_alternating","posterior_tertile","center_out")

def norm(v):
    v=[max(FLOOR,float(x)) for x in v]; z=sum(v); return [x/z for x in v]

def families(n):
    xs=range(n)
    student=[]
    for f in (.15,.325,.5,.675,.85):
        c=f*(n-1); s=.10*n
        student.append(norm([(1+((i-c)/s)**2/3)**-2 for i in xs]))
    left=[math.exp(-.5*((i-.25*(n-1))/(.08*n))**2) for i in xs]
    right=[math.exp(-.5*((i-.75*(n-1))/(.08*n))**2) for i in xs]
    mixture=[norm([w*a+(1-w)*b for a,b in zip(left,right)]) for w in (.1,.3,.5,.7,.9)]
    geometric=[norm([r**i for i in xs]) for r in (.90,.95,1.,1.05,1.10)]
    phases=[2*math.pi*j/5 for j in range(5)]
    cosine=[norm([math.exp(1.2*math.cos(2*math.pi*i/n-ph)) for i in xs]) for ph in phases]
    return dict(student_location=student,two_peak_weight=mixture,geometric_ratio=geometric,cosine_phase=cosine)

def posterior(p,S):
    z=sum(p[i] for i in S); return [p[i]/z for i in S]

def risk(p,S):
    return max(0.,math.log2(max(posterior(p,S))/max(p)))

def choose_cut(S,task,step,nominal):
    lo,hi=S[0],S[-1]
    if task=="golden_alternating":
        frac=.382 if step%2==0 else .618
        return lo+max(0,min(len(S)-2,math.floor(frac*len(S))-1))
    if task=="center_out":
        frac=.25 if step%2==0 else .75
        return lo+max(0,min(len(S)-2,math.ceil(frac*len(S))-1))
    target=1/3 if step%2==0 else 2/3
    weights=posterior(nominal,S); acc=0.
    for i,w in zip(S,weights):
        acc+=w
        if acc>=target: return min(i,S[-2])
    return S[-2]

def trace(n,secret,task,nominal):
    S=list(range(n)); out=[tuple(S)]
    for step in range(5):
        if len(S)<=1: break
        cut=choose_cut(S,task,step,nominal)
        S=[i for i in S if (i<=cut)==(secret<=cut)]
        out.append(tuple(S))
    return out

def evaluate(name,n,P,task):
    nominal=P[2]; switches=eligible=fdA=fdQ=0; safety=dominance=0; strict=0
    canonical=[]
    for secret in range(n):
        sets=trace(n,secret,task,nominal)
        R=[[risk(p,S) for S in sets] for p in P]
        Aseq=[max(R[i][s] for i in range(5) for s in range(j+1)) for j in range(len(sets))]
        Qseq=[0.]; worst=[]
        for j in range(1,len(sets)):
            vals=[max(0.,R[i][j]-R[i][j-1]) for i in range(5)]
            m=max(vals); Qseq.append(Qseq[-1]+m); worst.append(max(range(5),key=lambda i: vals[i]))
        switches+=sum(worst[j]!=worst[j-1] for j in range(1,len(worst)))
        eligible+=max(0,len(worst)-1)
        safety+=sum(R[i][j]>Aseq[j]+1e-12 or R[i][j]>Qseq[j]+1e-12 for i in range(5) for j in range(len(sets)))
        dominance+=sum(Aseq[j]>Qseq[j]+1e-12 for j in range(len(sets)))
        A,Q=Aseq[-1],Qseq[-1]; strict+=int(A<Q-1e-12)
        for oracle in (max(row) for row in R):
            for b in BUDGETS:
                fdA+=int(A>b+1e-12 and oracle<=b+1e-12)
                fdQ+=int(Q>b+1e-12 and oracle<=b+1e-12)
        canonical.append([secret,[list(s) for s in sets],worst])
    return {"family":name,"n":n,"task":task,"traces":n,"switches":switches,"eligible":eligible,
            "switch_potential":switches/eligible if eligible else 0.,"false_denials_A":fdA,
            "false_denials_Q":fdQ,"strict_gap_traces":strict,"safety_violations":safety,
            "dominance_violations":dominance,"tree_sha256":hashlib.sha256(json.dumps(canonical,separators=(",",":")).encode()).hexdigest()}

def ranks(xs):
    order=sorted(range(len(xs)),key=lambda i:xs[i]); out=[0.]*len(xs); pos=0
    while pos<len(order):
        end=pos+1
        while end<len(order) and abs(xs[order[end]]-xs[order[pos]])<1e-15: end+=1
        rank=(pos+end-1)/2+1
        for j in range(pos,end): out[order[j]]=rank
        pos=end
    return out

def spearman(a,b):
    x,y=ranks(a),ranks(b); mx=sum(x)/len(x); my=sum(y)/len(y)
    num=sum((u-mx)*(v-my) for u,v in zip(x,y)); dx=sum((u-mx)**2 for u in x); dy=sum((v-my)**2 for v in y)
    return num/math.sqrt(dx*dy) if dx and dy else 0.

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--output",required=True); args=ap.parse_args()
    rows=[]
    for n in NS:
        for name,P in families(n).items():
            for task in TASKS: rows.append(evaluate(name,n,P,task))
    summary={}
    for fam in FAMILIES:
        rr=[r for r in rows if r["family"]==fam]
        potential=sum(r["switch_potential"] for r in rr)/len(rr)
        A=sum(r["false_denials_A"] for r in rr); Q=sum(r["false_denials_Q"] for r in rr)
        gain=(Q-A)/Q if Q else 0.; routed=potential>=THRESHOLD
        summary[fam]={"switch_potential":potential,"route_trace_bound":routed,"false_denials_A":A,"false_denials_Q":Q,"gain":gain,"material_gain":gain>=.20}
    vals=list(summary.values()); high=[v for v in vals if v["route_trace_bound"]]; low=[v for v in vals if not v["route_trace_bound"]]
    tp=sum(v["material_gain"] for v in high); fn=sum(v["material_gain"] for v in low)
    tn=sum(not v["material_gain"] for v in low); fp=sum(not v["material_gain"] for v in high)
    tpr=tp/(tp+fn) if tp+fn else 0.; tnr=tn/(tn+fp) if tn+fp else 0.; bal=(tpr+tnr)/2
    rho=spearman([v["switch_potential"] for v in vals],[v["gain"] for v in vals])
    gates={"both_route_classes":bool(high and low),"high_gain":bool(high) and all(v["gain"]>=.20 for v in high),
           "low_gain":bool(low) and all(v["gain"]<=.10 for v in low),"balanced_accuracy":bal>=.75,
           "spearman":rho>=.8,"safety":sum(r["safety_violations"] for r in rows)==0,
           "dominance":sum(r["dominance_violations"] for r in rows)==0,
           "normalized":all(abs(sum(p)-1)<1e-12 and min(p)>0 for n in NS for P in families(n).values() for p in P)}
    payload={"schema":"hush.switch-potential-router.v1","created_at_utc":"2026-10-13T23:55:00Z","python":platform.python_version(),
             "threshold":THRESHOLD,"budgets_bits":list(BUDGETS),"rows":rows,"summary":summary,
             "balanced_accuracy":bal,"spearman":rho,"gates":gates,"status":"PASS" if all(gates.values()) else "FAIL"}
    canon=json.dumps(payload,sort_keys=True,separators=(",",":")).encode(); payload["canonical_payload_sha256"]=hashlib.sha256(canon).hexdigest()
    data=(json.dumps(payload,sort_keys=True,indent=2)+"\n").encode(); Path(args.output).write_bytes(data)
    print(json.dumps({"status":payload["status"],"sha256":hashlib.sha256(data).hexdigest(),"summary":summary,"balanced_accuracy":bal,"spearman":rho,"gates":gates},sort_keys=True))

if __name__=="__main__": main()
