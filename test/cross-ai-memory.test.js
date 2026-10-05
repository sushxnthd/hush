import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';

function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'hush-cross-ai-memory-')); }

test('AI memory proposal cannot mutate canonical context before local approval',()=>{
  const k=new ContextKernel({dir:temp(),passphrase:'cross ai memory passphrase'});
  const proposal=k.proposeMemory({agent:'assistant-a',label:'Preferred seat',category:'travel',tags:['seat','preference'],value:'aisle'});
  assert.equal(proposal.decision,'ask');
  assert.equal(proposal.valueIncluded,false);
  assert.equal(k.list().length,0);
  assert.equal(Object.hasOwn(k.memoryProposalQueue()[0],'value'),false);
  assert.equal(k.memoryProposalQueue({includeValues:true})[0].value,'aisle');
});

test('approved memory is stored once and can personalize a different AI without exposing the memory value',()=>{
  const dir=temp();
  const passphrase='shared provider neutral memory passphrase';
  let k=new ContextKernel({dir,passphrase});
  const proposal=k.proposeMemory({agent:'assistant-a',label:'Preferred seat',category:'travel',tags:['seat','preference'],value:'aisle'});
  const approved=k.approveMemoryProposal(proposal.proposalId);
  assert.equal(approved.decision,'approved');
  assert.equal(k.list().length,1);
  assert.equal(k.list()[0].label,'Preferred seat');
  assert.equal(Object.hasOwn(k.list()[0],'value'),false);

  // Restart to prove the canonical memory is encrypted persistent context rather
  // than an AI-provider-specific session cache.
  k=new ContextKernel({dir,passphrase});
  const task=k.beginTrajectory({purpose:'seat selection',maxBits:2,sinkMaxBits:2});
  const out=k.runSemantic({
    trajectoryId:task.trajectoryId,
    agent:'assistant-b',
    sink:'different-ai.example',
    task:'choose a seat using my preferred seat type',
    program:{
      kind:'choose',
      candidates:[{id:'12A',seat:'window'},{id:'12C',seat:'aisle'}],
      preferences:[{kind:'matchPrivate',candidate:'seat',weight:10}]
    }
  });
  assert.equal(out.decision,'allow');
  assert.equal(out.result,'12C');
  const wire=JSON.stringify(out);
  assert.equal(wire.includes('aisle'),false);
  assert.equal(wire.includes('memory.shared.'),false);
});

test('same semantic memory key updates only after a new proposal is approved',()=>{
  const k=new ContextKernel({dir:temp(),passphrase:'memory update approval passphrase'});
  const first=k.proposeMemory({agent:'assistant-a',label:'Preferred seat',category:'travel',tags:['seat'],value:'aisle'});
  k.approveMemoryProposal(first.proposalId);
  assert.equal(k.list().length,1);

  const change=k.proposeMemory({agent:'assistant-b',label:'Preferred seat',category:'travel',tags:['seat'],value:'window'});
  assert.equal(k.list().length,1);
  k.denyMemoryProposal(change.proposalId);

  const task=k.beginTrajectory({purpose:'seat check',maxBits:1,sinkMaxBits:1});
  const out=k.runSemantic({trajectoryId:task.trajectoryId,agent:'assistant-c',sink:'third-ai.example',program:{kind:'predicate',privateRef:{query:'preferred seat'},op:'eq',value:'aisle'}});
  assert.equal(out.decision,'allow');
  assert.equal(out.result,true);
});
