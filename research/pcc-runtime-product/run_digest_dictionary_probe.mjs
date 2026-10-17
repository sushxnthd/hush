import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const secret=500;
const domain={type:'integer',min:0,max:1023};

function canonicalize(value){
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}
function sha256(value){ return crypto.createHash('sha256').update(value).digest('hex'); }

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-digest-dictionary-'));
const kernel=new ContextKernel({dir,passphrase:'digest dictionary probe'});
kernel.put('finance.balance',secret,{category:'finance',domain});
kernel.registerConstraintContract({
  id:'finance.lower',privateRef:{category:'finance'},
  extractor:{kind:'number',min:domain.min,max:domain.max,integer:true},
  release:{op:'compare',label:'Balance at least 400',operator:'gte',arg:400}
});
const prepared=kernel.prepareConstraintRelease({contractId:'finance.lower',agent:'local-companion',sink:'model.example'});
kernel.approveConstraintRelease(prepared.releaseId);
kernel.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'local-companion',sink:'model.example'});

// From here onward, use only the public diagnostic footprint.
const publicFootprint=kernel.partitionExposure();
const exposed=publicFootprint.find(row=>String(row.field).startsWith('pcc:'))?.field??null;
const matches=[];
if(exposed){
  const target=String(exposed).slice(4);
  for(let value=domain.min;value<=domain.max;value++){
    if(sha256(canonicalize({kind:'number',value}))===target) matches.push(value);
  }
}
const gates={
  pcc_identifier_exposed:Boolean(exposed),
  dictionary_uniquely_recovers_secret:matches.length===1&&matches[0]===secret,
  diagnostic_non_disclosure:!(matches.length===1&&matches[0]===secret)
};
const result={study:'PCC diagnostic digest dictionary probe',domain,secret,
  publicFootprint,enumeratedCandidates:domain.max-domain.min+1,matches,gates,
  verdict:gates.diagnostic_non_disclosure?'PASS':'FAIL'};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
