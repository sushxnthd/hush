import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';

// HUSH-076. Trusted adapter policy is independent of caller-provided flags.
// PREPATCH mode intentionally demonstrates an approved HTTP effect.
const PREPATCH=process.env.HUSH076_EXPECT_BYPASS==='1';
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const trace={'00':['even'],'11':['even'],'01':['odd'],'10':['odd']};
const boundary={
  externalChannels:['return','status','out-of-band'],
  closure:{
    return:{mode:'broker-owned',traces:trace},
    status:{mode:'suppressed'},
    'out-of-band':{mode:'independently-verified',traces:trace}
  }
};
const enforcement={
  transactionRequired:true,
  lifecycleTraceRequired:true,
  observableClosureRequired:true
};

async function withReceiver(fn){
  let effects=0;
  const server=createServer(async(req,res)=>{
    for await(const _ of req){}
    effects++;
    res.writeHead(200,{'content-type':'application/json'});
    res.end('{"public":"ok"}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    return await fn({
      url:'http://127.0.0.1:'+server.address().port+'/effect',
      effects:()=>effects
    });
  }finally{await new Promise(resolve=>server.close(resolve));}
}

function makeBroker(url,{withBoundary=true,protectedAdapter=true}={}){
  let entries=0;
  const broker=new ActionBroker({
    observableBoundaries:withBoundary?{protected76:{send:boundary}}:{}
  });
  broker.registerAdapter({
    name:'protected76',actions:['send'],
    authorizationScopes:{send:parity},
    lifecycleTraces:{send:trace},
    ...(protectedAdapter?{enforcement}:{}),
    execute:async()=>{
      entries++;
      const response=await fetch(url,{method:'POST',body:'public-constant',
        signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw Error('Unexpected HTTP response');
      return {public:'ok'};
    }
  });
  broker.registerAuthorizationTransaction({
    transactionId:'tx76',worlds,globalAuthorization:parity
  });
  return {broker,entries:()=>entries};
}

function request(broker,extras={}){
  return broker.request({
    adapter:'protected76',action:'send',agent:'a76',sink:'s76',
    arguments:{public:'constant'},...extras
  });
}

test('trusted required policy prevents caller omission from causing an HTTP effect',async()=>{
  await withReceiver(async({url,effects})=>{
    const {broker,entries}=makeBroker(url);
    if(PREPATCH){
      const t=request(broker);
      broker.approve(t.actionId);
      const out=await broker.execute({actionId:t.actionId,agent:'a76',sink:'s76'});
      assert.equal(out.decision,'allow');
      assert.equal(effects(),1);
      assert.equal(entries(),1);
      assert.equal(out.receipt.transactionId,null);
    }else{
      assert.throws(()=>request(broker),/ADAPTER_REQUIRES_AUTHORIZATION_TRANSACTION/);
      assert.equal(effects(),0);
      assert.equal(entries(),0);
      assert.equal(broker.queue().length,0);
    }
  });
});

test('protected scoped request cannot downgrade mandatory certificates',async()=>{
  if(PREPATCH) return;
  await withReceiver(async({url,effects})=>{
    const {broker,entries}=makeBroker(url);
    const t=request(broker,{transactionId:'tx76'});
    assert.equal(t.requireLifecycleTraceCertificate,true);
    assert.equal(t.requireObservableClosureCertificate,true);
    assert.equal(t.lifecycleTraceDecision,'allow');
    assert.equal(t.observableClosureDecision,'allow');
    broker.approve(t.actionId);
    const out=await broker.execute({actionId:t.actionId,agent:'a76',sink:'s76'});
    assert.equal(out.decision,'allow');
    assert.equal(effects(),1);
    assert.equal(entries(),1);
  });
});

test('missing broker-owned closure blocks protected execution before HTTP',async()=>{
  if(PREPATCH) return;
  await withReceiver(async({url,effects})=>{
    const {broker,entries}=makeBroker(url,{withBoundary:false});
    const t=request(broker,{transactionId:'tx76'});
    broker.approve(t.actionId);
    const out=await broker.execute({actionId:t.actionId,agent:'a76',sink:'s76'});
    assert.equal(out.decision,'deny');
    assert.match(out.reason,/OBSERVABLE_CLOSURE_INCOMPLETE/);
    assert.equal(effects(),0);
    assert.equal(entries(),0);
  });
});

test('legacy/tampered scoped ticket cannot erase trusted required certificates',async()=>{
  if(PREPATCH) return;
  await withReceiver(async({url,effects})=>{
    const {broker,entries}=makeBroker(url);
    const t=request(broker,{transactionId:'tx76'});
    broker.approve(t.actionId);
    const internal=broker.tickets.get(t.actionId);
    internal.requireLifecycleTraceCertificate=false;
    internal.requireObservableClosureCertificate=false;
    const out=await broker.execute({actionId:t.actionId,agent:'a76',sink:'s76'});
    assert.equal(out.decision,'deny');
    assert.match(out.reason,/ADAPTER_REQUIRED_CERTIFICATE_OMITTED/);
    assert.equal(effects(),0);
    assert.equal(entries(),0);
  });
});

test('invalid trusted policy rejected, ordinary unscoped compatibility preserved',async()=>{
  if(PREPATCH) return;
  await withReceiver(async({url,effects})=>{
    const {broker}=makeBroker(url);
    assert.throws(()=>broker.registerAdapter({
      name:'invalid76',execute:async()=>{},enforcement:{transactionRequired:'yes'}
    }),/INVALID_ADAPTER_ENFORCEMENT/);
    assert.throws(()=>broker.registerAdapter({
      name:'invalid76',execute:async()=>{},enforcement:{observableClosureRequired:true}
    }),/INVALID_ADAPTER_ENFORCEMENT/);
    assert.throws(()=>broker.registerAdapter({
      name:'invalid76',execute:async()=>{},enforcement:{unexpected:true}
    }),/INVALID_ADAPTER_ENFORCEMENT/);
    broker.registerAdapter({name:'ordinary76',actions:['send'],execute:async()=>{
      const response=await fetch(url,{method:'POST',body:'public-constant',
        signal:AbortSignal.timeout(10000)});
      return {ok:response.ok};
    }});
    const t=broker.request({adapter:'ordinary76',action:'send',agent:'a76',sink:'s76'});
    broker.approve(t.actionId);
    const out=await broker.execute({actionId:t.actionId,agent:'a76',sink:'s76'});
    assert.equal(out.decision,'allow');
    assert.equal(effects(),1);
  });
});
