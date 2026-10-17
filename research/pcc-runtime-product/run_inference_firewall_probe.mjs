#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

function candidatesFor(target,observed){
  const values=[];
  for(let value=0;value<=1023;value++){
    const pair=[value>=target,value<=target];
    if(pair[0]===observed[0]&&pair[1]===observed[1]) values.push(value);
  }
  return values;
}

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-inference-'));
try{
  const kernel=new ContextKernel({dir,passphrase:'pcc inference firewall probe'});
  const secret=500,target=500,domain={type:'integer',min:0,max:1023};
  kernel.put('finance.balance',secret,{label:'Private balance',category:'finance',tags:['finance','balance'],domain});

  const trajectory=kernel.beginTrajectory({purpose:'native identifying control',maxBits:2,sinkMaxBits:2});
  const native=kernel.run({
    trajectoryId:trajectory.trajectoryId,agent:'probe-agent',sink:'model.example',
    program:{kind:'predicate',private:'finance.balance',op:'eq',value:target}
  });

  for(const [id,operator,label] of [
    ['finance.at-least-target','gte','Balance at least target'],
    ['finance.at-most-target','lte','Balance at most target']
  ]) kernel.registerConstraintContract({
    id,privateRef:{category:'finance'},
    extractor:{kind:'number',min:0,max:1023},
    release:{op:'compare',label,operator,arg:target,trueLabel:'yes',falseLabel:'no'}
  });

  const before=kernel.partitionExposure();
  const prepared=kernel.prepareConstraintReleaseBundle({
    contractIds:['finance.at-least-target','finance.at-most-target'],maxBits:2,
    task:'check bounded finance constraints',agent:'probe-agent',sink:'model.example',purpose:'finance eligibility'
  });
  kernel.approveConstraintReleaseBundle(prepared.bundleId);
  const released=kernel.consumeConstraintReleaseBundle({bundleId:prepared.bundleId,agent:'probe-agent',sink:'model.example'});
  const observed=released.constraints.map(row=>row.value);
  const inferred=candidatesFor(target,observed);
  const after=kernel.partitionExposure();

  const checks={
    native_denied:native.decision==='deny'&&!Object.hasOwn(native,'result'),
    native_identifying:native.partition?.afterCandidates===1&&native.partition?.totalKnowledgeBits>=9.999,
    pcc_released_identifying_vector:released.decision==='allow'&&observed.length===2&&observed.every(Boolean),
    independent_exact_reconstruction:inferred.length===1&&inferred[0]===secret,
    pcc_left_partition_unchanged:before[0]?.remainingCandidates===1024&&after[0]?.remainingCandidates===1024
  };
  const result={
    study:'PCC inference-firewall differential probe',domain,secret,target,
    native:{decision:native.decision,reason:native.reason,hasResult:Object.hasOwn(native,'result'),partition:native.partition},
    pcc:{decision:released.decision,observed,capacityBits:released.capacityBits,inferredCandidates:inferred,partitionBefore:before,partitionAfter:after},
    checks,
    security_consistency_gate:(native.decision===released.decision)&&after[0]?.remainingCandidates===1?'PASS':'FAIL'
  };
  const canonical=JSON.stringify(result);
  result.evidence_sha256=crypto.createHash('sha256').update(canonical).digest('hex');
  const rendered=JSON.stringify(result,null,2)+'\n';
  const outputIndex=process.argv.indexOf('--output');
  if(outputIndex>=0) fs.writeFileSync(process.argv[outputIndex+1],rendered);
  process.stdout.write(rendered);
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
