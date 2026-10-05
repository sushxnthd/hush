import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,reveals,scoreTranscript} from '../polar-p1/evaluate.mjs';
import {compileDisclosure,provenanceErasedFacts,directEvidence,semanticDenyEvidence,policyAllowsField} from './policy_compiler_v2.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input),sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256)throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===2&&String(r?.metadata?.privacy_type)==='semantic_constraints');
const inc=(m,k,n=1)=>m.set(k,(m.get(k)||0)+n),top=(m,n=60)=>[...m].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]))).slice(0,n);
const missKey=new Map(),missDomain=new Map(),missAttack=new Map(),denyReason=new Map(),policyPattern=new Map(),leakKey=new Map();
let allowed=0,missed=0,noCandidate=0,candidateDenied=0,candidateAllowedButMatcherMiss=0,protected=0,leaked=0;
const examples=[];
for(const r of records){
 const out=compileDisclosure(r),score=scoreTranscript(out.text,r.scoring_targets),facts=provenanceErasedFacts(r),policy=r.generated_texts?.privacy_policy_text??'';
 for(const t of r.scoring_targets?.allowed_values??[]){
  allowed++;
  if(reveals(out.text,t))continue;
  missed++;inc(missDomain,String(r.domain));inc(missAttack,String(r.metadata?.attack_type));
  const matches=facts.filter(x=>reveals(String(x.value),t)||reveals(t,String(x.value)));
  if(!matches.length){noCandidate++;if(examples.length<80)examples.push({sampleId:r.sample_id,domain:r.domain,target:t,reason:'no_candidate',policy});continue;}
  const allowedRows=matches.filter(x=>policyAllowsField(policy,x.key));
  if(!allowedRows.length){
    candidateDenied++;
    for(const x of matches){
      inc(missKey,x.key);
      const direct=directEvidence(policy,x.key),semantic=semanticDenyEvidence(policy,x.key);
      const reason=semantic.length?'semantic_deny':direct.some(e=>e.neg&&!e.pos)?'direct_deny':direct.some(e=>e.pos&&!e.neg)?'transform_or_special_rule':'no_positive_evidence';
      inc(denyReason,`${x.key}:${reason}`);
    }
    if(examples.length<80)examples.push({sampleId:r.sample_id,domain:r.domain,target:t,reason:'candidate_denied',matches:matches.map(x=>({key:x.key,value:x.value,allowed:policyAllowsField(policy,x.key),direct:directEvidence(policy,x.key),semantic:semanticDenyEvidence(policy,x.key)})),policy});
  }else{
    candidateAllowedButMatcherMiss++;
    for(const x of allowedRows)inc(missKey,`${x.key}:allowed_but_not_revealed`);
  }
 }
 for(const t of r.scoring_targets?.do_not_disclose_values??[]){
  protected++;
  if(!reveals(out.text,t))continue;
  leaked++;
  for(const x of out.chosen.map(y=>y.row).filter(x=>reveals(String(x.value),t)||reveals(t,String(x.value))))inc(leakKey,x.key);
 }
 const normPolicy=policy.toLowerCase().replace(/\s+/g,' ').trim();inc(policyPattern,normPolicy);
}
const report={datasetSha256:sha,p2Cases:records.length,allowedTargets:allowed,missedAllowedTargets:missed,allowedTargetUtility:1-missed/allowed,noCandidate,candidateDenied,candidateAllowedButMatcherMiss,protectedTargets:protected,protectedLeaks:leaked,topMissKeys:top(missKey),topDenyReasons:top(denyReason),missByDomain:top(missDomain,20),missByAttack:top(missAttack,20),topPolicies:top(policyPattern,80),topLeakKeys:top(leakKey),examples};
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('research/pcc-v2/out',{recursive:true});fs.writeFileSync('research/pcc-v2/out/p2-diagnostics.json',JSON.stringify(report,null,2)+'\n');
