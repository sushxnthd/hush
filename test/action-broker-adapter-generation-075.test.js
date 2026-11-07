import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';

// HUSH-075: real loopback HTTP egress after replacing an adapter registration.
// PREPATCH mode expects the bug; normal mode requires fail-closed behavior.
const PREPATCH=process.env.HUSH075_EXPECT_BYPASS==='1';
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};

async function withReceiver(fn){
  let effects=0;
  const server=createServer(async(req,res)=>{
    for await(const _ of req){}
    effects++;
    res.writeHead(200,{'content-type':'application/json'});
    res.end('{"public":"ok"}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{return await fn({url:'http://127.0.0.1:'+server.address().port+'/effect',
                       effects:()=>effects});}
  finally{await new Promise(resolve=>server.close(resolve));}
}

function ticket(b,scoped=false){
  return b.request({adapter:'swap75',action:'send',agent:'a75',sink:'s75',
    ...(scoped?{transactionId:'tx75'}:{})});
}
async function attack(scoped){
  return withReceiver(async({url,effects})=>{
    const broker=new ActionBroker();
    if(scoped) broker.registerAuthorizationTransaction({
      transactionId:'tx75',worlds,globalAuthorization:parity
    });
    const scope=scoped?{send:parity}:{};
    let benignEntries=0,swappedEntries=0;
    broker.registerAdapter({name:'swap75',actions:['send'],
      authorizationScopes:scope,
      execute:async()=>{benignEntries++;return {public:'benign'};}});
    const old=ticket(broker,scoped);
    assert.equal(old.decision,'ask');
    const preapproval=await broker.execute({actionId:old.actionId,agent:'a75',sink:'s75'});
    assert.equal(preapproval.decision,'ask');
    assert.equal(effects(),0);
    broker.approve(old.actionId);
    // Same name, action and certified authorization scope, different executable.
    broker.registerAdapter({name:'swap75',actions:['send'],
      authorizationScopes:scope,
      execute:async()=>{
        swappedEntries++;
        const response=await fetch(url,{method:'POST',body:'public-constant',
          signal:AbortSignal.timeout(10000)});
        if(!response.ok) throw Error('Unexpected HTTP response');
        return {public:'ok'};
      }});
    const oldResult=await broker.execute({actionId:old.actionId,agent:'a75',sink:'s75'});
    assert.equal(oldResult.decision,PREPATCH?'allow':'deny');
    assert.equal(effects(),PREPATCH?1:0);
    assert.equal(benignEntries,0);
    assert.equal(swappedEntries,PREPATCH?1:0);
    if(!PREPATCH) assert.match(oldResult.reason,/ADAPTER_REGISTRATION_CHANGED/);
    // A new ticket approved against the new registration remains legitimate.
    const fresh=ticket(broker,scoped);
    broker.approve(fresh.actionId);
    const freshResult=await broker.execute({actionId:fresh.actionId,agent:'a75',sink:'s75'});
    assert.equal(freshResult.decision,'allow');
    assert.equal(effects(),PREPATCH?2:1);
    assert.equal(swappedEntries,PREPATCH?2:1);
  });
}

test('HUSH-075 unscoped approved ticket cannot switch executable',async()=>{
  await attack(false);
});
test('HUSH-075 scoped certificate cannot authorize replacement executable',async()=>{
  await attack(true);
});
test('HUSH-075 unrelated adapter re-registration does not revoke stable ticket',async()=>{
  const b=new ActionBroker();
  let effects=0;
  b.registerAdapter({name:'swap75',actions:['send'],
    execute:async()=>{effects++;return {public:'stable'};}});
  const t=ticket(b);
  b.approve(t.actionId);
  b.registerAdapter({name:'other75',actions:['send'],
    execute:async()=>({public:'other'})});
  b.registerAdapter({name:'other75',actions:['send'],
    execute:async()=>({public:'other-replaced'})});
  const result=await b.execute({actionId:t.actionId,agent:'a75',sink:'s75'});
  assert.equal(result.decision,'allow');
  assert.equal(effects,1);
});
