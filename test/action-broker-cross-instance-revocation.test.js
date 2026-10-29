import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

const EXPECT_LEAK=process.env.HUSH061_EXPECT_LEAK==='1';
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}

async function scenario(bit,{closeFromOtherBroker=false,corruptStore=false,approve=true}={}){
  const arrived=deferred(),release=deferred();
  let effects=0;
  const server=createServer((_req,res)=>{
    effects++;arrived.resolve();
    release.promise.then(()=>{
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({privateBit:bit,public:'ok'}));
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const dir=mkdtempSync(join(tmpdir(),'hush061-'));
  const stateFile=join(dir,'authorization.json');
  const key=randomBytes(32);
  const store=new EncryptedAuthorizationStateStore({file:stateFile,key});
  try{
    const a=new ActionBroker({authorizationStateStore:store});
    a.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
    a.registerAdapter({name:'read061',actions:['read'],authorizationScopes:{read:parity},
      execute:async()=>{
        const response=await fetch('http://127.0.0.1:'+server.address().port+'/private');
        assert.equal(response.status,200);
        return response.json();
      }});
    const req=a.request({adapter:'read061',action:'read',transactionId:'tx',agent:'agent',sink:'local'});
    if(approve)a.approve(req.actionId);
    const pending=a.execute({actionId:req.actionId,agent:'agent',sink:'local'});
    if(!approve){
      const result=await pending;
      return {result,effects};
    }
    await arrived.promise;
    if(closeFromOtherBroker){
      const b=new ActionBroker({authorizationStateStore:store});
      assert.equal(b.closeAuthorizationTransaction('tx').closed,true);
      const c=new ActionBroker({authorizationStateStore:store});
      assert.throws(()=>c.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity}),/closed/);
      assert.equal(a.authorizationTransactions.get('tx').closedAt,null,'A deliberately holds stale authorization');
    }
    if(corruptStore)writeFileSync(stateFile,'{BROKEN','utf8');
    release.resolve();
    const result=await pending;
    return {result,effects};
  }finally{
    release.resolve();
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-061: durable closure by separate broker suppresses post-dispatch private result', {timeout:20000},async()=>{
  const a=await scenario(0,{closeFromOtherBroker:true});
  const b=await scenario(1,{closeFromOtherBroker:true});
  assert.equal(a.effects,1);assert.equal(b.effects,1);
  if(EXPECT_LEAK){
    assert.equal(a.result.decision,'allow');assert.equal(b.result.decision,'allow');
    assert.equal(a.result.result.privateBit,0);assert.equal(b.result.result.privateBit,1);
    assert.notEqual(a.result.receipt.resultDigest,b.result.receipt.resultDigest);
  }else{
    for(const x of [a,b]){
      assert.equal(x.result.decision,'deny');
      assert.equal(Object.hasOwn(x.result,'result'),false);
      assert.equal(x.result.receipt.resultDigest,null);
      assert.equal(x.result.receipt.status,'deny');
      assert.equal(JSON.stringify(x.result).includes('privateBit'),false);
    }
  }
});

test('HUSH-061: corrupted durable authorization state fails closed at completion', {timeout:20000},async()=>{
  const x=await scenario(1,{corruptStore:true});
  assert.equal(x.effects,1);
  if(EXPECT_LEAK){
    assert.equal(x.result.decision,'allow');
  }else{
    assert.equal(x.result.decision,'deny');
    assert.equal(x.result.receipt.resultDigest,null);
    assert.equal(Object.hasOwn(x.result,'result'),false);
  }
});

test('HUSH-061: unrevoked approved read remains usable', {timeout:20000},async()=>{
  const x=await scenario(1);
  assert.equal(x.effects,1);assert.equal(x.result.decision,'allow');
  assert.equal(x.result.result.privateBit,1);
});

test('HUSH-061: unapproved request never dispatches', {timeout:20000},async()=>{
  const x=await scenario(1,{approve:false});
  assert.equal(x.effects,0);assert.equal(x.result.decision,'ask');
});
