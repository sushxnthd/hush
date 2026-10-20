import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../../src/core.js';

const here=fileURLToPath(import.meta.url);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

if(process.argv[2]==='--worker'){
  const [, , , dir, workerId]=process.argv;
  const store=new Store(dir);
  fs.writeFileSync(path.join(dir,`ready-${workerId}`),'ready');
  while(!fs.existsSync(path.join(dir,'go'))) await sleep(2);
  store.addReceipt({v:1,workerId,kind:'concurrent-probe'});
  process.exit(0);
}

async function runWorker(dir,id){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[here,'--worker',dir,id],{stdio:['ignore','pipe','pipe']});
    let stderr='';
    child.stderr.on('data',chunk=>{stderr+=chunk});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`worker ${id} exited ${code}: ${stderr}`)));
  });
}

async function concurrentRound(round){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-stream-writer-${round}-`));
  try{
    new Store(dir); // create the protected root before process contention
    const workers=[runWorker(dir,'a'),runWorker(dir,'b')];
    while(!fs.existsSync(path.join(dir,'ready-a'))||!fs.existsSync(path.join(dir,'ready-b'))) await sleep(2);
    fs.writeFileSync(path.join(dir,'go'),'go');
    await Promise.all(workers);
    let parsed=null;
    let validJson=true;
    try{parsed=JSON.parse(fs.readFileSync(path.join(dir,'receipts.json'),'utf8'))}
    catch{validJson=false;parsed=[]}
    return {round,validJson,durableReceipts:parsed.length,distinctWorkers:new Set(parsed.map(x=>x.workerId)).size};
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

function sequentialControl(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-stream-writer-control-'));
  try{
    const store=new Store(dir);
    store.addReceipt({v:1,workerId:'a',kind:'sequential-control'});
    store.addReceipt({v:1,workerId:'b',kind:'sequential-control'});
    const parsed=JSON.parse(fs.readFileSync(path.join(dir,'receipts.json'),'utf8'));
    return {validJson:true,durableReceipts:parsed.length,distinctWorkers:new Set(parsed.map(x=>x.workerId)).size};
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

const outputPath=process.argv[2]??path.join(path.dirname(here),'mcp_stream_single_writer_result.json');
const rounds=[];
for(let round=0;round<100;round++) rounds.push(await concurrentRound(round));
const result={
  protocol:'mcp-stream-single-writer-boundary-v1',
  rounds:rounds.length,
  concurrent:{
    validJsonRounds:rounds.filter(x=>x.validJson).length,
    bothReceiptsDurable:rounds.filter(x=>x.durableReceipts===2).length,
    lostUpdateRounds:rounds.filter(x=>x.validJson&&x.durableReceipts===1&&x.distinctWorkers===1).length,
    observedDurableCounts:[...new Set(rounds.map(x=>x.durableReceipts))].sort((a,b)=>a-b)
  },
  sequential:sequentialControl(),
  scientificGate:rounds.every(x=>x.validJson&&x.durableReceipts===1&&x.distinctWorkers===1)?'FAIL_MULTI_WRITER_APPEND':'PREDICTION_REJECTED',
  smallestClaim:'Whole-file atomic replacement prevents torn JSON but does not make Store.addReceipt an atomic multi-process append.'
};
fs.writeFileSync(outputPath,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
