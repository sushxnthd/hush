import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256} from '../polar-p1/evaluate.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256) throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');
const policies=new Map(), fields=new Map(), taskKeys=new Map(), privateKeys=new Map(), safeKeys=new Map(), safeShapes=new Map(), cooccur=new Map();
const inc=(m,k)=>m.set(k,(m.get(k)||0)+1);
const shape=v=>Array.isArray(v)?'array':v===null?'null':typeof v;
for(const r of records){
  const p=String(r?.generated_texts?.privacy_policy_text??'').trim();
  inc(policies,p);
  const task=r?.source_document_inputs?.task_relevant_fields??{};
  const priv=r?.source_document_inputs?.private_fields_embedded??{};
  const safe=r?.source_document_inputs?.safe_abstractions_available??{};
  for(const k of Object.keys(task)) inc(taskKeys,k);
  for(const k of Object.keys(priv)) inc(privateKeys,k);
  for(const [k,v] of Object.entries(safe)){inc(safeKeys,k);inc(safeShapes,`${k}:${shape(v)}`);}
  for(const k of [...Object.keys(task),...Object.keys(priv),...Object.keys(safe)]) inc(fields,k);
  for(const pk of Object.keys(priv)) for(const sk of Object.keys(safe)) inc(cooccur,`${pk}->${sk}`);
}
const top=(m,n=300)=>[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);
const report={datasetSha256:sha,p1Cases:records.length,uniquePolicies:policies.size,topPolicies:top(policies,120),topFields:top(fields),taskRelevantKeys:top(taskKeys),privateFieldKeys:top(privateKeys),safeAbstractionKeys:top(safeKeys),safeAbstractionShapes:top(safeShapes),topPrivateSafeCooccurrence:top(cooccur,400)};
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('research/pcc-v2/out',{recursive:true});
fs.writeFileSync('research/pcc-v2/out/dev-inspect.json',JSON.stringify(report,null,2)+'\n');
