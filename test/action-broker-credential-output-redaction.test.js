import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';

// A synthetic token, not a real credential. The HTTP server publishes only
// the broker's own return object; the adapter never opens a socket.
const SECRET_A='HUSH_PRIVATE_057_A_very_long_test_token';
const SECRET_B='HUSH_PRIVATE_057_B_very_long_test_token';
const EXPECT_LEAK=process.env.HUSH057_EXPECT_LEAK==='1';

async function observe(kind,secret,{approve=true}={}){
  let resolved=0,dispatched=0;
  const broker=new ActionBroker({secretResolver:async()=>{
    resolved++;return secret;
  }});
  broker.registerAdapter({name:'output57',actions:['read'],execute:async({credentials})=>{
    dispatched++;
    assert.equal(credentials[0],secret);
    if(kind==='key') return {[credentials[0]]:'public'};
    if(kind==='error') throw new Error('provider rejected '+credentials[0]);
    if(kind==='collision') return {[credentials[0]]:'secret-key','[HUSH:CREDENTIAL]':'other'};
    return {publicKey:'publicValue'};
  }});
  const server=createServer(async(_req,res)=>{
    try{
      const ticket=broker.request({adapter:'output57',action:'read',agent:'observer',
        sink:'loopback',credentialRefs:['opaque-ref-057'],arguments:{public:'constant'}});
      if(approve) broker.approve(ticket.actionId);
      const outcome=await broker.execute({actionId:ticket.actionId,agent:'observer',sink:'loopback'});
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify(outcome));
    }catch(error){
      res.writeHead(500,{'content-type':'application/json'});
      res.end(JSON.stringify({internalTestError:error.name}));
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/out',
      {signal:AbortSignal.timeout(8000)});
    assert.equal(response.status,200);
    return {body:await response.text(),resolved,dispatched};
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}

test('HUSH-057: real broker HTTP result object keys must not expose resolved credentials',async()=>{
  for(const secret of [SECRET_A,SECRET_B]){
    const run=await observe('key',secret);
    assert.equal(run.resolved,1);assert.equal(run.dispatched,1);
    assert.equal(run.body.includes(secret),EXPECT_LEAK);
    assert.equal(JSON.parse(run.body).decision,'allow');
  }
});

test('HUSH-057: real broker HTTP exception reason must not expose resolved credentials',async()=>{
  for(const secret of [SECRET_A,SECRET_B]){
    const run=await observe('error',secret);
    assert.equal(run.resolved,1);assert.equal(run.dispatched,1);
    assert.equal(run.body.includes(secret),EXPECT_LEAK);
    const response=JSON.parse(run.body);
    assert.equal(response.decision,'error');
    assert.equal(response.receipt.status,'error');
    if(!EXPECT_LEAK) assert.equal(response.reason,'Action execution failed.');
  }
});

test('HUSH-057: no adapter or credential resolution before explicit approval',async()=>{
  const run=await observe('error',SECRET_A,{approve:false});
  assert.equal(run.resolved,0);
  assert.equal(run.dispatched,0);
  assert.equal(run.body.includes(SECRET_A),false);
  assert.equal(JSON.parse(run.body).decision,'ask');
});

test('HUSH-057: benign public result remains unchanged',async()=>{
  const run=await observe('benign',SECRET_A);
  const response=JSON.parse(run.body);
  assert.equal(response.decision,'allow');
  assert.deepEqual(response.result,{publicKey:'publicValue'});
  assert.equal(run.body.includes(SECRET_A),false);
});

test('HUSH-057: redacted-key collision must fail closed',async()=>{
  const run=await observe('collision',SECRET_A);
  const response=JSON.parse(run.body);
  if(EXPECT_LEAK){
    assert.equal(response.decision,'allow');
    assert.equal(run.body.includes(SECRET_A),true);
  }else{
    assert.equal(response.decision,'error');
    assert.equal(response.reason,'Action execution failed.');
    assert.equal(run.body.includes(SECRET_A),false);
  }
});
