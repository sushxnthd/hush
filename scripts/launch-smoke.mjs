import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {getOrCreatePlatformRootKey} from '../src/platform-key-store.js';
import {deriveLocalControlToken,deriveMcpTransportToken} from '../src/local-client-auth.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-launch-smoke-'));
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const child=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:String(port),HUSH_DATA_DIR:dir,HUSH_ALLOW_FILE_KEY_FALLBACK:'1',HUSH_REQUIRE_LOCAL_AUTH:'1',NODE_ENV:'development'},stdio:['ignore','ignore','pipe']});
let log='';child.stderr.on('data',c=>log+=c);const url=`http://127.0.0.1:${port}`;let checks=0;
try{
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Runtime exited: '+log.slice(-400));try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
  const key=getOrCreatePlatformRootKey(dir,{production:false,allowFileFallback:true}).key;
  const auth={authorization:'Hush '+deriveLocalControlToken(key),'content-type':'application/json'};
  async function api(p,body,expected=200){const r=await fetch(url+p,{method:body?'POST':'GET',headers:auth,body:body?JSON.stringify(body):undefined});const out=await r.json();assert.equal(r.status,expected,JSON.stringify(out));checks++;return out;}
  assert.equal((await fetch(url+'/api/context/owner/memory')).status,401);checks++;
  assert.equal((await fetch(url+'/api/context/owner/memory',{headers:{...auth,origin:'https://untrusted.example'}})).status,403);checks++;
  assert.equal((await fetch(url+'/api/context/owner/memory',{headers:{authorization:'Bearer '+deriveMcpTransportToken(key)}})).status,401);checks++;
  await api('/api/context',{path:'travel.maxBudget',label:'Travel budget',category:'travel',value:1500},201);
  const trajectory=await api('/api/context/trajectory',{purpose:'choose a flight',agent:'launch-smoke',sink:'test',maxBits:4},201);
  const result=await api('/api/context/decision',{trajectoryId:trajectory.trajectoryId,agent:'launch-smoke',sink:'test',program:{kind:'choose',candidates:[{id:'a',price:900},{id:'b',price:2000}],constraints:[{op:'candidateLtePrivate',candidate:'price',private:'travel.maxBudget'}],preferences:[]}});
  assert.equal(result.result,'a');assert.equal(JSON.stringify(result).includes('1500'),false);
  const proposal=await api('/api/context/owner/memory',{label:'Style',value:'Prefer concise explanations'},201);
  assert.equal(proposal.proposal.decision,'ask');
  await api('/api/context/owner/memory/'+encodeURIComponent(proposal.proposal.proposalId)+'/approve',{});
  const inventory=await api('/api/context');assert.equal(inventory.items.length,2);assert.equal(JSON.stringify(inventory).includes('Prefer concise explanations'),false);
  const queue=await api('/api/context/owner/memory');assert.equal(queue.proposals[0].value,'Prefer concise explanations');
  await api('/api/context/owner/remove',{path:'travel.maxBudget'});
  assert.equal((await api('/api/context')).items.length,1);
  const audit=await api('/api/receipts');assert.ok(audit.chainValid);assert.equal(JSON.stringify(audit).includes('Prefer concise explanations'),false);
  const launch=await api('/api/dashboard/launch',{},201);const session=await fetch(url+launch.path,{redirect:'manual'});assert.equal(session.status,303);
  const cookie=session.headers.get('set-cookie').split(';')[0];assert.ok((await fetch(url+'/api/context/owner/memory',{headers:{cookie}})).ok);checks++;
  console.log(`Authenticated launch smoke passed: ${checks} checks; context, bounded decision, memory approval, removal, signed receipts and dashboard session.`);
}finally{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},2000);child.once('exit',()=>{clearTimeout(timer);resolve();});});fs.rmSync(dir,{recursive:true,force:true});}
