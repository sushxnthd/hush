import fs from 'node:fs';
import crypto from 'node:crypto';
import {compilePrivateConstraint} from '../../src/private-constraint-compiler.js';
import {blindRecord,sourceCandidates,protectedFieldKeys,reveals,humanField,EXPECTED_DATA_SHA256} from './evaluate.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256) throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');

const stats={
  n:records.length,
  protectedTargets:0,allowedTargets:0,
  protectedTargetsRepresentedByCandidate:0,
  protectedTargetsRepresentedByPolicyProtectedCandidate:0,
  allowedTargetsRepresentedByCandidate:0,
  allowedTargetsRepresentedByUnprotectedCandidate:0,
  protectedLeaksFromUnprotectedCandidate:0,
  allowedMissesNoCandidate:0,
  allowedMissesProtectedCandidateOnly:0,
  compile:{ok:0,error:0,byField:{},byDomain:{}},
  field:{},domain:{},attack:{}
};
const inc=(obj,key,n=1)=>obj[key]=(obj[key]||0)+n;
const nested=(obj,key)=>obj[key]||(obj[key]={});
function fieldStats(key){return nested(stats.field,key);}
function simpleContract(row,i){
  const s=String(row.value);
  return {id:`diag.${crypto.createHash('sha256').update(row.path+'\0'+i).digest('hex').slice(0,24)}`,privateRef:{},extractor:{kind:'enum',values:[{value:s,label:s,aliases:[s]}]},release:{op:'identity',label:humanField(row.key)}};
}
function targetMatchesRows(target,rows){return rows.filter(r=>reveals(String(r.value),target)||reveals(target,String(r.value)));}

for(const record of records){
  const b=blindRecord(record), rows=sourceCandidates(b), protectedKeys=protectedFieldKeys(b,rows);
  const allowed=record.scoring_targets?.allowed_values??[], blocked=record.scoring_targets?.do_not_disclose_values??[];
  const domain=String(record.domain??record?.metadata?.domain??''), attack=String(record?.metadata?.attack_type??'');
  const ds=nested(stats.domain,domain), as=nested(stats.attack,attack);
  stats.protectedTargets+=blocked.length; stats.allowedTargets+=allowed.length;
  inc(ds,'cases'); inc(as,'cases');
  for(const t of blocked){
    const matches=targetMatchesRows(t,rows);
    if(matches.length){
      stats.protectedTargetsRepresentedByCandidate++;
      if(matches.some(r=>protectedKeys.has(r.key))) stats.protectedTargetsRepresentedByPolicyProtectedCandidate++;
      const unprotected=matches.filter(r=>!protectedKeys.has(r.key));
      if(unprotected.length){
        stats.protectedLeaksFromUnprotectedCandidate++;
        inc(ds,'protectedTargetHasUnprotectedCandidate');inc(as,'protectedTargetHasUnprotectedCandidate');
        for(const r of unprotected) inc(fieldStats(r.key),'protectedTargetViaUnprotectedField');
      }
    }else{inc(ds,'protectedTargetNoCandidate');}
  }
  for(const t of allowed){
    const matches=targetMatchesRows(t,rows);
    if(matches.length){
      stats.allowedTargetsRepresentedByCandidate++;
      const usable=matches.filter(r=>!protectedKeys.has(r.key));
      if(usable.length) stats.allowedTargetsRepresentedByUnprotectedCandidate++;
      else {stats.allowedMissesProtectedCandidateOnly++;inc(ds,'allowedOnlyProtectedCandidate');}
      for(const r of matches) inc(fieldStats(r.key),'allowedTargetMatches');
    }else{
      stats.allowedMissesNoCandidate++;
      inc(ds,'allowedTargetNoCandidate');inc(as,'allowedTargetNoCandidate');
    }
  }
  rows.forEach((row,i)=>{
    const f=fieldStats(row.key);inc(f,'candidates');
    if(protectedKeys.has(row.key))inc(f,'policyProtected');
    else{
      try{compilePrivateConstraint(row.value,simpleContract(row,i));stats.compile.ok++;inc(f,'compileOk');}
      catch(e){stats.compile.error++;inc(f,'compileError');inc(stats.compile.byField,row.key);inc(stats.compile.byDomain,domain);inc(f,`error:${e?.code||e?.name||'unknown'}`);}
    }
  });
}
function top(obj,n=40){return Object.entries(obj).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);}
const report={
  datasetSha256:sha,
  p1Cases:stats.n,
  targetCoverage:{
    protectedTargets:stats.protectedTargets,
    protectedRepresentedCandidate:stats.protectedTargetsRepresentedByCandidate,
    protectedRepresentedPolicyProtectedCandidate:stats.protectedTargetsRepresentedByPolicyProtectedCandidate,
    protectedHasUnprotectedCandidate:stats.protectedLeaksFromUnprotectedCandidate,
    allowedTargets:stats.allowedTargets,
    allowedRepresentedCandidate:stats.allowedTargetsRepresentedByCandidate,
    allowedRepresentedUnprotectedCandidate:stats.allowedTargetsRepresentedByUnprotectedCandidate,
    allowedNoCandidate:stats.allowedMissesNoCandidate,
    allowedOnlyProtectedCandidate:stats.allowedMissesProtectedCandidateOnly
  },
  compile:{ok:stats.compile.ok,error:stats.compile.error,topErrorFields:top(stats.compile.byField),byDomain:stats.compile.byDomain},
  topFieldsByProtectedLeakPath:top(Object.fromEntries(Object.entries(stats.field).map(([k,v])=>[k,v.protectedTargetViaUnprotectedField||0]))),
  topFieldsByAllowedTargetMatch:top(Object.fromEntries(Object.entries(stats.field).map(([k,v])=>[k,v.allowedTargetMatches||0]))),
  domains:stats.domain,
  attacks:stats.attack
};
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('research/polar-p1/out',{recursive:true});
fs.writeFileSync('research/polar-p1/out/development-diagnostics.json',JSON.stringify(report,null,2)+'\n');
