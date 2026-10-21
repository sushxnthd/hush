import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionBroker} from '../src/action-broker.js';

const worlds=['00','01','10','11'];
const map=fn=>Object.fromEntries(worlds.map(world=>[world,fn(...world.split('').map(Number))]));
const identity=Object.fromEntries(worlds.map(world=>[world,world]));
const parity=map((x,y)=>x^y);
const xMap=map(x=>x);
const yMap=map((x,y)=>y);

function fixture(){
  const calls=[];
  const broker=new ActionBroker();
  broker.registerAdapter({
    name:'hidden-world',actions:['read_x','read_y'],authorizationScopes:{read_x:xMap,read_y:yMap},
    execute:async({action})=>{ calls.push(action); return {value:1}; }
  });
  return {broker,calls};
}

async function approvedExecution(broker,transactionId,action){
  const requested=broker.request({adapter:'hidden-world',action,transactionId,agent:'fixture',sink:'local'});
  broker.approve(requested.actionId);
  return broker.execute({actionId:requested.actionId,agent:'fixture',sink:'local'});
}

test('identity transaction preserves both coordinate actions and binds commitments',async()=>{
  const {broker,calls}=fixture();
  const transaction=broker.registerAuthorizationTransaction({transactionId:'identity',worlds,globalAuthorization:identity});
  const x=await approvedExecution(broker,'identity','read_x');
  const y=await approvedExecution(broker,'identity','read_y');
  assert.deepEqual([x.decision,y.decision],['allow','allow']);
  assert.deepEqual(calls,['read_x','read_y']);
  assert.equal(x.receipt.transactionId,'identity');
  assert.equal(x.receipt.globalAuthorizationCommitment,transaction.globalAuthorizationCommitment);
  assert.match(x.receipt.localAuthorizationCommitment,/^[a-f0-9]{64}$/);
  assert.equal('globalAuthorization' in x.receipt,false);
  assert.equal('localAuthorization' in x.receipt,false);
});

for(const order of [['read_x','read_y'],['read_y','read_x']]){
  test(`parity transaction rejects ${order.join(' then ')} before dispatch`,async()=>{
    const {broker,calls}=fixture();
    broker.registerAuthorizationTransaction({transactionId:'parity',worlds,globalAuthorization:parity});
    const out=await approvedExecution(broker,'parity',order[0]);
    assert.equal(out.decision,'deny');
    assert.match(out.reason,/GLOBAL_SCOPE_REFINEMENT/);
    assert.equal(out.receipt.status,'deny');
    assert.equal(out.receipt.resultDigest,null);
    assert.deepEqual(calls,[]);
  });
}

test('closing a transaction after approval invalidates its outstanding ticket',async()=>{
  const {broker,calls}=fixture();
  broker.registerAuthorizationTransaction({transactionId:'closing',worlds,globalAuthorization:identity});
  const requested=broker.request({adapter:'hidden-world',action:'read_x',transactionId:'closing',agent:'fixture',sink:'local'});
  broker.approve(requested.actionId);
  broker.closeAuthorizationTransaction('closing');
  const out=await broker.execute({actionId:requested.actionId,agent:'fixture',sink:'local'});
  assert.equal(out.decision,'deny');
  assert.match(out.reason,/AUTHORIZATION_TRANSACTION_CLOSED/);
  assert.deepEqual(calls,[]);
});

test('adapter scope mutation after approval fails the commitment check',async()=>{
  const {broker,calls}=fixture();
  broker.registerAuthorizationTransaction({transactionId:'mutation',worlds,globalAuthorization:identity});
  const requested=broker.request({adapter:'hidden-world',action:'read_x',transactionId:'mutation',agent:'fixture',sink:'local'});
  broker.approve(requested.actionId);
  broker.registerAdapter({
    name:'hidden-world',actions:['read_x','read_y'],authorizationScopes:{read_x:yMap,read_y:yMap},
    execute:async()=>{ calls.push('mutated'); return {value:1}; }
  });
  const out=await broker.execute({actionId:requested.actionId,agent:'fixture',sink:'local'});
  assert.equal(out.decision,'deny');
  assert.match(out.reason,/LOCAL_AUTHORIZATION_COMMITMENT_MISMATCH/);
  assert.deepEqual(calls,[]);
});

test('global scope mutation after approval fails the commitment check',async()=>{
  const {broker,calls}=fixture();
  broker.registerAuthorizationTransaction({transactionId:'global-mutation',worlds,globalAuthorization:identity});
  const requested=broker.request({adapter:'hidden-world',action:'read_x',transactionId:'global-mutation',agent:'fixture',sink:'local'});
  broker.approve(requested.actionId);
  broker.authorizationTransactions.get('global-mutation').globalAuthorization['00']='changed';
  const out=await broker.execute({actionId:requested.actionId,agent:'fixture',sink:'local'});
  assert.equal(out.decision,'deny');
  assert.match(out.reason,/GLOBAL_AUTHORIZATION_COMMITMENT_MISMATCH/);
  assert.deepEqual(calls,[]);
});

test('transaction ids are immutable and raw scope maps remain private',()=>{
  const {broker}=fixture();
  broker.registerAuthorizationTransaction({transactionId:'immutable',worlds,globalAuthorization:identity});
  assert.throws(()=>broker.registerAuthorizationTransaction({transactionId:'immutable',worlds,globalAuthorization:parity}),/immutable/);
  const requested=broker.request({adapter:'hidden-world',action:'read_x',transactionId:'immutable'});
  assert.equal('globalAuthorization' in requested,false);
  assert.equal('localAuthorization' in requested,false);
  assert.equal(JSON.stringify(broker.listAdapters()).includes('00'),false);
});

test('ordinary unscoped actions retain existing behavior',async()=>{
  const {broker,calls}=fixture();
  const requested=broker.request({adapter:'hidden-world',action:'read_x',agent:'fixture',sink:'local'});
  broker.approve(requested.actionId);
  const out=await broker.execute({actionId:requested.actionId,agent:'fixture',sink:'local'});
  assert.equal(out.decision,'allow');
  assert.deepEqual(calls,['read_x']);
  assert.equal(out.receipt.transactionId,null);
});
