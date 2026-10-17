import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';
import {normalizeConnectorSnapshot} from '../../src/connectors.js';

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

function snapshot(id,{includePrivacyKey=true}={}){
  return {provider:'generic',collection:'budgets',replace:true,items:[{
    id,...(includePrivacyKey?{privacyKey:'travel-budget'}:{}),
    label:'Travel budget',category:'finance',value:500,domain
  }]};
}

function compositionCondition(rotated){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-privacy-key-${rotated?'rotated':'stable'}-`));
  const passphrase=`privacy key ${rotated?'rotated':'stable'}`;
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
    return {
      connectorPathChanged:secondSync.created===1&&secondSync.removed===1,
      firstSync:{created:firstSync.created,updated:firstSync.updated,removed:firstSync.removed},
      secondSync:{created:secondSync.created,updated:secondSync.updated,removed:secondSync.removed},
      firstReleased:{decision:firstReleased.decision,value:firstReleased.constraint?.value??null},
      secondPrepared:{decision:second.decision,derivedDisclosure:second.derivedDisclosure},
      secondReleased:null
    };
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

function missingKeyCondition(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-privacy-key-missing-'));
  try{
    const kernel=new ContextKernel({dir,passphrase:'missing privacy key',now:()=>1_800_000_000_000});
    kernel.ingestConnectorSnapshot(snapshot('budget-a',{includePrivacyKey:false}));
    register(kernel);
    try{
      kernel.prepareConstraintRelease({contractId:'connector.finance.lower',agent:'probe',sink:'model.example'});
      return {rejected:false,error:null};
    }catch(error){
      return {rejected:true,error:String(error.message)};
    }
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

function duplicateKeyCondition(){
  try{
    normalizeConnectorSnapshot({provider:'generic',collection:'budgets',items:[
      {id:'budget-a',privacyKey:'travel-budget',value:500},
      {id:'budget-b',privacyKey:'travel-budget',value:501}
    ]});
    return {rejected:false,error:null};
  }catch(error){
    return {rejected:true,error:String(error.message)};
  }
}

const stableId=compositionCondition(false);
const rotatedId=compositionCondition(true);
const missingKey=missingKeyCondition();
const duplicateKey=duplicateKeyCondition();
const gates={
  stable_and_rotated_id_deny_identifying_second_predicate:[stableId,rotatedId].every(row=>row.secondPrepared.decision==='deny'),
  missing_privacy_key_fails_closed:missingKey.rejected,
  duplicate_privacy_key_fails_closed:duplicateKey.rejected
};
const result={
  study:'PCC durable connector privacy-key correction',
  domain,
  secret:500,
  conditions:{stableId,rotatedId,missingKey,duplicateKey},
  gates,
  verdict:Object.values(gates).every(Boolean)?'PASS':'FAIL'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
