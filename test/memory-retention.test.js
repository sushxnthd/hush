import test from 'node:test';
import assert from 'node:assert/strict';
import {SharedMemoryBroker} from '../src/memory-broker.js';
function fixture(){let now=1000;const stored=[];const broker=new SharedMemoryBroker({now:()=>now,kernel:{put:(path,value)=>{stored.push({path,value});return {revision:1};}}});return {broker,stored,advance:ms=>now+=ms};}
test('approval and rejection immediately erase duplicate plaintext proposal values',()=>{
  const {broker,stored}=fixture();
  const a=broker.propose({label:'A',value:'PRIVATE-CANARY'});
  assert.equal(broker.queue({includeValues:true})[0].value,'PRIVATE-CANARY');
  broker.approve(a.proposalId);assert.equal(stored[0].value,'PRIVATE-CANARY');
  assert.equal(Object.hasOwn(broker.queue({includeValues:true})[0],'value'),false);
  assert.equal(Object.hasOwn(broker.proposals.get(a.proposalId),'value'),false);
  assert.equal(broker.approve(a.proposalId).decision,'approved');
  const b=broker.propose({label:'B',value:'DENIED-CANARY'});broker.deny(b.proposalId);
  assert.equal(Object.hasOwn(broker.proposals.get(b.proposalId),'value'),false);
  assert.equal(JSON.stringify(broker.queue({includeValues:true})).includes('CANARY'),false);
});
test('expired proposal history is removed and never becomes canonical memory',()=>{
  const {broker,stored,advance}=fixture();
  const a=broker.propose({label:'A',value:'expired',ttlMs:1000});advance(1000);
  assert.throws(()=>broker.approve(a.proposalId),/expired/);assert.equal(stored.length,0);
  const b=broker.propose({label:'B',value:'approved',ttlMs:1000});broker.approve(b.proposalId);advance(1000);
  assert.deepEqual(broker.queue(),[]);
});
test('proposal flood is bounded and expiry frees queue capacity',()=>{
  const {broker,advance}=fixture();
  for(let i=0;i<256;i++)broker.propose({label:`Memory ${i}`,value:i,ttlMs:1000});
  assert.throws(()=>broker.propose({label:'overflow',value:1}),/queue is full/);
  advance(1000);assert.equal(broker.propose({label:'after expiry',value:1}).decision,'ask');
});
test('oversized memory value is rejected without retaining it',()=>{
  const {broker}=fixture();assert.throws(()=>broker.propose({label:'large',value:'x'.repeat(65536)}),/safety limit/);
  assert.equal(broker.queue().length,0);
});
