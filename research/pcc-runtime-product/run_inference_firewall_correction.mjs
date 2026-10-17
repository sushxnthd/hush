#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-inference-correction-'));
try{
  const kernel=new ContextKernel({dir,passphrase:'pcc inference firewall correction'});
  const secret=500,target=500,domain={type:'integer',min:0,max:1023};
  kernel.put('finance.balance',secret,{label:'Private balance',category:'finance',tags:['finance','balance'],domain});
  const trajectory=kernel.beginTrajectory({purpose:'native identifying control',maxBits:2,sinkMaxBits:2});
  const native=kernel.run({trajectoryId:trajectory.trajectoryId,agent:'probe-agent',sink:'model.example',program:{kind:'predicate',private:'finance.balance',op:'eq',value:target}});

  for(const [id,operator,label] of [
    ['finance.at-least-target','gte','Balance at least target'],
    ['finance.at-most-target','lte','Balance at most target']
  ]) kernel.registerConstraintContract({
    id,privateRef:{category:'finance'},extractor:{kind:'number',min:0,max:1023,integer:true},
    release:{op:'compare',label,operator,arg:target,trueLabel:'yes',falseLabel:'no'}
  });

  const before=kernel.partitionExposure();
  let pccError='',prepared=false;
  try{
    kernel.prepareConstraintReleaseBundle({
      contractIds:['finance.at-least-target','finance.at-most-target'],maxBits:2,
      task:'check bounded finance constraints',agent:'probe-agent',sink:'model.example',purpose:'finance eligibility'
    });
    prepared=true;
  }catch(error){pccError=String(error?.message||error);}
  const after=kernel.partitionExposure();
  const derivedRows=after.filter(row=>String(row.field).startsWith('pcc:'));
  const checks={
    native_denied:native.decision==='deny'&&!Object.hasOwn(native,'result'),
    native_identifying:native.partition?.afterCandidates===1&&native.partition?.totalKnowledgeBits>=9.999,
    pcc_denied_before_approval:!prepared&&/inference firewall/.test(pccError),
    no_pcc_output_released:!prepared,
    denied_transaction_not_committed:derivedRows.length===1&&derivedRows[0].remainingCandidates===1024
  };
  const result={
    study:'PCC inference-firewall correction',domain,secret,target,
    native:{decision:native.decision,hasResult:Object.hasOwn(native,'result'),partition:native.partition},
    pcc:{prepared,error:pccError,derivedPartition:derivedRows},checks,
    security_consistency_gate:Object.values(checks).every(Boolean)?'PASS':'FAIL'
  };
  result.evidence_sha256=crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
  const rendered=JSON.stringify(result,null,2)+'\n';
  const outputIndex=process.argv.indexOf('--output');
  if(outputIndex>=0) fs.writeFileSync(process.argv[outputIndex+1],rendered);
  process.stdout.write(rendered);
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
