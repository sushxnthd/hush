import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};

function deferred(){
  let release;
  const promise=new Promise(resolve=>{release=resolve;});
  return {promise,release};
}

async function receiver(){
  const received=[];
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    received.push(JSON.parse(body));
    res.writeHead(204);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {received,url:`http://127.0.0.1:${server.address().port}/sink`,
          close:()=>new Promise(resolve=>server.close(resolve))};
}

function setup({url,gate,store}){
  const broker=new ActionBroker({
    authorizationStateStore:store,
    secretResolver:async()=>gate.promise
  });
  broker.registerAdapter({
    name:'race',actions:['run'],authorizationScopes:{run:parity},
    execute:async()=>{
      const response=await fetch(url,{method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({effect:'real-http-dispatch'})});
      assert.equal(response.status,204);
      return {ok:true};
    }
  });
  if(!broker.authorizationTransactions.has('tx')){
    broker.registerAuthorizationTransaction({
      transactionId:'tx',worlds,globalAuthorization:parity
    });
  }
  return broker;
}

function ticket(broker){
  const q=broker.request({adapter:'race',action:'run',transactionId:'tx',
    agent:'race-test',sink:'loopback',credentialRefs:['opaque-secret-ref']});
  assert.equal(q.decision,'ask');
  broker.approve(q.actionId);
  return q.actionId;
}

function execute(broker,id){
  return broker.execute({actionId:id,agent:'race-test',sink:'loopback'});
}

test('one approved ticket causes at most one actual HTTP dispatch under concurrent execute',async()=>{
  const sink=await receiver();
  const gate=deferred();
  try{
    const broker=setup({url:sink.url,gate});
    const id=ticket(broker);
    const first=execute(broker,id);
    await assert.rejects(execute(broker,id),/already consumed/);
    gate.release('synthetic-secret');
    const result=await first;
    assert.equal(result.decision,'allow');
    assert.equal(sink.received.length,1,'exactly one externally observed dispatch');
  }finally{gate.release('synthetic-secret');await sink.close();}
});

test('closing transaction while secret resolution is pending denies before HTTP dispatch',async()=>{
  const sink=await receiver();
  const gate=deferred();
  const dir=mkdtempSync(join(tmpdir(),'hush-pcc-047-'));
  const file=join(dir,'state.json');
  const key=randomBytes(32);
  const store=new EncryptedAuthorizationStateStore({file,key});
  try{
    const broker=setup({url:sink.url,gate,store});
    const id=ticket(broker);
    const pending=execute(broker,id);
    broker.closeAuthorizationTransaction('tx');
    gate.release('synthetic-secret');
    const result=await pending;
    assert.equal(result.decision,'deny');
    assert.match(result.reason,/CLOSED/);
    assert.deepEqual(sink.received,[],'closed transaction must not dispatch');
    const restarted=setup({url:sink.url,gate:deferred(),store});
    assert.throws(()=>ticket(restarted),/closed/);
    assert.deepEqual(sink.received,[]);
  }finally{
    gate.release('synthetic-secret');
    await sink.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
