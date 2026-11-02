import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionBroker} from '../src/action-broker.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};

function fixture(traces){
  const calls=[];let resolutions=0;
  const broker=new ActionBroker({secretResolver:async()=>{resolutions+=1;return 'secret';}});
  broker.registerAdapter({name:'guarded',actions:['run'],authorizationScopes:{run:parity},lifecycleTraces:traces?{run:traces}:{},execute:async()=>{calls.push('run');return {constant:true};}});
  broker.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
  return {broker,calls,resolutions:()=>resolutions};
}
async function execute(f){
  const request=f.broker.request({adapter:'guarded',action:'run',transactionId:'tx',agent:'a',sink:'s',credentialRefs:['c'],requireLifecycleTraceCertificate:true});
  f.broker.approve(request.actionId);
  return {request,result:await f.broker.execute({actionId:request.actionId,agent:'a',sink:'s'})};
}

test('unsafe lifecycle declaration is denied before credentials and dispatch',async()=>{
  const f=fixture({'00':[null],'11':['constant'],'01':[null],'10':[null]});
  const {request,result}=await execute(f);
  assert.equal(request.lifecycleTraceDecision,'deny');
  assert.equal(result.decision,'deny');
  assert.match(result.reason,/LIFECYCLE_TRACE_REFINEMENT/);
  assert.equal(f.resolutions(),0);assert.deepEqual(f.calls,[]);
});

test('safe lifecycle declaration is allowed',async()=>{
  const f=fixture({'00':['complete'],'11':['complete'],'01':['error'],'10':['error']});
  const {request,result}=await execute(f);
  assert.equal(request.lifecycleTraceDecision,'allow');
  assert.equal(result.decision,'allow');
  assert.equal(f.resolutions(),1);assert.deepEqual(f.calls,['run']);
});

test('missing and mutated declarations fail closed',async()=>{
  const missing=fixture(null);
  assert.equal((await execute(missing)).result.decision,'deny');
  assert.deepEqual(missing.calls,[]);
  const changed=fixture({'00':['complete'],'11':['complete'],'01':['error'],'10':['error']});
  const request=changed.broker.request({adapter:'guarded',action:'run',transactionId:'tx',agent:'a',sink:'s',requireLifecycleTraceCertificate:true});
  changed.broker.adapters.get('guarded').lifecycleTraces.run['11']=['changed'];
  changed.broker.approve(request.actionId);
  const result=await changed.broker.execute({actionId:request.actionId,agent:'a',sink:'s'});
  assert.equal(result.decision,'deny');assert.match(result.reason,/COMMITMENT_MISMATCH/);assert.deepEqual(changed.calls,[]);
});

test('opt-out preserves request hashes',()=>{
  const a=fixture(null),b=fixture({'00':[null],'11':['constant'],'01':[null],'10':[null]});
  const left=a.broker.request({adapter:'guarded',action:'run',transactionId:'tx',agent:'a',sink:'s'});
  const right=b.broker.request({adapter:'guarded',action:'run',transactionId:'tx',agent:'a',sink:'s'});
  assert.equal(left.requestHash,right.requestHash);
  assert.equal('lifecycleTraceCommitment' in left,false);
});
