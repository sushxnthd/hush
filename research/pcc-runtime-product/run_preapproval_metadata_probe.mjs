import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const domain={type:'integer',min:0,max:1023};

function kernelFor(secret,suffix){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-preapproval-${suffix}-`));
  const kernel=new ContextKernel({dir,passphrase:`preapproval metadata probe ${suffix}`,now:()=>1_800_000_000_000});
  kernel.put('finance.balance',secret,{category:'finance',domain});
  return kernel;
}

function register(kernel,{id,operator,arg,trueLabel='yes',falseLabel='no'}){
  kernel.registerConstraintContract({
    id,privateRef:{category:'finance'},
    extractor:{kind:'number',min:domain.min,max:domain.max,integer:true},
    release:{op:'compare',label:`Public predicate ${id}`,operator,arg,trueLabel,falseLabel}
  });
}

function publicChannel(metadata){
  return {
    decision:metadata.decision,
    outputBytes:metadata.outputBytes??null,
    beforeCandidates:metadata.inferenceProtection?.beforeCandidates??null,
    afterCandidates:metadata.inferenceProtection?.afterCandidates??null,
    totalKnowledgeBits:metadata.inferenceProtection?.totalKnowledgeBits??null,
    maxKnowledgeBits:metadata.inferenceProtection?.maxKnowledgeBits??null
  };
}

// Channel 1: unequal branch cardinalities expose a realized comparison.
const countKernel=kernelFor(500,'count');
register(countKernel,{id:'finance.count',operator:'gte',arg:500,trueLabel:'yes',falseLabel:'nay'});
const countMetadata=publicChannel(countKernel.prepareConstraintRelease({
  contractId:'finance.count',agent:'adversarial-agent',sink:'model.example'
}));
const countInference=countMetadata.afterCandidates===524;

// Channel 2: a balanced partition removes the count signal. Unequal labels
// leave serialized size as an independent pre-approval signal.
const sizeKernel=kernelFor(700,'size');
register(sizeKernel,{id:'finance.size',operator:'gte',arg:512,trueLabel:'x',falseLabel:'xxxxxxxxxxxxxxxxxxxxxxxx'});
const sizeMetadata=publicChannel(sizeKernel.prepareConstraintRelease({
  contractId:'finance.size',agent:'adversarial-agent',sink:'model.example'
}));
const falseReferenceKernel=kernelFor(300,'size-reference');
register(falseReferenceKernel,{id:'finance.size',operator:'gte',arg:512,trueLabel:'x',falseLabel:'xxxxxxxxxxxxxxxxxxxxxxxx'});
const falseSizeMetadata=publicChannel(falseReferenceKernel.prepareConstraintRelease({
  contractId:'finance.size',agent:'adversarial-agent',sink:'model.example'
}));
const sizeInference=sizeMetadata.afterCandidates===falseSizeMetadata.afterCandidates
  && sizeMetadata.outputBytes!==null
  && falseSizeMetadata.outputBytes!==null
  && sizeMetadata.outputBytes!==falseSizeMetadata.outputBytes;

// Channel 3: bundle metadata publishes the realized intersection size.
const bundleKernel=kernelFor(200,'bundle');
register(bundleKernel,{id:'finance.at-least-100',operator:'gte',arg:100});
register(bundleKernel,{id:'finance.at-most-399',operator:'lte',arg:399});
const bundleMetadata=publicChannel(bundleKernel.prepareConstraintReleaseBundle({
  contractIds:['finance.at-least-100','finance.at-most-399'],maxBits:2,
  agent:'adversarial-agent',sink:'model.example'
}));
const bundleInference=bundleMetadata.afterCandidates===300;

const gates={
  no_approval_or_consumption:true,
  realized_count_does_not_reveal_result:!countInference,
  serialized_size_does_not_reveal_result:!sizeInference,
  bundle_metadata_does_not_reveal_result:!bundleInference
};
const result={
  study:'PCC pre-approval metadata disclosure probe',domain,
  countChannel:{metadata:countMetadata,inferredTrue:countInference,actual:true},
  sizeChannel:{trueMetadata:sizeMetadata,falseReferenceMetadata:falseSizeMetadata,inferredTrue:sizeInference,actual:true},
  bundleChannel:{metadata:bundleMetadata,inferredResults:bundleInference?[true,true]:null,actual:[true,true]},
  gates,
  verdict:Object.values(gates).every(Boolean)?'PASS':'FAIL'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
