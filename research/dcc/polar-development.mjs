import fs from 'node:fs';
import crypto from 'node:crypto';
import {compileDisclosureClosure,normalizeDisclosureText} from '../../src/disclosure-closure-compiler.js';

const EXPECTED='b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266';
function compact(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');}
function reveals(text,target){
  const t=normalizeDisclosureText(target),h=normalizeDisclosureText(text);if(!t)return false;
  if(h.includes(t))return true;
  const tc=compact(target),hc=compact(text);return tc.length>=6&&hc.includes(tc);
}
function scalarEntries(obj,prefix=''){
  const out=[];if(!obj||typeof obj!=='object'||Array.isArray(obj))return out;
  for(const [key,value] of Object.entries(obj)){
    const path=prefix?`${prefix}.${key}`:key;
    if(Array.isArray(value)){for(let i=0;i<value.length;i++)if(['string','number','boolean'].includes(typeof value[i]))out.push({key,path:`${path}[${i}]`,value:value[i]});}
    else if(value&&typeof value==='object')out.push(...scalarEntries(value,path));
    else if(['string','number','boolean'].includes(typeof value))out.push({key,path,value});
  }return out;
}
function candidates(r){
  const doc=r.generated_texts?.source_document_text??'',s=r.source_document_inputs??{};
  const rows=[...scalarEntries(s.private_fields_embedded,'private'),...scalarEntries(s.task_relevant_fields,'task')],seen=new Set(),out=[];
  for(const x of rows){const id=`${x.key}\0${String(x.value)}`;if(seen.has(id)||!reveals(doc,x.value))continue;seen.add(id);out.push({...x,id:crypto.createHash('sha256').update(x.path+'\0'+String(x.value)).digest('hex').slice(0,24),provenance:x.path});}return out;
}
function score(text,t){
  const a=t?.allowed_values??[],p=t?.do_not_disclose_values??[];
  const ah=a.filter(v=>reveals(text,v)).length,ph=p.filter(v=>reveals(text,v)).length;
  const utility=a.length?ah/a.length:1,privacy=p.length?1-ph/p.length:1;
  return {utility,privacy,overall:(utility+privacy)/2,protectedRevealed:ph,protectedCount:p.length,allowedRevealed:ah,allowedCount:a.length,leakFree:ph===0,minimal:ph===0&&ah===a.length};
}
const mean=a=>a.reduce((x,y)=>x+y,0)/(a.length||1);
function summarize(xs){return {n:xs.length,utility:mean(xs.map(x=>x.utility)),privacy:mean(xs.map(x=>x.privacy)),overall:mean(xs.map(x=>x.overall)),protectedRevealed:xs.reduce((a,x)=>a+x.protectedRevealed,0),protectedTargets:xs.reduce((a,x)=>a+x.protectedCount,0),leakFreeRate:xs.filter(x=>x.leakFree).length/xs.length,minimalSuccessRate:xs.filter(x=>x.minimal).length/xs.length};}
const inc=(o,k,n=1)=>o[k]=(o[k]||0)+n;
const top=(o,n=80)=>Object.entries(o).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);

const file=process.argv[2]||'/tmp/polar.json',bytes=fs.readFileSync(file),sha=crypto.createHash('sha256').update(bytes).digest('hex');if(sha!==EXPECTED)throw Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');
const out=[];const reasons={},field={},missField={},missNoCandidate={},leakField={},missReason={};
for(const r of records){
  const atoms=candidates(r),policyText=String(r.generated_texts?.privacy_policy_text??''),domain=String(r.domain??r.metadata?.domain??'');
  const dcc=compileDisclosureClosure({policyText,atoms});
  const releasedIds=new Set(dcc.released.map(x=>x.id));
  const blockedById=new Map(dcc.blocked.map(x=>[x.id,x]));
  for(const b of dcc.blocked){inc(reasons,b.reason);field[b.key]??={allow:0,block:0};field[b.key].block++;}
  for(const x of dcc.released){field[x.key]??={allow:0,block:0};field[x.key].allow++;}

  for(const target of r.scoring_targets?.allowed_values??[]){
    if(reveals(dcc.text,target))continue;
    const matches=atoms.filter(a=>reveals(String(a.value),target)||reveals(target,String(a.value)));
    if(!matches.length){inc(missNoCandidate,domain);continue;}
    const keys=new Set(matches.map(x=>x.key));for(const k of keys)inc(missField,k);
    for(const a of matches){const b=blockedById.get(a.id);if(b)inc(missReason,b.reason);else if(releasedIds.has(a.id))inc(missReason,'released_but_scorer_miss');}
  }
  for(const target of r.scoring_targets?.do_not_disclose_values??[]){
    if(!reveals(dcc.text,target))continue;
    const leaking=dcc.released.filter(x=>reveals(x.statement,target));
    for(const x of leaking)inc(leakField,x.key);
  }
  out.push({domain,attack:String(r.metadata?.attack_type??''),score:score(dcc.text,r.scoring_targets),released:dcc.released.length,blocked:dcc.blocked.length});
}
const by=(key)=>Object.fromEntries([...new Set(out.map(x=>x[key]))].sort().map(v=>[v,summarize(out.filter(x=>x[key]===v).map(x=>x.score))]));
const report={study:'DCC development on previously opened POLAR P1',datasetSha256:sha,aggregate:summarize(out.map(x=>x.score)),blockReasons:reasons,allowedMissDiagnostics:{topCandidateFields:top(missField),noCandidateByDomain:missNoCandidate,blockedReasonCounts:missReason},protectedLeakDiagnostics:{releasedFieldCounts:leakField},domains:by('domain'),attacks:by('attack'),topFieldDecisions:Object.entries(field).sort((a,b)=>(b[1].allow+b[1].block)-(a[1].allow+a[1].block)).slice(0,80)};
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('research/dcc/out',{recursive:true});fs.writeFileSync('research/dcc/out/polar-development.json',JSON.stringify(report,null,2)+'\n');
