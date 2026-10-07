import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOnboardingRequest } from '../src/onboarding-http.js';

function makeReq(method,body){
  const payload=body===undefined?null:Buffer.from(JSON.stringify(body));
  return {method,async *[Symbol.asyncIterator](){if(payload)yield payload;}};
}
function makeRes(){
  return {status:null,headers:null,body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(value=''){this.body=String(value);}};
}
async function call(onboarding,method,path,body){
  const req=makeReq(method,body),res=makeRes(),u=new URL(path,'http://127.0.0.1:8787');
  const handled=await handleOnboardingRequest({req,res,u,onboarding});
  return {handled,status:res.status,payload:res.body?JSON.parse(res.body):{}};
}

test('Google start forwards requested action scopes through the local HTTP boundary',async()=>{
  let input=null;
  const onboarding={startGoogle:value=>{input=value;return {provider:'google',authorizationUrl:'https://accounts.google.com/test'};}};
  const out=await call(onboarding,'POST','/api/onboarding/google/start',{connectors:['gmail'],actions:['send_email']});
  assert.equal(out.handled,true);
  assert.equal(out.status,201);
  assert.deepEqual(input,{connectors:['gmail'],actions:['send_email']});
});

test('provider action request approval and execution are explicit separate routes',async()=>{
  const calls=[];
  const onboarding={
    requestAction:value=>{calls.push(['request',value]);return {decision:'ask',actionId:'a1',agent:value.agent,sink:value.sink};},
    approveAction:id=>{calls.push(['approve',id]);return {decision:'allow',actionId:id};},
    executeAction:async value=>{calls.push(['execute',value]);return {decision:'allow',result:{sent:true}};}
  };
  const requested=await call(onboarding,'POST','/api/onboarding/actions/request',{provider:'google',action:'send_email',agent:'assistant',sink:'gmail',arguments:{to:'person@example.com'}});
  assert.equal(requested.status,201);
  assert.equal(requested.payload.decision,'ask');
  const approved=await call(onboarding,'POST','/api/onboarding/actions/a1/approve',{});
  assert.equal(approved.payload.decision,'allow');
  const executed=await call(onboarding,'POST','/api/onboarding/actions/a1/execute',{agent:'assistant',sink:'gmail'});
  assert.equal(executed.payload.result.sent,true);
  assert.deepEqual(calls.map(x=>x[0]),['request','approve','execute']);
});

test('provider action execution rejects missing binding identity before side effects',async()=>{
  let executed=false;
  const onboarding={executeAction:async()=>{executed=true;return {decision:'allow'};}};
  const out=await call(onboarding,'POST','/api/onboarding/actions/a1/execute',{agent:'assistant'});
  assert.equal(out.status,400);
  assert.match(out.payload.error,/agent and sink/i);
  assert.equal(executed,false);
});
