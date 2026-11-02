import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

// HUSH-077: real process death after a provider has accepted HTTP, before
// the broker can produce a receipt. This is a LIMITATION test, not an exploit.
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const logicalBody='hush077-same-logical-operation';

function makeBroker(file,key,url){
  const broker=new ActionBroker({
    authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})
  });
  broker.registerAdapter({
    name:'provider77',actions:['send'],
    authorizationScopes:{send:parity},
    enforcement:{transactionRequired:true},
    execute:async()=>{
      const response=await fetch(url,{method:'POST',body:logicalBody,
        signal:AbortSignal.timeout(12000)});
      if(!response.ok) throw new Error('Provider rejected operation');
      return {public:'accepted'};
    }
  });
  return broker;
}
async function approved(broker){
  const t=broker.request({adapter:'provider77',action:'send',
    agent:'actor77',sink:'provider77',transactionId:'tx77',
    arguments:{operation:'same-logical-operation'}});
  assert.equal(t.decision,'ask');
  broker.approve(t.actionId);
  return broker.execute({actionId:t.actionId,agent:'actor77',sink:'provider77'});
}
async function worker(){
  const [url,file,keyHex]=process.argv.slice(3);
  const broker=makeBroker(file,Buffer.from(keyHex,'hex'),url);
  const out=await approved(broker);
  process.stdout.write(JSON.stringify({decision:out.decision})+'\n');
}
function timeout(promise,ms){
  let id;
  return Promise.race([promise,new Promise((_,reject)=>{
    id=setTimeout(()=>reject(new Error('HUSH077_TIMEOUT')),ms);
  })]).finally(()=>clearTimeout(id));
}
async function scenario({revokeBeforeRetry}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush077-'));
  const file=path.join(dir,'state.enc.json');
  const key=crypto.randomBytes(32);
  const effects=[];
  const events=[];
  let firstResolve;
  const firstHit=new Promise(resolve=>{firstResolve=resolve;});
  let pendingResponse=null;
  const server=createServer(async(req,res)=>{
    try{
      assert.equal(req.method,'POST');
      let body='';
      for await(const chunk of req) body+=chunk.toString('utf8');
      effects.push(body);
      events.push({event:'provider_http_effect',ordinal:effects.length});
      if(effects.length===1){
        pendingResponse=res;
        firstResolve();
      }else{
        res.writeHead(200,{'content-type':'application/json'});
        res.end('{"public":"accepted"}');
      }
    }catch{
      res.writeHead(400);
      res.end('invalid');
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/effect';
  let child;
  try{
    const initial=makeBroker(file,key,url);
    initial.registerAuthorizationTransaction({
      transactionId:'tx77',worlds,globalAuthorization:parity
    });
    child=spawn(process.execPath,[new URL(import.meta.url).pathname,
      '--worker',url,file,key.toString('hex')],{
      stdio:['ignore','pipe','pipe']
    });
    let stderr='';
    child.stderr.on('data',data=>{stderr+=data.toString();});
    const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
    await timeout(Promise.race([
      firstHit,
      exit.then(out=>{throw new Error('WORKER_EXITED_BEFORE_EFFECT '+JSON.stringify(out)+' '+stderr.slice(0,500));})
    ]),18000);
    assert.deepEqual(effects,[logicalBody]);
    assert.equal(child.kill('SIGKILL'),true);
    const killed=await timeout(exit,10000);
    assert.equal(killed.signal,'SIGKILL');
    events.push({event:'broker_sigkill'});
    // The receiver observed the irreversible effect, but the worker never
    // received a provider response or produced an accessible broker receipt.
    pendingResponse?.end('{"public":"late"}');
    pendingResponse=null;
    const recovered=makeBroker(file,key,url);
    events.push({event:'broker_restart'});
    assert.equal(recovered.authorizationTransactions.get('tx77')?.closedAt,null);
    if(revokeBeforeRetry){
      recovered.closeAuthorizationTransaction('tx77');
      events.push({event:'durable_revoke'});
      const restarted=makeBroker(file,key,url);
      assert.throws(()=>restarted.request({
        adapter:'provider77',action:'send',agent:'actor77',
        sink:'provider77',transactionId:'tx77'
      }),/closed/);
      assert.deepEqual(effects,[logicalBody]);
    }else{
      const result=await timeout(approved(recovered),12000);
      assert.equal(result.decision,'allow');
      assert.equal(result.receipt.transactionId,'tx77');
      assert.equal(result.receipt.status,'allow');
      assert.deepEqual(effects,[logicalBody,logicalBody]);
      assert.equal(recovered.receiptLog().length,1);
      events.push({event:'retry_receipt'});
    }
    return {effectCount:effects.length,revoked:revokeBeforeRetry,
      firstReceiptRecovered:false,postRestartReceiptCount:revokeBeforeRetry?0:1,events};
  }finally{
    if(child&&!child.killed) child.kill('SIGKILL');
    pendingResponse?.end();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
if(process.argv[2]==='--worker'){
  await worker();
}else{
  test('actual crash after HTTP effect permits duplicate with fresh explicit approval',async()=>{
    const outcome=await scenario({revokeBeforeRetry:false});
    assert.equal(outcome.effectCount,2);
    console.log('HUSH077_TRACE '+JSON.stringify(outcome));
  });
  test('durable revocation before retry blocks the second HTTP effect',async()=>{
    const outcome=await scenario({revokeBeforeRetry:true});
    assert.equal(outcome.effectCount,1);
    console.log('HUSH077_TRACE '+JSON.stringify(outcome));
  });
}
