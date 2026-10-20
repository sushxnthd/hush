import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {acquireRuntimeLock} from '../../src/runtime-lock.js';

const here=fileURLToPath(import.meta.url);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

if(process.argv[2]==='--holder'){
  const dir=process.argv[3];
  acquireRuntimeLock(dir);
  fs.writeFileSync(path.join(dir,'holder-ready'),'ready');
  setInterval(()=>{},1000);
}else if(process.argv[2]==='--claim'){
  const [, , , dir, resultFile]=process.argv;
  try{
    const lock=acquireRuntimeLock(dir);
    fs.writeFileSync(resultFile,JSON.stringify({status:'acquired'}));
    lock.release();
  }catch(error){
    fs.writeFileSync(resultFile,JSON.stringify({status:'rejected',code:error?.code??null}));
  }
  process.exit(0);
}else{
  const runChild=(args)=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[here,...args],{stdio:['ignore','pipe','pipe']});
    let stderr='';child.stderr.on('data',x=>{stderr+=x});
    child.once('error',reject);
    child.once('exit',(code,signal)=>code===0||signal==='SIGKILL'?resolve({child,code,signal}):reject(new Error(stderr||`exit ${code}`)));
  });
  const spawnHolder=dir=>spawn(process.execPath,[here,'--holder',dir],{stdio:['ignore','ignore','pipe']});
  const claim=async(dir,name)=>{
    const file=path.join(dir,`${name}.json`);
    await runChild(['--claim',dir,file]);
    return JSON.parse(fs.readFileSync(file,'utf8'));
  };
  const rows=[];
  for(let round=0;round<50;round++){
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-runtime-lock-${round}-`));
    try{
      const holder=spawnHolder(dir);
      while(!fs.existsSync(path.join(dir,'holder-ready'))) await sleep(2);
      const live=await claim(dir,'live-contender');
      if(holder.exitCode===null&&holder.signalCode===null){
        const exited=new Promise(resolve=>holder.once('exit',resolve));
        holder.kill('SIGKILL');
        await exited;
      }
      const recovered=await claim(dir,'dead-owner-recovery');
      rows.push({round,liveRejected:live.status==='rejected'&&live.code==='HUSH_ALREADY_RUNNING',deadOwnerRecovered:recovered.status==='acquired'});
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  }
  const result={
    protocol:'mcp-stream-runtime-lock-closure-v1',
    rounds:rows.length,
    liveContenderRejected:rows.filter(x=>x.liveRejected).length,
    deadOwnerRecovered:rows.filter(x=>x.deadOwnerRecovered).length,
    scientificGate:rows.every(x=>x.liveRejected&&x.deadOwnerRecovered)?'PASS':'FAIL',
    smallestClaim:'The production startup lease excludes a second live local process and recovers after a proven-dead PID.'
  };
  const output=process.argv[2]??path.join(path.dirname(here),'mcp_stream_runtime_lock_result.json');
  fs.writeFileSync(output,`${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify(result,null,2));
}
