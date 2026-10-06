import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,reveals} from '../polar-p1/evaluate.mjs';
import {provenanceErasedFacts} from '../pcc-v2/policy_compiler_v2.mjs';
import {compileDisclosureV3,policyAllowsFieldV3} from '../pcc-v3/policy_compiler_v3.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input),sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256)throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===3);
const inc=(m,k,n=1)=>m.set(k,(m.get(k)||0)+n),top=(m,n=50)=>[...m].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]))).slice(0,n);
const byKey=new Map(),byDomain=new Map(),byPolicy=new Map(),byTask=new Map(),examples=[];
let totalAllowed=0,missed=0,noSourceMatch=0,matchedDenied=0,matchedAllowedAbsent=0,caseMiss=0;
for(const r of records){
  const out=compileDisclosureV3(r), policy=String(r?.generated_texts?.privacy_policy_text??''), task=String(r?.generated_texts?.task_instruction_text??''), facts=provenanceErasedFacts(r);
  let thisMiss=0;
  for(const target of r?.scoring_targets?.allowed_values??[]){
    totalAllowed++; if(reveals(out.text,target))continue; missed++;thisMiss++;
    const matches=facts.filter(f=>reveals(String(f.value),target)||reveals(target,String(f.value)));
    if(!matches.length){noSourceMatch++;inc(byDomain,`${r.domain}:no_source_match`);continue;}
    const denied=matches.filter(f=>!policyAllowsFieldV3(policy,f.key)), allowed=matches.filter(f=>policyAllowsFieldV3(policy,f.key));
    if(denied.length){matchedDenied++;for(const f of denied)inc(byKey,`deny:${f.key}`);}
    if(allowed.length){matchedAllowedAbsent++;for(const f of allowed)inc(byKey,`allowed_but_absent:${f.key}`);}
    inc(byDomain,String(r.domain));inc(byPolicy,policy);inc(byTask,task);
    if(examples.length<120)examples.push({sampleId:r.sample_id,domain:r.domain,attack:r?.metadata?.attack_type,target,matches:matches.map(f=>({key:f.key,value:f.value,allowed:policyAllowsFieldV3(policy,f.key)})),policy,task});
  }
  if(thisMiss)caseMiss++;
}
const report={datasetSha256:sha,p3Cases:records.length,totalAllowed,missed,missRate:missed/totalAllowed,caseMiss,caseMissRate:caseMiss/records.length,noSourceMatch,matchedDenied,matchedAllowedAbsent,topMissKeys:top(byKey),topMissDomains:top(byDomain),topMissPolicies:top(byPolicy,20),topMissTasks:top(byTask,20),examples};
console.log(JSON.stringify({datasetSha256:sha,p3Cases:records.length,totalAllowed,missed,missRate:report.missRate,caseMiss,caseMissRate:report.caseMissRate,noSourceMatch,matchedDenied,matchedAllowedAbsent,topMissKeys:report.topMissKeys,topMissDomains:report.topMissDomains,topMissPolicies:report.topMissPolicies.slice(0,8)},null,2));
fs.mkdirSync('research/pcc-v4/out',{recursive:true});fs.writeFileSync('research/pcc-v4/out/p3-miss-diagnostics.json',JSON.stringify(report,null,2)+'\n');
