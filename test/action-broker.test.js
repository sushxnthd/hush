import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionBroker} from '../src/action-broker.js';
import {ConsentRegistry} from '../src/consent.js';

function broker({rules=[],now=()=>Date.now()}={}){
  const consent=new ConsentRegistry({now,rules});
  const secrets=new Map([['cred-mail','sk-proj-super-secret-token-1234567890'],['cred-api','github_pat_supersecretcredential1234567890']]);
  const seen=[];
  const b=new ActionBroker({
    consentRegistry:consent,
    secretResolver:async ref=>{
      if(!secrets.has(ref)) throw new Error('credential not found');
      return secrets.get(ref);
    },
    now
  });
  b.registerAdapter({
    name:'mail',actions:['send'],description:'Local mail adapter',
    execute:async input=>{
      seen.push(input);
      return {ok:true,messageId:'m_1',debug:`used ${input.credentials[0]??'none'}`};
    }
  });
  return {b,consent,seen,secrets};
}

test('raw credential material is denied before consent evaluation',()=>{
  const {b}=broker();
  const out=b.request({
    adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',
    arguments:{subject:'hi',authorization:'Bearer sk-proj-super-secret-token-1234567890'}
  });
  assert.equal(out.decision,'deny');
  assert.equal(out.hardDeny,true);
  assert.equal(out.rawCredentialIncluded,true);
  assert.equal(b.queue().length,0);
});

test('unmatched action asks and cannot execute until local approval',async()=>{
  const {b,seen}=broker();
  const requested=b.request({
    adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',
    arguments:{to:'person@example.com',subject:'Status'},credentialRefs:['cred-mail']
  });
  assert.equal(requested.decision,'ask');
  assert.equal(requested.credentialCount,1);
  assert.equal('credentialRefs' in requested,false);

  const before=await b.execute({actionId:requested.actionId,agent:'assistant',sink:'mail'});
  assert.equal(before.decision,'ask');
  assert.equal(seen.length,0);

  b.approve(requested.actionId);
  const done=await b.execute({actionId:requested.actionId,agent:'assistant',sink:'mail'});
  assert.equal(done.decision,'allow');
  assert.equal(seen.length,1);
  assert.equal(seen[0].credentials[0],'sk-proj-super-secret-token-1234567890');
  const wire=JSON.stringify(done);
  assert.equal(wire.includes('sk-proj-super-secret-token-1234567890'),false);
  assert.equal(done.result.debug,'used [HUSH:CREDENTIAL]');
  assert.equal(done.receipt.rawCredentialIncluded,false);
});

test('persistent consent can execute without another prompt',async()=>{
  const {b,consent,seen}=broker();
  consent.set({
    mode:'always',capability:'action:mail:send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox'
  });
  const requested=b.request({
    adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',
    arguments:{to:'person@example.com',subject:'Status'},credentialRefs:['cred-mail']
  });
  assert.equal(requested.decision,'allow');
  const done=await b.execute({actionId:requested.actionId,agent:'assistant',sink:'mail'});
  assert.equal(done.decision,'allow');
  assert.equal(seen.length,1);
});

test('one-time consent is consumed only when the action actually executes',async()=>{
  const {b,consent}=broker();
  const rule=consent.set({
    mode:'once',capability:'action:mail:send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox'
  });
  const first=b.request({
    adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',arguments:{subject:'one'}
  });
  assert.equal(first.decision,'allow');
  assert.equal(consent.list().find(x=>x.id===rule.id).active,true);

  const done=await b.execute({actionId:first.actionId,agent:'assistant',sink:'mail'});
  assert.equal(done.decision,'allow');
  assert.equal(consent.list().find(x=>x.id===rule.id).active,false);

  const second=b.request({
    adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',arguments:{subject:'two'}
  });
  assert.equal(second.decision,'ask');
});

test('never consent rule prevents execution',async()=>{
  const {b,consent,seen}=broker();
  consent.set({
    mode:'never',capability:'action:mail:send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox'
  });
  const requested=b.request({
    adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',arguments:{subject:'blocked'}
  });
  assert.equal(requested.decision,'deny');
  const done=await b.execute({actionId:requested.actionId,agent:'assistant',sink:'mail'});
  assert.equal(done.decision,'deny');
  assert.equal(seen.length,0);
});

test('action tickets are bound to the requesting agent and sink and are one-shot',async()=>{
  const {b}=broker();
  const requested=b.request({
    adapter:'mail',action:'send',agent:'assistant-a',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',arguments:{subject:'hello'}
  });
  b.approve(requested.actionId);
  await assert.rejects(()=>b.execute({actionId:requested.actionId,agent:'assistant-b',sink:'mail'}),/bound to another agent or sink/i);
  await assert.rejects(()=>b.execute({actionId:requested.actionId,agent:'assistant-a',sink:'other'}),/bound to another agent or sink/i);
  const done=await b.execute({actionId:requested.actionId,agent:'assistant-a',sink:'mail'});
  assert.equal(done.decision,'allow');
  await assert.rejects(()=>b.execute({actionId:requested.actionId,agent:'assistant-a',sink:'mail'}),/already consumed/i);
});

test('adapter failures consume the ticket rather than silently replaying side effects',async()=>{
  const consent=new ConsentRegistry();
  consent.set({mode:'always',capability:'action:payments:charge',agent:'assistant',sink:'payments',purpose:'checkout',category:'money',resource:'merchant:test'});
  let calls=0;
  const b=new ActionBroker({consentRegistry:consent});
  b.registerAdapter({name:'payments',actions:['charge'],execute:async()=>{calls+=1;throw new Error('provider unavailable');}});
  const requested=b.request({adapter:'payments',action:'charge',agent:'assistant',sink:'payments',purpose:'checkout',category:'money',resource:'merchant:test',arguments:{amount:25,currency:'USD'}});
  const out=await b.execute({actionId:requested.actionId,agent:'assistant',sink:'payments'});
  assert.equal(out.decision,'error');
  assert.equal(calls,1);
  await assert.rejects(()=>b.execute({actionId:requested.actionId,agent:'assistant',sink:'payments'}),/already consumed/i);
  assert.equal(calls,1);
});

test('expired tickets fail closed',()=>{
  let now=1000;
  const {b}=broker({now:()=>now});
  const requested=b.request({adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',arguments:{subject:'hello'},ttlMs:1000});
  now=2000;
  assert.throws(()=>b.approve(requested.actionId),/expired/i);
});
