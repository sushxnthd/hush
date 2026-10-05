import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';

const PER_FAMILY=40;

function withKernel(fn){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-bounded-bench-'));
  try{
    const kernel=new ContextKernel({dir,passphrase:'connector bounded compute benchmark passphrase'});
    return fn(kernel);
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

function runBounded(kernel,{snapshot,task,privateRef,privateField,op,value,oracle,secretMarkers}){
  kernel.ingestConnectorSnapshot(snapshot);
  const trajectory=kernel.beginTrajectory({purpose:'bounded connector benchmark',maxBits:2,sinkMaxBits:2});
  const out=kernel.runSemantic({
    trajectoryId:trajectory.trajectoryId,
    agent:'benchmark-agent',sink:'model.example',task,
    program:{kind:'predicate',privateRef,privateField,op,value}
  });
  if(out.decision!=='allow') throw new Error(`Unexpected bounded-compute decision: ${out.decision}`);
  const wire=JSON.stringify(out);
  const leaked=secretMarkers.some(marker=>wire.includes(String(marker)));
  return {correct:out.result===oracle,leaked,wire};
}

const rows=[];
for(let i=0;i<PER_FAMILY;i++){
  const gmail={provider:'gmail',collection:'messages',items:[{
    id:`m-${i}`,subject:`Admissions update ${i}`,from:i%2===0?'admissions@example.edu':'newsletter@example.net',
    to:`student${i}@example.com`,date:`2026-10-${String((i%28)+1).padStart(2,'0')}T09:00:00Z`,
    snippet:'Status update',body:`GMAIL_PRIVATE_BODY_${i}_ZXQ`,labelIds:['INBOX']
  }]};
  rows.push({family:'gmail',raw:JSON.stringify(gmail),markers:[`GMAIL_PRIVATE_BODY_${i}_ZXQ`,`student${i}@example.com`],...runBounded(withKernel(k=>k),{})})
}
