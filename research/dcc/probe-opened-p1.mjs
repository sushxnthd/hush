import fs from 'node:fs';
import crypto from 'node:crypto';
const file=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(file),sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!=='b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266')throw Error('hash mismatch');
const rows=JSON.parse(bytes).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');
const safeKeys={},examples={},ipPolicies=[];
for(const r of rows){
  const s=r.source_document_inputs?.safe_abstractions_available??{};
  for(const k of Object.keys(s))safeKeys[k]=(safeKeys[k]||0)+1;
  const tr=r.source_document_inputs?.task_relevant_fields??{};
  for(const k of ['duration','task_relevant_fact','desired_action','reported_problem']){
    if(Object.hasOwn(tr,k)&&!examples[k])examples[k]={domain:r.domain,policy:r.generated_texts?.privacy_policy_text??'',task:r.generated_texts?.task_instruction_text??''};
  }
  if(Object.hasOwn(r.source_document_inputs?.private_fields_embedded??{},'ip_address')&&ipPolicies.length<5)ipPolicies.push({domain:r.domain,policy:r.generated_texts?.privacy_policy_text??''});
}
console.log(JSON.stringify({safeAbstractionKeys:safeKeys,remainingPolicyExamples:examples,ipPolicies},null,2));
