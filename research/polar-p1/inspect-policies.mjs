import fs from 'node:fs';
import {blindRecord,sourceCandidates,protectedFieldKeys,reveals,EXPECTED_DATA_SHA256} from './evaluate.mjs';
import crypto from 'node:crypto';
const p=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(p);const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256)throw Error('dataset hash mismatch');
const rows=JSON.parse(bytes).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');
const seen=new Set(), examples=[];
for(const r of rows){
  const domain=String(r.domain??r?.metadata?.domain??'');
  if(seen.has(domain))continue;seen.add(domain);
  const b=blindRecord(r),c=sourceCandidates(b),pk=protectedFieldKeys(b,c),t=r.scoring_targets;
  examples.push({domain,policy:b.generated_texts.privacy_policy_text,task:b.generated_texts.task_instruction_text,fields:c.map(x=>({key:x.key,length:String(x.value).length,classifiedProtected:pk.has(x.key),matchesAllowed:(t.allowed_values??[]).filter(v=>reveals(String(x.value),v)||reveals(v,String(x.value))).length,matchesProtected:(t.do_not_disclose_values??[]).filter(v=>reveals(String(x.value),v)||reveals(v,String(x.value))).length}))});
  if(seen.size>=10)break;
}
console.log(JSON.stringify(examples,null,2));
