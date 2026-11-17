import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';
import {ActionBroker} from '../src/action-broker.js';

// HUSH-074: real broker + loopback HTTP. A mandatory certificate must not be
// vacuously satisfied by omitting the authorization transaction.
const PREPATCH=process.env.HUSH074_EXPECT_BYPASS==='1';
const TRACE=process.env.HUSH074_TRACE_FILE;
const trace=[];
let server,port,requests;
before(async()=>{
  requests=0;
  server=createServer(async(req,res)=>{
    for await(const _ of req){}
    requests++;
    res.writeHead(200,{'content-type':'application/json'});
    res.end('{"public":"ok"}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  port=server.address().port;
});
after(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  if(TRACE) writeFileSync(TRACE,JSON.stringify({
    schema:'hush-074-v1',prepatch:PREPATCH,scenarios:trace
  },null,2)+'\n');
});
function setup(){
  let adapterEntries=0;
  const b=new ActionBroker();
  b.registerAdapter({name:'cert74',actions:['post'],execute:async()=>{
    adapterEntries++;
    const response=await fetch('http://127.0.0.1:'+port+'/effect',{
      method:'POST',body:'public-constant',signal:AbortSignal.timeout(10000)
    });
    if(!response.ok) throw new Error('Unexpected HTTP failure');
    return {public:'ok'};
  }});
  return {b,entries:()=>adapterEntries};
}
function ticket(b,flags={}){
  return b.request({adapter:'cert74',action:'post',agent:'test',sink:'local',
    arguments:{public:'constant'},...flags});
}
async function runMandatory(flag){
  const {b,entries}=setup();
  const beforeCount=requests;
  let result,requested=false;
  try{
    const t=ticket(b,{[flag]:true});
    requested=true;
    b.approve(t.actionId);
    result=await b.execute({actionId:t.actionId,agent:'test',sink:'local'});
  }catch(error){
    assert.match(error.message,/MANDATORY_CERTIFICATE_REQUIRES_TRANSACTION/);
  }
  const effectCount=requests-beforeCount;
  trace.push({name:flag,requested,decision:result?.decision??'REQUEST_REJECTED',
    effects:effectCount,adapterEntries:entries(),queue:b.queue().length});
  if(PREPATCH){
    assert.equal(requested,true);
    assert.equal(result?.decision,'allow');
    assert.equal(effectCount,1);
    assert.equal(entries(),1);
  }else{
    assert.equal(requested,false);
    assert.equal(effectCount,0);
    assert.equal(entries(),0);
    assert.equal(b.queue().length,0);
  }
}
test('mandatory observable-closure certificate cannot be silently unscoped',async()=>{
  await runMandatory('requireObservableClosureCertificate');
});
test('mandatory lifecycle-trace certificate cannot be silently unscoped',async()=>{
  await runMandatory('requireLifecycleTraceCertificate');
});
test('legacy/forged unscoped ticket cannot bypass mandatory dispatch check',async()=>{
  for(const flag of ['requireObservableClosureCertificate','requireLifecycleTraceCertificate']){
    const {b,entries}=setup();
    const beforeCount=requests;
    const t=ticket(b);
    b.approve(t.actionId);
    // Simulates a legacy ticket issued before the request-time guard.
    b.tickets.get(t.actionId)[flag]=true;
    const result=await b.execute({actionId:t.actionId,agent:'test',sink:'local'});
    const effects=requests-beforeCount;
    trace.push({name:'legacy_'+flag,requested:true,decision:result.decision,
      effects,adapterEntries:entries(),queue:b.queue().length});
    assert.equal(result.decision,PREPATCH?'allow':'deny');
    assert.equal(effects,PREPATCH?1:0);
    assert.equal(entries(),PREPATCH?1:0);
    if(!PREPATCH) assert.match(result.reason,/REQUIRED_CERTIFICATE_WITHOUT_TRANSACTION/);
  }
});
test('ordinary unscoped action still requires local approval and then works',async()=>{
  const {b,entries}=setup();
  const beforeCount=requests;
  const t=ticket(b);
  const unapproved=await b.execute({actionId:t.actionId,agent:'test',sink:'local'});
  assert.equal(unapproved.decision,'ask');
  assert.equal(entries(),0);
  assert.equal(requests-beforeCount,0);
  b.approve(t.actionId);
  const result=await b.execute({actionId:t.actionId,agent:'test',sink:'local'});
  trace.push({name:'ordinary_approved',requested:true,decision:result.decision,
    effects:requests-beforeCount,adapterEntries:entries(),queue:b.queue().length});
  assert.equal(result.decision,'allow');
  assert.equal(requests-beforeCount,1);
  assert.equal(entries(),1);
});
test('nonexistent explicit transaction is rejected',()=>{
  const {b,entries}=setup();
  const beforeCount=requests;
  assert.throws(()=>ticket(b,{transactionId:'missing',
    requireObservableClosureCertificate:true}),/not found/);
  assert.equal(entries(),0);
  assert.equal(requests-beforeCount,0);
});
