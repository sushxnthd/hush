import fs from 'node:fs';
import path from 'node:path';

function processAlive(pid){
  if(!Number.isInteger(pid)||pid<=0) return false;
  try{process.kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}
}
function readOwner(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}

export function acquireRuntimeLock(dataDir,{pid=process.pid,now=Date.now}={}){
  const file=path.join(dataDir,'runtime.lock');
  fs.mkdirSync(dataDir,{recursive:true});
  const claim=()=>{
    const fd=fs.openSync(file,'wx',0o600);
    try{fs.writeFileSync(fd,JSON.stringify({pid,startedAt:now()}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  };
  try{claim();}
  catch(error){
    if(error?.code!=='EEXIST') throw error;
    const owner=readOwner(file);
    if(owner&&processAlive(Number(owner.pid))) throw Object.assign(new Error(`Another Hush runtime is already using this state directory (pid ${owner.pid}).`),{code:'HUSH_ALREADY_RUNNING'});
    fs.rmSync(file,{force:true});
    claim();
  }
  let released=false;
  return {
    file,
    release(){
      if(released) return;
      released=true;
      const owner=readOwner(file);
      if(!owner||Number(owner.pid)===Number(pid)) fs.rmSync(file,{force:true});
    }
  };
}
