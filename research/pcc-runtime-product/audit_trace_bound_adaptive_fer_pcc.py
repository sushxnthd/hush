#!/usr/bin/env python3
import argparse,json,math,hashlib

F=1e-12; budgets=(.25,.5,1.,2.,3.,4.)
def nz(v):
 v=[max(F,float(x)) for x in v]; s=sum(v); return [x/s for x in v]
def make(n,name):
 if name=="laplace_location": return [nz([math.exp(-abs(i-f*(n-1))/(.12*n)) for i in range(n)]) for f in (.2,.35,.5,.65,.8)]
 if name=="power_tilt": return [nz([(i+1)**a for i in range(n)]) for a in (-2,-1,0,1,2)]
 return [nz([math.exp(-.5*((i-(n-1)/2)/(s*n))**2) for i in range(n)]) for s in (.06,.10,.16,.24,.36)]
def r(p,S):
 z=sum(p[i] for i in S); return max(0.,math.log2(max(p[i] for i in S)/(z*max(p))))
def path(n,x,kind,h):
 S=list(range(n)); out=[S[:]]
 for t in range(5):
  if len(S)==1: break
  lo,hi=S[0],S[-1]
  if kind=="bisection": k=(lo+hi)//2
  elif kind=="tercile": k=lo+max(0,(len(S)//3-1) if t%2==0 else (math.ceil(2*len(S)/3)-1))
  else:
   z=sum(h[i] for i in S); a=0.; k=hi
   for i in S:
    a+=h[i]/z
    if a>=.5: k=i; break
  S=[i for i in S if (i<=k)==(x<=k)]; out.append(S[:])
 return out
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("result"); a=ap.parse_args(); d=json.load(open(a.result)); fails=0; rows=[]
 for saved in d["rows"]:
  n=saved["n"]; P=make(n,saved["family"]); h=P[2]; strict=0; fdA=fdQ=0; safeA=safeQ=dom=0
  for x in range(n):
   sets=path(n,x,saved["task"],h); R=[[r(p,S) for S in sets] for p in P]; Aseq=[max(R[i][s] for i in range(5) for s in range(j+1)) for j in range(len(sets))]; Qseq=[0.]
   for j in range(1,len(sets)): Qseq.append(Qseq[-1]+max(max(0.,R[i][j]-R[i][j-1]) for i in range(5)))
   A,Q=Aseq[-1],Qseq[-1]; strict+=int(A<Q-1e-12); safeA+=sum(R[i][j]>Aseq[j]+1e-12 for i in range(5) for j in range(len(sets))); safeQ+=sum(R[i][j]>Qseq[j]+1e-12 for i in range(5) for j in range(len(sets))); dom+=sum(Aseq[j]>Qseq[j]+1e-12 for j in range(len(sets)))
   for oracle in (max(z) for z in R):
    for b in budgets: fdA+=int(A>b+1e-12 and oracle<=b+1e-12); fdQ+=int(Q>b+1e-12 and oracle<=b+1e-12)
  fails+=int(strict!=saved["strict_gap_traces"] or safeA or safeQ or dom); fails+=int(fdA!=sum(v["false_deny"] for v in saved["decisions"]["trace_bound"].values()) or fdQ!=sum(v["false_deny"] for v in saved["decisions"]["independent_step"].values())); rows.append((saved["family"],n,saved["task"],strict,fdA,fdQ))
 out={"checked_configs":len(rows),"failures":fails,"rows_sha256":hashlib.sha256(json.dumps(rows,separators=(",",":")).encode()).hexdigest(),"source_canonical_sha256":d["canonical_payload_sha256"],"status":"PASS" if fails==0 else "FAIL"}; print(json.dumps(out,sort_keys=True,indent=2))
if __name__=="__main__": main()
