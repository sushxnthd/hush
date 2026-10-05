import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,norm} from '../polar-p1/evaluate.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256) throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');
const policies=new Map(), fields=new Map(), taskKeys=new Map(), privateKeys=new Map();
const inc=(m,k)=>m.set(k,(m.get(k)||0)+1);
for(const r of records){
  const p=String(r?.generated_texts?.privacy_policy_text??'').trim();
  inc(policies,p);
  for(const k of Object.keys(r?.source_document_inputs?.task_relevant_fields??{})) inc(taskKeys,k);
  for(const k of Object.keys(r?.source_document_inputs?.private_fields_embedded??{})) inc(privateKeys,k);
  for(const k of [...Object.keys(r?.source_document_inputs?.task_relevant_fields??{}),...Object.keys(r?.source_document_inputs?.private_fields_embedded??{})]) inc(fields,k);
}
const top=(m,n=200)=>[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);
const report={datasetSha256:sha,p1Cases:records.length,uniquePolicies:policies.size,topPolicies:top(policies,120),topFields:top(fields),taskRelevantKeys:top(taskKeys),privateFieldKeys:top(privateKeys)};
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('research/pcc-v2/out',{recursive:true});
fs.writeFileSync('research/pcc-v2/out/dev-inspect.json',JSON.stringify(report,null,2)+'\n');
