import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const guess=500;
const domain={type:'integer',min:0,max:1023};

function observe(secret,label){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-denial-oracle-${label}-`));
  const kernel=new ContextKernel({dir,passphrase:`denial oracle ${label}`,now:()=>1_800_000_000_000});
  kernel.put('finance.balance',secret,{category:'finance',domain});
  kernel.registerConstraintContract({
    id:'finance.exact-guess',privateRef:{category:'finance'},
    extractor:{kind:'number',min:domain.min,max:domain.max,integer:true},
    release:{op:'compare',label:'Private balance equals public guess',operator:'eq',arg:guess}
  });
  let observation;
  try{
    const prepared=kernel.prepareConstraintRelease({
      contractId:'finance.exact-guess',agent:'adversarial-agent',sink:'model.example'
    });
    observation={kind:'prepared',decision:prepared.decision};
  }catch(error){
    observation={kind:String(error?.message||'').includes('inference firewall')?'inference-denial':'other-error'};
  }
  fs.rmSync(dir,{recursive:true,force:true});
  return observation;
}

const equalWorld=observe(500,'equal');
const unequalWorld=observe(501,'unequal');
const inferredEqual=equalWorld.kind==='inference-denial'&&unequalWorld.kind==='prepared';
const gates={
  no_approval_or_consumption:true,
  preparation_observation_independent_of_private_result:!inferredEqual
};
const result={
  study:'PCC pre-approval denial-oracle differential',domain,publicGuess:guess,
  equalWorld:{observation:equalWorld,actualEquality:true},
  unequalWorld:{observation:unequalWorld,actualEquality:false},
  adversaryInference:inferredEqual?'equality is true in the denied world':null,
  gates,
  verdict:Object.values(gates).every(Boolean)?'PASS':'FAIL'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
