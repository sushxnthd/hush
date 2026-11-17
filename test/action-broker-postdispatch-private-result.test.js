import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

const EXPECT_LEAK=process.env.HUSH060_EXPECT_LEAK==='1';
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}
async function world(bit,{closeDuringRequest=true,approve=true}={}){
  const arrived=deferred(),release=deferred();
  let requests=0;
  const server=createServer((req,res)=>{
    requests++;
    arrived.resolve();
    release.promise.then(()=>{
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({privateBit:bit,public:'ok'}));
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const dir=mkdtempSync(join(tmpdir(),'hush060-'));
  const store=new EncryptedAuthorizationStateStore({file:join(dir,'state.json'),key:randomBytes(32)});
  try{
    const broker=new ActionBroker({authorizationStateStore:store});
    broker.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
    broker.registerAdapter({name:'read060',actions:['read'],authorizationScopes:{read:parity},
      execute:async()=>{
        const response=await fetch('http://127.0.0.1:'+server.address().port+'/private');
        assert.equal(response.status,200);
        return response.json();
      }});
    const request=broker.request({adapter:'read060',action:'read',transactionId:'tx',
      agent:'observer',sink:'local'});
    assert.equal(request.decision,'ask');
    if(approve) broker.approve(request.actionId);
    const pending=broker.execute({actionId:request.actionId,agent:'observer',sink:'local'});
    if(!approve){
      const result=await pending;
      assert.equal(requests,0,'unapproved ticket must not dispatch');
      return {result,requests,closed:false};
    }
    await arrived.promise;
    let closed=false;
    if(closeDuringRequest){
      assert.equal(broker.closeAuthorizationTransaction('tx').closed,true);
      const recovered=new ActionBroker({authorizationStateStore:store});
      assert.throws(()=>recovered.registerAuthorizationTransaction({
        transactionId:'tx',worlds,globalAuthorization:parity
      }),/closed/,'a fresh broker must observe durable closure');
      closed=true;
    }
    release.resolve();
    const result=await pending;
    return {result,requests,closed};
  }finally{
    release.resolve();
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-060 real HTTP: closed transaction cannot release a private result', {timeout:20000},async()=>{
  const a=await world(0),b=await world(1);
  assert.equal(a.requests,1);
  assert.equal(b.requests,1);
  assert.equal(a.closed,true);
  assert.equal(b.closed,true);
  if(EXPECT_LEAK){
    assert.equal(a.result.decision,'allow');
    assert.equal(b.result.decision,'allow');
    assert.equal(a.result.result.privateBit,0);
    assert.equal(b.result.result.privateBit,1);
    assert.notEqual(a.result.receipt.resultDigest,b.result.receipt.resultDigest);
  }else{
    assert.equal(a.result.decision,'deny');
    assert.equal(b.result.decision,'deny');
    assert.equal(a.result.reason,b.result.reason);
    assert.equal(a.result.receipt.status,'deny');
    assert.equal(b.result.receipt.status,'deny');
    assert.equal(a.result.receipt.resultDigest,null);
    assert.equal(b.result.receipt.resultDigest,null);
    assert.equal(Object.hasOwn(a.result,'result'),false);
    assert.equal(Object.hasOwn(b.result,'result'),false);
    assert.equal(JSON.stringify(a.result).includes('privateBit'),false);
    assert.equal(JSON.stringify(b.result).includes('privateBit'),false);
    assert.match(a.result.reason,/after dispatch|post-dispatch/i);
  }
});

test('HUSH-060 control: open approved transaction releases result', {timeout:20000},async()=>{
  const x=await world(1,{closeDuringRequest:false});
  assert.equal(x.requests,1);
  assert.equal(x.result.decision,'allow');
  assert.equal(x.result.result.privateBit,1);
});

test('HUSH-060 control: unapproved ticket has zero provider effects', {timeout:20000},async()=>{
  const x=await world(1,{approve:false});
  assert.equal(x.requests,0);
  assert.equal(x.result.decision,'ask');
  assert.equal(Object.hasOwn(x.result,'result'),false);
});
