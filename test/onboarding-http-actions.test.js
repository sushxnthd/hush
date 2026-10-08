import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import { handleOnboardingRequest } from '../src/onboarding-http.js';

function makeReq(method,body){
  const payload=body===undefined?null:Buffer.from(JSON.stringify(body));
  const req=Readable.from(payload?[payload]:[]);req.method=method;return req;
}
function makeRes(){
  return {status:null,headers:null,body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(value=''){this.body=String(value);}};
}
async function call(onboarding,method,path,body,{auditAction=null}={}){
  const req=makeReq(method,body),res=makeRes(),u=new URL(path,'http://127.0.0.1:8787');
  const handled=await handleOnboardingRequest({req,res,u,onboarding,auditAction});
  return {handled,status:res.status,payload:res.body?JSON.parse(res.body):{}};
}

test('Google start forwards only explicitly requested scopes through the local HTTP boundary',async()=>{
  let input=null;
  const onboarding={startGoogle:value=>{input=value;return {provider:'google',authorizationUrl:'https://accounts.google.com/test'};}};
  const out=await call(onboarding,'POST','/api/onboarding/google/start',{connectors:['gmail'],actions:['send_email']});
  assert.equal(out.handled,true);
  assert.equal(out.status,201);
  assert.deepEqual(input,{connectors:['gmail'],actions:['send_email']});
});

test('Google start with omitted permissions fails closed instead of expanding to default scopes',async()=>{
  let called=false;
  const onboarding={startGoogle:()=>{called=true;return {};}};
  for(const body of [{},{connectors:null,actions:null},{connectors:'gmail'}]){
    const out=await call(onboarding,'POST','/api/onboarding/google/start',body);
    assert.equal(out.status,400);
    assert.match(out.payload.error,/Select at least one Google connector or action/i);
  }
  assert.equal(called,false);
});

test('provider action request approval and execution are explicit separate routes',async()=>{
  const calls=[];
  const ticket={decision:'allow',actionId:'a1',agent:'assistant',sink:'gmail',purpose:'send approved note',category:'communication',adapter:'google',action:'send_email',resource:'me',requestHash:'hash-1'};
  const onboarding={
    requestAction:value=>{calls.push(['request',value]);return {decision:'ask',actionId:'a1',agent:value.agent,sink:value.sink};},
    approveAction:id=>{calls.push(['approve',id]);return {decision:'allow',actionId:id};},
    actionQueue:()=>[ticket],
    executeAction:async value=>{calls.push(['execute',value]);return {decision:'allow',result:{sent:true},receipt:{hash:'broker-hash'}};}
  };
  const audits=[];
  const auditAction=event=>audits.push(structuredClone(event));
  const requested=await call(onboarding,'POST','/api/onboarding/actions/request',{provider:'google',action:'send_email',agent:'assistant',sink:'gmail',arguments:{to:'person@example.com'}},{auditAction});
  assert.equal(requested.status,201);
  assert.equal(requested.payload.decision,'ask');
  const approved=await call(onboarding,'POST','/api/onboarding/actions/a1/approve',{}, {auditAction});
  assert.equal(approved.payload.decision,'allow');
  const executed=await call(onboarding,'POST','/api/onboarding/actions/a1/execute',{agent:'assistant',sink:'gmail'},{auditAction});
  assert.equal(executed.payload.result.sent,true);
  assert.equal(executed.payload.auditPersisted,true);
  assert.deepEqual(calls.map(x=>x[0]),['request','approve','execute']);
  assert.deepEqual(audits.map(x=>x.phase),['attempt','outcome']);
  assert.equal(audits[0].ticket.requestHash,'hash-1');
  assert.equal(audits[1].outcome.receipt.hash,'broker-hash');
});

test('provider action persistent audit failure prevents the external side effect',async()=>{
  let executed=false;
  const ticket={decision:'allow',actionId:'a1',agent:'assistant',sink:'gmail',purpose:'send',category:'communication',adapter:'google',action:'send_email',resource:'me',requestHash:'hash-1'};
  const onboarding={
    actionQueue:()=>[ticket],
    executeAction:async()=>{executed=true;return {decision:'allow',result:{sent:true}};}
  };
  const out=await call(onboarding,'POST','/api/onboarding/actions/a1/execute',{agent:'assistant',sink:'gmail'},{auditAction:()=>{throw new Error('audit storage unavailable');}});
  assert.equal(out.status,400);
  assert.match(out.payload.error,/audit storage unavailable/i);
  assert.equal(executed,false);
});

test('provider action outcome audit failure reports uncertainty without pretending action did not run',async()=>{
  let executed=false,audits=0;
  const ticket={decision:'allow',actionId:'a1',agent:'assistant',sink:'gmail',purpose:'send',category:'communication',adapter:'google',action:'send_email',resource:'me',requestHash:'hash-1'};
  const onboarding={
    actionQueue:()=>[ticket],
    executeAction:async()=>{executed=true;return {decision:'allow',result:{sent:true},receipt:{hash:'broker-hash'}};}
  };
  const out=await call(onboarding,'POST','/api/onboarding/actions/a1/execute',{agent:'assistant',sink:'gmail'},{auditAction:event=>{audits+=1;if(event.phase==='outcome')throw new Error('disk full');}});
  assert.equal(out.status,200);
  assert.equal(out.payload.decision,'allow');
  assert.equal(out.payload.auditPersisted,false);
  assert.equal(executed,true);
  assert.equal(audits,2);
});

test('provider action execution rejects missing or mismatched binding identity before side effects or audit',async()=>{
  let executed=false,audited=false;
  const ticket={decision:'allow',actionId:'a1',agent:'assistant',sink:'gmail',requestHash:'hash-1'};
  const onboarding={actionQueue:()=>[ticket],executeAction:async()=>{executed=true;return {decision:'allow'};}};
  const missing=await call(onboarding,'POST','/api/onboarding/actions/a1/execute',{agent:'assistant'},{auditAction:()=>{audited=true;}});
  assert.equal(missing.status,400);
  assert.match(missing.payload.error,/agent and sink/i);
  const mismatch=await call(onboarding,'POST','/api/onboarding/actions/a1/execute',{agent:'other',sink:'gmail'},{auditAction:()=>{audited=true;}});
  assert.equal(mismatch.status,400);
  assert.match(mismatch.payload.error,/bound to another agent or sink/i);
  assert.equal(executed,false);
  assert.equal(audited,false);
});
