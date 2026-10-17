import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const domain={type:'integer',min:0,max:1023};

function observe(secondValue,label){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-ledger-cardinality-${label}-`));
  try{
    const kernel=new ContextKernel({dir,passphrase:`ledger cardinality ${label}`,now:()=>1_800_000_000_000});
    for(const [suffix,value] of [['a',500],['b',secondValue]]){
      kernel.put(`finance.${suffix}`,value,{category:`finance-${suffix}`,domain});
      kernel.registerConstraintContract({
        id:`finance.${suffix}.lower-half`,privateRef:{category:`finance-${suffix}`},
        extractor:{kind:'number',min:0,max:1023,integer:true},
        release:{op:'compare',label:`Private value ${suffix} in lower half`,operator:'lte',arg:511}
      });
      kernel.prepareConstraintRelease({contractId:`finance.${suffix}.lower-half`,agent:'diagnostic-agent',sink:'model.example'});
    }
    const rows=kernel.partitionExposure().filter(row=>row.field==='pcc:derived');
    return {publicLedgerRows:rows.length,rows};
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

const equalWorld=observe(500,'equal');
const unequalWorld=observe(501,'unequal');
const differs=JSON.stringify(equalWorld)!==JSON.stringify(unequalWorld);
const result={
  study:'PCC public ledger-cardinality equality differential',
  domain,
  equalWorld:{privateRelation:'equal',observation:equalWorld},
  unequalWorld:{privateRelation:'unequal',observation:unequalWorld},
  adversaryInference:differs?'one row implies equality; two rows imply inequality':null,
  gates:{zero_approvals:true,zero_consumptions:true,public_diagnostics_relation_independent:!differs},
  verdict:differs?'FAIL':'PASS'
};
const serialized=JSON.stringify(result,null,2)+'\n';
if(output) fs.writeFileSync(output,serialized);
process.stdout.write(serialized);
