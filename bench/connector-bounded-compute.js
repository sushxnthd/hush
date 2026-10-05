import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';

const PER_FAMILY=40;

function tempKernel(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-bounded-bench-'));
  return {
    kernel:new ContextKernel({dir,passphrase:'connector bounded compute benchmark passphrase'}),
    close:()=>fs.rmSync(dir,{recursive:true,force:true})
  };
}

function runQuery(kernel,{task,privateRef,privateField,op,value,oracle,secretMarkers,rawRecord}){
  const trajectory=kernel.beginTrajectory({purpose:'bounded connector benchmark',maxBits:2,sinkMaxBits:2});
  const out=kernel.runSemantic({
    trajectoryId:trajectory.trajectoryId,
    agent:'benchmark-agent',sink:'model.example',task,
    program:{kind:'predicate',privateRef,privateField,op,value}
  });
  if(out.decision!=='allow') throw new Error(`Unexpected bounded-compute decision: ${out.decision}`);
  const wire=JSON.stringify(out);
  const rawWire=JSON.stringify(rawRecord);
  return {
    correct:out.result===oracle,
    hushLeak:secretMarkers.some(marker=>wire.includes(String(marker))),
    rawLeak:secretMarkers.some(marker=>rawWire.includes(String(marker))),
    pathLeak:wire.includes('connector.'),
    outputBytes:Buffer.byteLength(wire),
    rawBytes:Buffer.byteLength(rawWire)
  };
}

const rows=[];

{
  const {kernel,close}=tempKernel();
  try{
    const items=Array.from({length:PER_FAMILY},(_,i)=>({
      id:`m-${i}`,subject:`Admissions update ${i}`,
      from:i%2===0?'admissions@example.edu':'newsletter@example.net',
      to:`student${i}@example.com`,date:`2026-10-${String((i%28)+1).padStart(2,'0')}T09:00:00Z`,
      snippet:'Status update',body:`GMAIL_PRIVATE_BODY_${i}_ZXQ`,labelIds:['INBOX']
    }));
    kernel.ingestConnectorSnapshot({provider:'gmail',collection:'messages',items});
    for(let i=0;i<items.length;i++){
      const item=items[i];
      rows.push({family:'gmail',...runQuery(kernel,{
        task:`Check whether the sender of Admissions update ${i} is the admissions office without revealing the email record.`,
        privateRef:{query:item.subject},privateField:'from',op:'eq',value:'admissions@example.edu',
        oracle:item.from==='admissions@example.edu',secretMarkers:[item.body,item.to],rawRecord:item
      })});
    }
  }finally{ close(); }
}

{
  const {kernel,close}=tempKernel();
  try{
    const items=Array.from({length:PER_FAMILY},(_,i)=>({
      id:`e-${i}`,summary:`Study session ${i}`,
      description:`CAL_PRIVATE_DESC_${i}_QPL`,location:i%3===0?'Room 101':'Lab 2',
      start:{dateTime:`2026-10-${String((i%28)+1).padStart(2,'0')}T17:00:00+05:30`},
      end:{dateTime:`2026-10-${String((i%28)+1).padStart(2,'0')}T18:00:00+05:30`},
      organizer:{email:`organizer${i}@private.example`}
    }));
    kernel.ingestConnectorSnapshot({provider:'calendar',collection:'events',items});
    for(let i=0;i<items.length;i++){
      const item=items[i];
      rows.push({family:'calendar',...runQuery(kernel,{
        task:`Check whether Study session ${i} is in Room 101 without exposing the event details.`,
        privateRef:{query:item.summary},privateField:'location',op:'eq',value:'Room 101',
        oracle:item.location==='Room 101',secretMarkers:[item.description,item.organizer.email],rawRecord:item
      })});
    }
  }finally{ close(); }
}

