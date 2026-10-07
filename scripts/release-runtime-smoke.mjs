import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const summary=JSON.parse(fs.readFileSync('dist/release-summary.json','utf8'));
const bundle=path.resolve(summary.bundle);
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'release-manifest.json'),'utf8'));
const runtime=path.join(bundle,...manifest.bundledRuntime.path.split('/'));
const work=fs.mkdtempSync(path.join(os.tmpdir(),'hush-release-runtime-'));
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const startedAt=new Date().toISOString();
let child,report;
try{
  child=spawn(runtime,[path.join(bundle,'src','server.js')],{cwd:bundle,env:{...process.env,PORT:String(port),HUSH_DATA_DIR:path.join(work,'state'),HUSH_ALLOW_FILE_KEY_FALLBACK:'1',NODE_ENV:'development'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stderr='';child.stderr.on('data',c=>{stderr+=c.toString();});
  let response=null,lastError=null;
  for(let i=0;i<80;i++){
    if(child.exitCode!==null) throw new Error(`Bundled runtime exited early (${child.exitCode}): ${stderr.slice(-800)}`);
    try{response=await fetch(`http://127.0.0.1:${port}/api/status`,{signal:AbortSignal.timeout(500)});if(response.ok)break;}catch(error){lastError=error;}
    await new Promise(r=>setTimeout(r,100));
  }
  if(!response?.ok) throw lastError??new Error('Bundled Hush runtime did not become ready');
  const status=await response.json();
  assert.equal(status.product,'Hush');
  assert.equal(status.runtime?.stateLocation,'user-data');
  report={schema:'hush.release-runtime-smoke.v1',status:'pass',startedAt,completedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,nodeVersion:manifest.bundledRuntime.nodeVersion,portBoundToLoopback:true,product:status.product,contextEnabled:Boolean(status.context?.enabled)};
}catch(error){report={schema:'hush.release-runtime-smoke.v1',status:'fail',startedAt,completedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,error:error?.message||String(error)};process.exitCode=1;}
finally{
  if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>{const t=setTimeout(()=>{child.kill('SIGKILL');resolve();},3000);child.once('exit',()=>{clearTimeout(t);resolve();});});}
  fs.rmSync(work,{recursive:true,force:true});
}
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/release-runtime-smoke.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
