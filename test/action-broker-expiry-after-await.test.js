import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';

// HUSH-058: real broker, deferred credential resolution, actual loopback HTTP
// provider effect. The clock is intentionally controlled, not a physical clock.
const EXPECT_PREPATCH_COUNTEREXAMPLE=process.env.HUSH058_EXPECT_LEAK==='1';

async function scenario({resumeMs=1001,concurrent=false,alreadyExpired=false}={}){
  let now=1_000_000;
  let resolved=0, dispatched=0, effects=0;
  let releaseResolver;
  let enteredResolver;
  const resolverEntered=new Promise(resolve=>{enteredResolver=resolve;});
  const resolverReleased=new Promise(resolve=>{releaseResolver=resolve;});
  const receiver=createServer(async(req,res)=>{
    if(req.method==='POST'&&req.url==='/effect'){
      effects++;
      for await (const _chunk of req) {} // consume the actual HTTP request
      res.writeHead(201,{'content-type':'application/json'});
      res.end(JSON.stringify({effect:effects}));
    }else{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
  try{
    const broker=new ActionBroker({
      now:()=>now,
      secretResolver:async()=>{
        resolved++;
        enteredResolver();
        return await resolverReleased;
      }
    });
    broker.registerAdapter({name:'expiry58',actions:['write'],execute:async()=>{
      dispatched++;
      const response=await fetch('http://127.0.0.1:'+receiver.address().port+'/effect',{
        method:'POST',body:'synthetic-provider-effect',signal:AbortSignal.timeout(8000)
      });
      assert.equal(response.status,201);
      return {public:'ok'};
    }});
    const ticket=broker.request({
      adapter:'expiry58',action:'write',agent:'test',sink:'local',
      credentialRefs:['opaque-synthetic-reference'],ttlMs:1000
    });
    broker.approve(ticket.actionId);
    if(alreadyExpired){
      now+=1001;
      await assert.rejects(broker.execute({actionId:ticket.actionId,agent:'test',sink:'local'}),/expired/);
      return {resolved,dispatched,effects,decision:'preexpired_rejected'};
    }
    const pending=broker.execute({actionId:ticket.actionId,agent:'test',sink:'local'});
    await resolverEntered;
    if(concurrent){
      await assert.rejects(broker.execute({actionId:ticket.actionId,agent:'test',sink:'local'}),/already consumed/);
    }
    now+=resumeMs;
    releaseResolver('SYNTHETIC_TEST_CREDENTIAL');
    const outcome=await pending;
    return {resolved,dispatched,effects,decision:outcome.decision,
      reason:outcome.reason??null,receiptStatus:outcome.receipt?.status??null,
      body:JSON.stringify(outcome)};
  }finally{
    await new Promise(resolve=>receiver.close(resolve));
  }
}

test('HUSH-058 expired during async resolver: real HTTP dispatch must be denied',async()=>{
  const r=await scenario({resumeMs:1001});
  assert.equal(r.resolved,1);
  if(EXPECT_PREPATCH_COUNTEREXAMPLE){
    assert.equal(r.dispatched,1);
    assert.equal(r.effects,1);
    assert.equal(r.decision,'allow');
  }else{
    assert.equal(r.dispatched,0);
    assert.equal(r.effects,0);
    assert.equal(r.decision,'deny');
    assert.match(r.reason,/ACTION_TICKET_EXPIRED/);
    assert.equal(r.receiptStatus,'deny');
    assert.equal(r.body.includes('SYNTHETIC_TEST_CREDENTIAL'),false);
  }
});

test('HUSH-058 unexpired delayed resolver retains exactly one real HTTP effect',async()=>{
  const r=await scenario({resumeMs:500});
  assert.equal(r.resolved,1);
  assert.equal(r.dispatched,1);
  assert.equal(r.effects,1);
  assert.equal(r.decision,'allow');
});

test('HUSH-058 concurrent second execute cannot evade one-use reservation',async()=>{
  const r=await scenario({resumeMs:1001,concurrent:true});
  assert.equal(r.resolved,1);
  assert.equal(r.dispatched,EXPECT_PREPATCH_COUNTEREXAMPLE?1:0);
  assert.equal(r.effects,EXPECT_PREPATCH_COUNTEREXAMPLE?1:0);
});

test('HUSH-058 pre-expired ticket never resolves credentials or dispatches',async()=>{
  const r=await scenario({alreadyExpired:true});
  assert.equal(r.resolved,0);
  assert.equal(r.dispatched,0);
  assert.equal(r.effects,0);
});
