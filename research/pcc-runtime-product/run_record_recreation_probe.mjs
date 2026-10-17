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
      id:`finance.${suffix}`,
      privateRef:{category:'finance'},
      extractor:{kind:'number',min:0,max:1023,integer:true},
      release:{op:'compare',label:suffix,operator,arg:500}
    });
  }
}

function run(mode){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-record-${mode}-`));
  const passphrase=`record lifecycle ${mode}`;
  try{
    let kernel=new ContextKernel({dir,passphrase,now:()=>1_800_000_000_000});
    const initial=kernel.put('finance.balance',500,{category:'finance',domain});
    register(kernel);
    const first=kernel.prepareConstraintRelease({contractId:'finance.lower',agent:'probe',sink:'model.example'});
    kernel.approveConstraintRelease(first.releaseId);
    const firstReleased=kernel.consumeConstraintRelease({releaseId:first.releaseId,agent:'probe',sink:'model.example'});

    let current=initial;
    if(mode==='in-place-update') current=kernel.put('finance.balance',500,{category:'finance',domain});
    if(mode==='remove-recreate'){
      kernel.remove('finance.balance');
      current=kernel.put('finance.balance',500,{category:'finance',domain});
    }
    kernel=new ContextKernel({dir,passphrase,now:()=>1_800_000_000_000});
    const second=kernel.prepareConstraintRelease({contractId:'finance.upper',agent:'probe',sink:'model.example'});
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
      storageIdentityPreserved:initial.id===current.id,
      firstReleased:{decision:firstReleased.decision,value:firstReleased.constraint?.value??null},
      secondPrepared:{decision:second.decision,derivedDisclosure:second.derivedDisclosure},
      secondReleased,
      jointInference:{candidateCount:jointCandidates.length,recoveredValue:jointCandidates.length===1?jointCandidates[0]:null}
    };
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

const unchanged=run('unchanged');
const inPlaceUpdate=run('in-place-update');
const removeRecreate=run('remove-recreate');
const allDeny=[unchanged,inPlaceUpdate,removeRecreate].every(row=>row.secondPrepared.decision==='deny');
const result={
  study:'PCC structural-identity lifecycle differential',
  domain,
  secret:500,
  conditions:{unchanged,inPlaceUpdate,removeRecreate},
  gates:{all_lifecycle_paths_deny_identifying_second_predicate:allDeny},
  verdict:allDeny?'PASS':'FAIL'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
