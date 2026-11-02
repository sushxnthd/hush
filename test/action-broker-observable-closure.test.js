import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionBroker} from '../src/action-broker.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const safeTrace={'00':['even'],'11':['even'],'01':['odd'],'10':['odd']};

function configuredBoundary(){
  return {
    mail:{
      send:{
        externalChannels:['return','status','out-of-band'],
        closure:{
          return:{mode:'broker-owned',traces:safeTrace},
          status:{mode:'suppressed'},
          'out-of-band':{mode:'independently-verified',traces:safeTrace}
        }
      }
    }
  };
}

function makeBroker({observableBoundaries={}}={}){
  let dispatches=0;
  let resolutions=0;
  const broker=new ActionBroker({
    observableBoundaries,
    secretResolver:async()=>{resolutions++;return 'secret-value';}
  });
  broker.registerAdapter({
    name:'mail',actions:['send'],
    authorizationScopes:{send:parity},
    lifecycleTraces:{send:safeTrace},
    execute:async()=>{dispatches++;return {ok:true};}
  });
  broker.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
  return {broker,counts:()=>({dispatches,resolutions})};
}

test('protected execution denies incomplete closure before credentials or dispatch',async()=>{
  const {broker,counts}=makeBroker();
  const requested=broker.request({
    adapter:'mail',action:'send',transactionId:'tx',
    agent:'a',sink:'mail',credentialRefs:['cred'],
    requireObservableClosureCertificate:true
  });
  assert.equal(requested.observableClosureDecision,'deny');
  broker.approve(requested.actionId);
  const result=await broker.execute({actionId:requested.actionId,agent:'a',sink:'mail'});
  assert.equal(result.decision,'deny');
  assert.match(result.reason,/OBSERVABLE_CLOSURE_INCOMPLETE/);
  assert.deepEqual(counts(),{dispatches:0,resolutions:0});
});

test('complete broker-configured closure permits safe execution',async()=>{
  const {broker,counts}=makeBroker({observableBoundaries:configuredBoundary()});
  const requested=broker.request({
    adapter:'mail',action:'send',transactionId:'tx',
    agent:'a',sink:'mail',credentialRefs:['cred'],
    requireObservableClosureCertificate:true
  });
  assert.equal(requested.observableClosureDecision,'allow');
  assert.match(requested.observableClosureCommitment,/^[a-f0-9]{64}$/);
  broker.approve(requested.actionId);
  const result=await broker.execute({actionId:requested.actionId,agent:'a',sink:'mail'});
  assert.equal(result.decision,'allow');
  assert.deepEqual(counts(),{dispatches:1,resolutions:1});
});

test('closure mutation after approval is denied before secret resolution',async()=>{
  const {broker,counts}=makeBroker({observableBoundaries:configuredBoundary()});
  const requested=broker.request({
    adapter:'mail',action:'send',transactionId:'tx',
    agent:'a',sink:'mail',credentialRefs:['cred'],
    requireObservableClosureCertificate:true
  });
  broker.approve(requested.actionId);
  broker.observableBoundaries.mail.send.closure.return.traces['00']=['mutated'];
  const result=await broker.execute({actionId:requested.actionId,agent:'a',sink:'mail'});
  assert.equal(result.decision,'deny');
  assert.match(result.reason,/OBSERVABLE_(TRACE_REFINEMENT|CLOSURE_COMMITMENT_MISMATCH)/);
  assert.deepEqual(counts(),{dispatches:0,resolutions:0});
});

test('adapter declarations cannot populate the broker-owned boundary',async()=>{
  const {broker,counts}=makeBroker();
  const adapter=broker.adapters.get('mail');
  adapter.observableBoundaries=configuredBoundary().mail;
  const requested=broker.request({
    adapter:'mail',action:'send',transactionId:'tx',
    agent:'a',sink:'mail',
    requireObservableClosureCertificate:true
  });
  broker.approve(requested.actionId);
  const result=await broker.execute({actionId:requested.actionId,agent:'a',sink:'mail'});
  assert.equal(result.decision,'deny');
  assert.match(result.reason,/OBSERVABLE_CLOSURE_INCOMPLETE/);
  assert.deepEqual(counts(),{dispatches:0,resolutions:0});
});
