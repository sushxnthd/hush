import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const secret=500;
const target=500;
const domain={type:'integer',min:0,max:1023};
const agent='extractor-alias-probe';
const sink='model.example';

function candidates(observations){
  const values=[];
  for(let value=domain.min;value<=domain.max;value++){
    if(observations.every(row=>row.operator==='gte'?(value>=row.arg)===row.result:(value<=row.arg)===row.result)) values.push(value);
  }
  return values;
}

function run(alias){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-alias-${alias?'alias':'control'}-`));
  const kernel=new ContextKernel({dir,passphrase:'extractor alias composition probe'});
  kernel.put('finance.balance',secret,{category:'finance',domain});
  const common={kind:'number',min:domain.min,max:domain.max,integer:true};
  const extractors=[common,alias?{...common,anchors:['balance']}:common];
  const definitions=[['lower','gte'],['upper','lte']];
  for(let i=0;i<definitions.length;i++){
    const [suffix,operator]=definitions[i];
    kernel.registerConstraintContract({
      id:`finance.${suffix}`,
      privateRef:{category:'finance'},
      extractor:extractors[i],
      release:{op:'compare',label:`Balance ${operator} ${target}`,operator,arg:target}
    });
  }

  const observations=[];
  const attempts=[];
  for(const [suffix,operator] of definitions){
    const before=kernel.partitionExposure();
    try{
      const prepared=kernel.prepareConstraintRelease({contractId:`finance.${suffix}`,agent,sink,purpose:'composition probe'});
      kernel.approveConstraintRelease(prepared.releaseId);
      const released=kernel.consumeConstraintRelease({releaseId:prepared.releaseId,agent,sink});
      observations.push({operator,arg:target,result:released.constraint.value});
      attempts.push({operator,decision:'allow',result:released.constraint.value,receipt:released.receipt.inferenceProtection,before,after:kernel.partitionExposure()});
    }catch(error){
      attempts.push({operator,decision:'deny',error:String(error?.message||error),before,after:kernel.partitionExposure()});
    }
  }
  const inferred=candidates(observations);
  return {alias,observations,attempts,inferredCandidates:inferred,inferredCount:inferred.length,finalPartition:kernel.partitionExposure()};
}

const control=run(false);
const intervention=run(true);
const gates={
  control_blocks_identification:control.attempts[1]?.decision==='deny'&&control.inferredCount>1,
  alias_releases_both:intervention.attempts.every(row=>row.decision==='allow'),
  alias_independently_reconstructs:intervention.inferredCount===1&&intervention.inferredCandidates[0]===secret,
  alias_splits_pcc_posteriors:intervention.finalPartition.filter(row=>String(row.field).startsWith('pcc:')).length===2,
  security_consistency:!(intervention.attempts.every(row=>row.decision==='allow')&&intervention.inferredCount===1)
};
const result={study:'PCC extractor-alias composition probe',domain,secret,target,control,intervention,gates,
  verdict:gates.security_consistency?'PASS':'FAIL'};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
