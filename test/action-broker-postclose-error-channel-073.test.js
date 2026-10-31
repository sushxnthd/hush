import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

// HUSH-073: the adapter's *settlement kind* is private, but authorization is
// durably closed before settlement. Only the broker's public projection is tested.
const EXPECT_LEAK=process.env.HUSH073_EXPECT_LEAK==='1';
const TRACE=process.env.HUSH073_TRACE_FILE;
const traces=[];
function record(name,x){
  traces.push({name,decision:x.decision,receiptStatus:x.receiptStatus,
    digestNull:x.resultDigest===null,hasResult:x.hasResult,
    requests:x.requests,closed:x.closed});
}
after(()=>{
  if(TRACE) writeFileSync(TRACE,JSON.stringify({
    schema:'hush-073-trace-v1',expectedLeak:EXPECT_LEAK,scenarios:traces
  },null,2)+'\n');
});
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}
async function world(privateBit,{closeDuringRequest=true,approve=true}={}){
  const arrived=deferred(),release=deferred();
  let requests=0;
  const server=createServer(async(req,res)=>{
    try{
      for await(const _ of req) {}
      requests++;
      arrived.resolve();
      await release.promise;
      if(privateBit===0){
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify({public:'ok',privateBit:0}));
      }else{
        res.writeHead(503,{'content-type':'text/plain'});
        res.end('UNTRUSTED_PRIVATE_WORLD_1_ERROR');
      }
    }catch{
      if(!res.destroyed){res.writeHead(500);res.end('provider error');}
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const dir=mkdtempSync(join(tmpdir(),'hush073-'));
  const store=new EncryptedAuthorizationStateStore({
    file:join(dir,'state.json'),key:randomBytes(32)
  });
  try{
    const broker=new ActionBroker({authorizationStateStore:store});
    broker.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
    broker.registerAdapter({name:'settlement73',actions:['read'],authorizationScopes:{read:parity},
      execute:async()=>{
        const response=await fetch('http://127.0.0.1:'+server.address().port+'/private',{
          signal:AbortSignal.timeout(10000)
        });
        if(!response.ok) throw new Error(await response.text());
        return response.json();
      }});
    const ticket=broker.request({adapter:'settlement73',action:'read',transactionId:'tx',
      agent:'observer',sink:'local',arguments:{public:'constant'}});
    assert.equal(ticket.decision,'ask');
    if(approve) broker.approve(ticket.actionId);
    const pending=broker.execute({actionId:ticket.actionId,agent:'observer',sink:'local'});
    let closed=false;
    if(approve){
      await arrived.promise;
      if(closeDuringRequest){
        assert.equal(broker.closeAuthorizationTransaction('tx').closed,true);
        const fresh=new ActionBroker({authorizationStateStore:store});
        assert.throws(()=>fresh.registerAuthorizationTransaction({
          transactionId:'tx',worlds,globalAuthorization:parity
        }),/closed/);
        closed=true;
      }
    }
    release.resolve();
    const outcome=await pending;
    const serialized=JSON.stringify(outcome);
    assert.equal(serialized.includes('UNTRUSTED_PRIVATE_WORLD_1_ERROR'),false);
    return {
      decision:outcome.decision,reason:outcome.reason,
      receiptStatus:outcome.receipt?.status??null,
      resultDigest:outcome.receipt?.resultDigest??null,
      hasResult:Object.hasOwn(outcome,'result'),requests,closed,
      result:outcome.result
    };
  }finally{
    release.resolve();
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-073: post-close success versus failure must not leak through status', {timeout:30000},async()=>{
  const zero=await world(0),one=await world(1);
  record('closed_0',zero);record('closed_1',one);
  for(const x of [zero,one]){
    assert.equal(x.requests,1);
    assert.equal(x.closed,true);
    assert.equal(x.resultDigest,null);
    assert.equal(x.hasResult,false);
  }
  assert.equal(zero.decision,'deny');
  assert.equal(zero.receiptStatus,'deny');
  if(EXPECT_LEAK){
    // Frozen expected prepatch counterexample; never confuse with secure behavior.
    assert.equal(one.decision,'error');
    assert.equal(one.receiptStatus,'error');
    assert.notEqual(one.decision,zero.decision);
  }else{
    assert.equal(one.decision,'deny');
    assert.equal(one.receiptStatus,'deny');
    assert.equal(one.reason,zero.reason);
  }
});

test('HUSH-073: open authorization preserves authorized success/error distinction', {timeout:30000},async()=>{
  const zero=await world(0,{closeDuringRequest:false});
  const one=await world(1,{closeDuringRequest:false});
  record('open_0',zero);record('open_1',one);
  assert.equal(zero.decision,'allow');
  assert.equal(zero.result.privateBit,0);
  assert.equal(one.decision,'error');
  assert.equal(one.reason,'Action execution failed.');
  assert.equal(zero.requests,1);
  assert.equal(one.requests,1);
});

test('HUSH-073: unapproved ticket does not contact provider', {timeout:30000},async()=>{
  const x=await world(1,{approve:false});
  record('unapproved_1',x);
  assert.equal(x.decision,'ask');
  assert.equal(x.requests,0);
});
