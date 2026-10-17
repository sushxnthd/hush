import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const domain={type:'integer',min:0,max:1023};
const agent='standing-consent-agent',sink='model.example';

function observe(secret,label){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-selective-refusal-${label}-`));
  try{
    const kernel=new ContextKernel({dir,passphrase:`selective refusal ${label}`,now:()=>1_800_000_000_000});
    kernel.put('finance.balance',secret,{category:'finance',domain});
    kernel.registerConstraintContract({
      id:'finance.exact-guess',privateRef:{category:'finance'},
      extractor:{kind:'number',min:0,max:1023,integer:true},
      release:{op:'compare',label:'Private balance equals public guess',operator:'eq',arg:500}
    });
    kernel.setConsentRule({mode:'always',capability:'context.compute',agent,sink,category:'finance'});
    const prepared=kernel.prepareConstraintRelease({contractId:'finance.exact-guess',agent,sink});
    let consumed=null,error=null;
    if(prepared.decision==='approved'){
      try{
        const result=kernel.consumeConstraintRelease({releaseId:prepared.releaseId,agent,sink});
        consumed={decision:result.decision,constraintValue:result.constraint?.value??null,derivedDisclosure:result.derivedDisclosure??result.receipt?.derivedDisclosure??null};
      }catch(cause){ error=String(cause?.message||cause); }
    }
    return {prepared:{decision:prepared.decision},consumed,error};
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

const equalWorld=observe(500,'equal');
const unequalWorld=observe(501,'unequal');
const transcriptDiffers=JSON.stringify(equalWorld)!==JSON.stringify(unequalWorld);
const result={
  study:'PCC standing-consent selective-refusal differential',
  domain,publicGuess:500,
  equalWorld:{actualEquality:true,transcript:equalWorld},
  unequalWorld:{actualEquality:false,transcript:unequalWorld},
  adversaryInference:transcriptDiffers?'privacy denial identifies true; allowed false constraint identifies false':null,
  gates:{no_new_human_interaction:true,public_transcript_result_independent:!transcriptDiffers},
  verdict:transcriptDiffers?'FAIL':'PASS'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
