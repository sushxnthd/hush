import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const domain={type:'integer',min:0,max:1023};

function observe(secondValue,label){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-value-identity-${label}-`));
  try{
    const kernel=new ContextKernel({dir,passphrase:`value identity ${label}`,now:()=>1_800_000_000_000});
    kernel.put('finance.a',500,{category:'finance-a',domain});
    kernel.put('finance.b',secondValue,{category:'finance-b',domain});
    kernel.registerConstraintContract({
      id:'finance.a.lower',privateRef:{category:'finance-a'},
      extractor:{kind:'number',min:0,max:1023,integer:true},
      release:{op:'compare',label:'A at least 500',operator:'gte',arg:500}
    });
    kernel.registerConstraintContract({
      id:'finance.b.upper',privateRef:{category:'finance-b'},
      extractor:{kind:'number',min:0,max:1023,integer:true},
      release:{op:'compare',label:'B at most 501',operator:'lte',arg:501}
    });
    const first=kernel.prepareConstraintRelease({contractId:'finance.a.lower',agent:'probe',sink:'model.example'});
    kernel.approveConstraintRelease(first.releaseId);
    const released=kernel.consumeConstraintRelease({releaseId:first.releaseId,agent:'probe',sink:'model.example'});
    const second=kernel.prepareConstraintRelease({contractId:'finance.b.upper',agent:'probe',sink:'model.example'});
    return {
      firstReleased:{decision:released.decision,value:released.constraint?.value??null},
      secondPrepared:{decision:second.decision,derivedDisclosure:second.derivedDisclosure}
    };
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

const equalWorld=observe(500,'equal');
const unequalWorld=observe(501,'unequal');
const differs=JSON.stringify(equalWorld)!==JSON.stringify(unequalWorld);
const result={
  study:'PCC value-derived identity authorization differential',
  domain,
  equalWorld:{privateRelation:'equal',actualResults:[true,true],transcript:equalWorld},
  unequalWorld:{privateRelation:'unequal',actualResults:[true,true],transcript:unequalWorld},
  adversaryInference:differs?'second denial implies equality; second ask implies inequality':null,
  gates:{identical_released_results:true,second_decision_relation_independent:!differs},
  verdict:differs?'FAIL':'PASS'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
