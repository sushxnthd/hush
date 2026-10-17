import { createHash } from "node:crypto";

export function finiteEnsembleRobustCharge({ priors, branchIndices }) {
  if (!Array.isArray(priors) || priors.length === 0) throw new Error("nonempty prior ensemble required");
  const n = priors[0].length;
  if (!Array.isArray(branchIndices) || branchIndices.length === 0 || branchIndices.length >= n) throw new Error("nontrivial branch required");
  const branch = [...new Set(branchIndices)].sort((a,b)=>a-b);
  let worst = -Infinity, worstPriorIndex = -1;
  const canonical=[];
  priors.forEach((prior,index)=>{
    if (!Array.isArray(prior) || prior.length!==n || prior.some(x=>!Number.isFinite(x)||x<=0)) throw new Error("strictly positive equal-length priors required");
    const total=prior.reduce((a,b)=>a+b,0);
    if (Math.abs(total-1)>1e-9) throw new Error("prior must sum to one");
    const mass=branch.reduce((s,i)=>s+prior[i],0);
    const branchMax=Math.max(...branch.map(i=>prior[i]));
    const globalMax=Math.max(...prior);
    const charge=Math.max(0,Math.log2(branchMax/(globalMax*mass)));
    if (charge>worst) { worst=charge; worstPriorIndex=index; }
    canonical.push(prior.map(x=>Number(x.toPrecision(17))));
  });
  const ensembleDigest=createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return Object.freeze({ mechanism:"fer-pcc-v1", chargeBits:worst, worstPriorIndex, ensembleSize:priors.length, branchIndices:branch, ensembleDigest });
}
