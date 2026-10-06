import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,reveals,norm} from '../polar-p1/evaluate.mjs';
import {compileDisclosure,provenanceErasedFacts,policyAllowsField,directEvidence,semanticDenyEvidence} from '../pcc-v2/policy_compiler_v2.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256)throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===2&&String(r?.metadata?.privacy_type)==='semantic_constraints');
const byKey=new Map(),byDomain=new Map(),byPolicy=new Map();
const examples=[];
const inc=(m,k,n=1)=>m.set(k,(m.get(k)||0)+n);
let totalAllowed=0,missed=0,noSourceMatch=0,matchedDenied=0,matchedAllowedButAbsent=0;
for(const r of records){
  const out=compileDisclosure(r), policy=String(r?.generated_texts?.privacy_policy_text??''), facts=provenanceErasedFacts(r);
  for(const target of r?.scoring_targets?.allowed_values??[]){
    totalAllowed++;
    if(reveals(out.text,target))continue;
    missed++;
    const matches=facts.filter(f=>reveals(String(f.value),target)||reveals(target,String(f.value)));
    if(!matches.length){noSourceMatch++;inc(byDomain,`${r.domain}:no_source_match`);continue;}
    const denied=matches.filter(f=>!policyAllowsField(policy,f.key));
    const allowed=matches.filter(f=>policyAllowsField(policy,f.key));
    if(denied.length){matchedDenied++;for(const f of denied)inc(byKey,`deny:${f.key}`);}
    if(allowed.length){matchedAllowedButAbsent++;for(const f of allowed)inc(byKey,`allowed_but_absent:${f.key}`);}
    inc(byDomain,String(r.domain));inc(byPolicy,policy);
    if(examples.length<80)examples.push({sampleId:r.sample_id,domain:r.domain,target,matches:matches.map(f=>({key:f.key,value:f.value,allowed:policyAllowsField(policy,f.key),direct:directEvidence(policy,f.key),semanticDeny:semanticDenyEvidence(policy,f.key)})),policy});
  }
}
const top=m=>[...m].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]))).slice(0,60);
const report={datasetSha256:sha,p2Cases:records.length,totalAllowed,missed,missRate:missed/totalAllowed,noSourceMatch,matchedDenied,matchedAllowedButAbsent,topMissKeys:top(byKey),topMissDomains:top(byDomain),topMissPolicies:top(byPolicy).slice(0,20),examples};
console.log(JSON.stringify({datasetSha256:sha,p2Cases:records.length,totalAllowed,missed,missRate:missed/totalAllowed,noSourceMatch,matchedDenied,matchedAllowedButAbsent,topMissKeys:report.topMissKeys,topMissDomains:report.topMissDomains},null,2));
fs.mkdirSync('research/pcc-v3/out',{recursive:true});
fs.writeFileSync('research/pcc-v3/out/p2-miss-diagnostics.json',JSON.stringify(report,null,2)+'\n');
