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
  const queue=await api('/api/context/owner/memory');assert.equal(Object.hasOwn(queue.proposals[0],'value'),false);
  await api('/api/context/owner/remove',{path:'travel.maxBudget'});
  assert.equal((await api('/api/context')).items.length,1);
  const audit=await api('/api/receipts');assert.ok(audit.chainValid);assert.equal(JSON.stringify(audit).includes('Prefer concise explanations'),false);
  const launch=await api('/api/dashboard/launch',{},201);const session=await fetch(url+launch.path,{redirect:'manual'});assert.equal(session.status,303);
  const cookie=session.headers.get('set-cookie').split(';')[0];assert.ok((await fetch(url+'/api/context/owner/memory',{headers:{cookie}})).ok);checks++;
  assert.equal((await fetch(url+'/api/status')).status,401);checks++;
  for(const raw of ['null','[]','{']){
    const response=await fetch(url+'/api/redact',{method:'POST',headers:auth,body:raw});assert.equal(response.status,400);checks++;
  }
  const oversize=await fetch(url+'/api/redact',{method:'POST',headers:auth,body:'x'.repeat(1_000_001)});assert.equal(oversize.status,413);checks++;
  const mcpHeaders={authorization:'Bearer '+deriveMcpTransportToken(key),'content-type':'application/json'};
  const notification=await fetch(url+'/mcp',{method:'POST',headers:mcpHeaders,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});assert.equal(notification.status,202);checks++;
  const invalid=await fetch(url+'/mcp',{method:'POST',headers:mcpHeaders,body:JSON.stringify({jsonrpc:'1.0',id:1,method:'ping'})});assert.equal((await invalid.json()).error.code,-32600);checks++;
  const noAuthority=await fetch(url+'/mcp',{method:'POST',headers:mcpHeaders,body:JSON.stringify({jsonrpc:'2.0',method:'tools/call',params:{name:'hush_propose_memory',arguments:{label:'unapproved-notification',value:'PRIVATE-CANARY'}}})});assert.equal(noAuthority.status,400);checks++;
  const bridge=spawn(process.execPath,['clients/desktop/hush-mcp.mjs'],{env:{...process.env,PORT:String(port),HUSH_DATA_DIR:dir,NODE_ENV:'development',HUSH_ALLOW_FILE_KEY_FALLBACK:'1'},stdio:['pipe','pipe','pipe']});
  let bridgeOut='',bridgeError='';bridge.stdout.on('data',c=>bridgeOut+=c);bridge.stderr.on('data',c=>bridgeError+=c);
  bridge.stdin.end([{jsonrpc:'2.0',id:100,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'launch-smoke',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:101,method:'tools/list'},{jsonrpc:'2.0',id:102,method:'ping'}].map(x=>JSON.stringify(x)).join('\n')+'\n');
  const bridgeExit=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{bridge.kill();reject(new Error('MCP bridge timed out'));},10000);bridge.once('error',reject);bridge.once('exit',code=>{clearTimeout(timer);resolve(code);});});
  assert.equal(bridgeExit,0,bridgeError);const messages=bridgeOut.trim().split('\n').map(x=>JSON.parse(x));assert.deepEqual(messages.map(x=>x.id),[100,101,102]);assert.equal(messages[1].result.tools.length,6);assert.equal(bridgeOut.includes('PRIVATE-CANARY'),false);checks++;
  assert.equal((await api('/api/status')).security.localClientAuth,true);
  console.log(`Authenticated launch smoke passed: ${checks} checks; context, bounded decision, memory approval, removal, signed receipts and dashboard session.`);
}finally{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},2000);child.once('exit',()=>{clearTimeout(timer);resolve();});});fs.rmSync(dir,{recursive:true,force:true});}
