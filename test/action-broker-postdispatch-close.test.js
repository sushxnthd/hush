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
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}
async function receiver(){
  const received=[];
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    received.push(JSON.parse(body));
    res.writeHead(204);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {received,url:`http://127.0.0.1:${server.address().port}/effect`,
          close:()=>new Promise(resolve=>server.close(resolve))};
}
function transaction(broker){
  broker.registerAuthorizationTransaction({
    transactionId:'tx',worlds,globalAuthorization:parity
  });
}
function ticket(broker){
  const request=broker.request({
    adapter:'delayed',action:'post',transactionId:'tx',
    agent:'cancellation-test',sink:'loopback'
  });
  assert.equal(request.decision,'ask');
  broker.approve(request.actionId);
  return request.actionId;
}
function dispatch(broker,id){
  return broker.execute({actionId:id,agent:'cancellation-test',sink:'loopback'});
}

test('HUSH-049: transaction closure cannot retract a previously dispatched asynchronous adapter',async()=>{
  const sink=await receiver();
  const entered=deferred(),release=deferred();
  const dir=mkdtempSync(join(tmpdir(),'hush-049-'));
  const store=new EncryptedAuthorizationStateStore({
    file:join(dir,'state.json'),key:randomBytes(32)
  });
  try{
    const broker=new ActionBroker({authorizationStateStore:store});
    broker.registerAdapter({
      name:'delayed',actions:['post'],authorizationScopes:{post:parity},
      execute:async()=>{
        entered.resolve();
        await release.promise;
        const response=await fetch(sink.url,{method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({event:'post-dispatch-effect',phase:'after-close'})});
        assert.equal(response.status,204);
        return {committed:true};
      }
    });
    transaction(broker);
    const pending=dispatch(broker,ticket(broker));
    await entered.promise;
    assert.equal(sink.received.length,0,'H1 no effect before adapter resumes');
    const closed=broker.closeAuthorizationTransaction('tx');
    assert.equal(closed.closed,true);
    const recovered=new ActionBroker({authorizationStateStore:store});
    assert.throws(()=>transaction(recovered),/closed/,'H2 closed state persists');
    release.resolve();
    const result=await pending;
    assert.equal(result.decision,'allow','H4 broker reports completion');
    assert.deepEqual(sink.received,[{event:'post-dispatch-effect',phase:'after-close'}],
      'H3 real external effect committed after durable closure');
  }finally{
    release.resolve();
    await sink.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('HUSH-049 control: closure before asynchronous credential resolution blocks adapter entry',async()=>{
  const sink=await receiver();
  const gate=deferred();
  let adapterEntries=0;
  try{
    const broker=new ActionBroker({secretResolver:async()=>gate.promise});
    broker.registerAdapter({
      name:'delayed',actions:['post'],authorizationScopes:{post:parity},
      execute:async()=>{
        adapterEntries++;
        const response=await fetch(sink.url,{method:'POST',
          body:JSON.stringify({event:'unexpected'})});
        assert.equal(response.status,204);
        return {committed:true};
      }
    });
    transaction(broker);
    const req=broker.request({
      adapter:'delayed',action:'post',transactionId:'tx',
      agent:'cancellation-test',sink:'loopback',
      credentialRefs:['opaque-credential']
    });
    assert.equal(req.decision,'ask');
    broker.approve(req.actionId);
    const pending=dispatch(broker,req.actionId);
    broker.closeAuthorizationTransaction('tx');
    gate.resolve('synthetic-credential');
    const result=await pending;
    assert.equal(result.decision,'deny','H5 pre-dispatch close must deny');
    assert.equal(adapterEntries,0);
    assert.equal(sink.received.length,0);
  }finally{
    gate.resolve('synthetic-credential');
    await sink.close();
  }
});
