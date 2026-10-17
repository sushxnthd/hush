#!/usr/bin/env python3
import argparse, json, math, hashlib

TH=.30; B=(.25,.5,1.,2.,3.,4.); F=1e-12
def unit(v):
    v=[max(F,float(x)) for x in v]; z=sum(v); return [x/z for x in v]
def ensembles(n):
    x=list(range(n)); result={}
    result["student_location"]=[unit([(1+((i-c*(n-1))/(.1*n))**2/3)**-2 for i in x]) for c in (.15,.325,.5,.675,.85)]
    a=[math.exp(-.5*((i-.25*(n-1))/(.08*n))**2) for i in x]; b=[math.exp(-.5*((i-.75*(n-1))/(.08*n))**2) for i in x]
    result["two_peak_weight"]=[unit([w*u+(1-w)*v for u,v in zip(a,b)]) for w in (.1,.3,.5,.7,.9)]
    result["geometric_ratio"]=[unit([r**i for i in x]) for r in (.9,.95,1,1.05,1.1)]
    result["cosine_phase"]=[unit([math.exp(1.2*math.cos(2*math.pi*i/n-2*math.pi*j/5)) for i in x]) for j in range(5)]
    return result
def rr(p,s):
    z=sum(p[i] for i in s); return max(0.,math.log2(max(p[i] for i in s)/(z*max(p))))
def walk(n,secret,task,h):
    s=list(range(n)); out=[s[:]]
    for k in range(5):
        if len(s)<=1: break
        if task=="golden_alternating": q=.382 if k%2==0 else .618; cut=s[0]+max(0,min(len(s)-2,math.floor(q*len(s))-1))
        elif task=="center_out": q=.25 if k%2==0 else .75; cut=s[0]+max(0,min(len(s)-2,math.ceil(q*len(s))-1))
        else:
            q=1/3 if k%2==0 else 2/3; z=sum(h[i] for i in s); c=0.; cut=s[-2]
            for i in s:
                c+=h[i]/z
                if c>=q: cut=min(i,s[-2]); break
        s=[i for i in s if (i<=cut)==(secret<=cut)]; out.append(s[:])
    return out
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("result"); args=ap.parse_args(); d=json.load(open(args.result)); found={}; failures=0
    for n in (24,48,96):
      for fam,P in ensembles(n).items():
       for task in ("golden_alternating","posterior_tertile","center_out"):
        sw=el=fa=fq=0
        for secret in range(n):
            ss=walk(n,secret,task,P[2]); mat=[[rr(p,s) for s in ss] for p in P]; aa=[]; qq=[0.]; who=[]
            for j in range(len(ss)): aa.append(max(mat[i][k] for i in range(5) for k in range(j+1)))
            for j in range(1,len(ss)):
                ds=[max(0.,mat[i][j]-mat[i][j-1]) for i in range(5)]; qq.append(qq[-1]+max(ds)); who.append(max(range(5),key=lambda i:ds[i]))
            sw+=sum(who[j]!=who[j-1] for j in range(1,len(who))); el+=max(0,len(who)-1)
            for truth in (max(v) for v in mat):
                for budget in B: fa+=int(aa[-1]>budget+1e-12 and truth<=budget+1e-12); fq+=int(qq[-1]>budget+1e-12 and truth<=budget+1e-12)
        found[(fam,n,task)]=(sw/el if el else 0.,fa,fq)
    for row in d["rows"]:
        got=found[(row["family"],row["n"],row["task"])]
        failures+=int(abs(got[0]-row["switch_potential"])>1e-12 or got[1]!=row["false_denials_A"] or got[2]!=row["false_denials_Q"])
    for fam,s in d["summary"].items():
        rows=[found[k] for k in found if k[0]==fam]; p=sum(x[0] for x in rows)/len(rows); fa=sum(x[1] for x in rows); fq=sum(x[2] for x in rows); g=(fq-fa)/fq if fq else 0
        failures+=int(abs(p-s["switch_potential"])>1e-12 or fa!=s["false_denials_A"] or fq!=s["false_denials_Q"] or abs(g-s["gain"])>1e-12 or (p>=TH)!=s["route_trace_bound"])
    out={"status":"PASS" if failures==0 else "FAIL","checked_rows":len(found),"failures":failures,"source_canonical_sha256":d["canonical_payload_sha256"],"audit_digest":hashlib.sha256(json.dumps(sorted((str(k),v) for k,v in found.items()),separators=(",",":")).encode()).hexdigest()}
    print(json.dumps(out,sort_keys=True)); raise SystemExit(0 if failures==0 else 1)
if __name__=="__main__": main()
