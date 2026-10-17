import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const domain={type:'integer',min:0,max:1023};

function register(kernel){
  for(const [suffix,operator] of [['lower','gte'],['upper','lte']]){
    kernel.registerConstraintContract({
      id:`connector.finance.${suffix}`,
      privateRef:{category:'finance'},
      extractor:{kind:'number',min:0,max:1023,integer:true},
      release:{op:'compare',label:suffix,operator,arg:500}
    });
  }
}

function snapshot(id){
  return {provider:'generic',collection:'budgets',replace:true,items:[{
    id,label:'Travel budget',category:'finance',value:500,domain
  }]};
}

function run(rotated){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-connector-${rotated?'rotated':'stable'}-`));
  const passphrase=`connector id ${rotated?'rotated':'stable'}`;
  try{
    let kernel=new ContextKernel({dir,passphrase,now:()=>1_800_000_000_000});
    const firstSync=kernel.ingestConnectorSnapshot(snapshot('budget-a'));
    register(kernel);
    const first=kernel.prepareConstraintRelease({contractId:'connector.finance.lower',agent:'probe',sink:'model.example'});
    kernel.approveConstraintRelease(first.releaseId);
    const firstReleased=kernel.consumeConstraintRelease({releaseId:first.releaseId,agent:'probe',sink:'model.example'});
    const secondSync=kernel.ingestConnectorSnapshot(snapshot(rotated?'budget-b':'budget-a'));
    kernel=new ContextKernel({dir,passphrase,now:()=>1_800_000_000_000});
    const second=kernel.prepareConstraintRelease({contractId:'connector.finance.upper',agent:'probe',sink:'model.example'});
    let secondReleased=null;
    if(second.decision==='ask'){
      kernel.approveConstraintRelease(second.releaseId);
      const released=kernel.consumeConstraintRelease({releaseId:second.releaseId,agent:'probe',sink:'model.example'});
      secondReleased={decision:released.decision,value:released.constraint?.value??null};
    }
    const jointCandidates=[];
    if(firstReleased.constraint?.value===true&&secondReleased?.value===true){
      for(let value=domain.min;value<=domain.max;value++) if(value>=500&&value<=500) jointCandidates.push(value);
    }
    return {
      connectorPathChanged:secondSync.created===1&&secondSync.removed===1,
      firstSync:{created:firstSync.created,updated:firstSync.updated,removed:firstSync.removed},
      secondSync:{created:secondSync.created,updated:secondSync.updated,removed:secondSync.removed},
      firstReleased:{decision:firstReleased.decision,value:firstReleased.constraint?.value??null},
      secondPrepared:{decision:second.decision,derivedDisclosure:second.derivedDisclosure},
      secondReleased,
      jointInference:{candidateCount:jointCandidates.length,recoveredValue:jointCandidates.length===1?jointCandidates[0]:null}
    };
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

const stableId=run(false);
const rotatedId=run(true);
const allDeny=[stableId,rotatedId].every(row=>row.secondPrepared.decision==='deny');
const result={
  study:'PCC connector source-ID rotation differential',
  domain,
  secret:500,
  conditions:{stableId,rotatedId},
  gates:{stable_and_rotated_id_deny_identifying_second_predicate:allDeny},
  verdict:allDeny?'PASS':'FAIL'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