{
  const {kernel,close}=tempKernel();
  try{
    const items=Array.from({length:PER_FAMILY},(_,i)=>({
      id:`f-${i}`,name:`Research note ${i}.pdf`,mimeType:'application/pdf',
      modifiedTime:`2026-10-${String((i%28)+1).padStart(2,'0')}T12:00:00Z`,
      owners:[{displayName:`Private Owner ${i}`,emailAddress:`owner${i}@private.example`}],
      webViewLink:`https://drive.example/private/${i}`,description:`DRIVE_PRIVATE_DESC_${i}_KLM`
    }));
    kernel.ingestConnectorSnapshot({provider:'drive',collection:'files',items});
    const threshold='2026-10-15T00:00:00Z';
    for(let i=0;i<items.length;i++){
      const item=items[i];
      rows.push({family:'drive',...runQuery(kernel,{
        task:`Check whether Research note ${i}.pdf was modified before October 15 without revealing its metadata.`,
        privateRef:{query:item.name},privateField:'modifiedTime',op:'lt',value:threshold,
        oracle:item.modifiedTime<threshold,secretMarkers:[item.description,item.owners[0].emailAddress,item.webViewLink],rawRecord:item
      })});
    }
  }finally{ close(); }
}

{
  const {kernel,close}=tempKernel();
  try{
    const items=Array.from({length:PER_FAMILY},(_,i)=>({
      id:10_000+i,name:`private-repo-${i}`,full_name:`hush-labs/private-repo-${i}`,
      private:true,stargazers_count:i,description:`GITHUB_PRIVATE_DESC_${i}_RST`,
      ssh_url:`git@private.example:hush-labs/private-repo-${i}.git`,topics:['research']
    }));
    kernel.ingestConnectorSnapshot({provider:'github',collection:'repos',items});
    for(let i=0;i<items.length;i++){
      const item=items[i];
      rows.push({family:'github',...runQuery(kernel,{
        task:`Check whether ${item.full_name} has more than 20 stars without exposing repository metadata.`,
        privateRef:{query:item.full_name},privateField:'stargazers_count',op:'gt',value:20,
        oracle:item.stargazers_count>20,secretMarkers:[item.description,item.ssh_url],rawRecord:item
      })});
    }
  }finally{ close(); }
}

const total=rows.length;
const correct=rows.filter(r=>r.correct).length;
const hushLeaks=rows.filter(r=>r.hushLeak).length;
const rawLeaks=rows.filter(r=>r.rawLeak).length;
const pathLeaks=rows.filter(r=>r.pathLeak).length;
const mean=(key)=>rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
const byFamily=Object.fromEntries([...new Set(rows.map(r=>r.family))].map(family=>{
  const xs=rows.filter(r=>r.family===family);
  return [family,{
    n:xs.length,utility:xs.filter(r=>r.correct).length/xs.length,
    hushLeakRate:xs.filter(r=>r.hushLeak).length/xs.length,
    rawLeakRate:xs.filter(r=>r.rawLeak).length/xs.length
  }];
}));

const report={
  total,
  utility:correct/total,
  hushExactSecretExposureRate:hushLeaks/total,
  rawRecordSecretExposureRate:rawLeaks/total,
  connectorPathExposureRate:pathLeaks/total,
  meanHushOutputBytes:mean('outputBytes'),
  meanRawRecordBytes:mean('rawBytes'),
  byFamily
};

console.log('\nConnector-backed bounded computation benchmark');
console.table({
  hush:{utility:report.utility,secretExposure:report.hushExactSecretExposureRate,pathExposure:report.connectorPathExposureRate,meanBytes:report.meanHushOutputBytes},
  raw_record:{utility:1,secretExposure:report.rawRecordSecretExposureRate,pathExposure:null,meanBytes:report.meanRawRecordBytes}
});
console.log(JSON.stringify(report,null,2));

if(total!==PER_FAMILY*4) throw new Error(`Expected ${PER_FAMILY*4} tasks, got ${total}`);
if(report.utility!==1) throw new Error(`Bounded connector utility regressed: ${report.utility}`);
if(report.hushExactSecretExposureRate!==0) throw new Error('Hush output exposed an unrelated exact private connector value');
if(report.connectorPathExposureRate!==0) throw new Error('Hush output exposed a private connector path');
if(report.rawRecordSecretExposureRate!==1) throw new Error('Raw-record comparator should expose benchmark private markers');

console.log(`Hush completed ${correct}/${total} connector-backed decisions with 0 exact benchmark-secret or connector-path exposures.`);
