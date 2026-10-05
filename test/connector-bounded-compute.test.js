import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';
import {ContextSelectionError} from '../src/context-compiler.js';

function kernel(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-connector-compute-'));
  return new ContextKernel({dir,passphrase:'connector bounded compute test passphrase'});
}

function trajectory(k,purpose='bounded connector computation'){
  return k.beginTrajectory({purpose,maxBits:4,sinkMaxBits:4});
}

test('semantic privateField computes over a Gmail subfield without returning the value or connector path',()=>{
  const k=kernel();
  k.ingestConnectorSnapshot({provider:'gmail',collection:'messages',items:[{
    id:'msg-1',subject:'Admissions update',from:'admissions@example.edu',to:'student@example.com',
    snippet:'Decision timeline changed',body:'PRIVATE_BODY_MARKER_7X2',labelIds:['INBOX']
  }]});
  const t=trajectory(k);
  const out=k.runSemantic({
    trajectoryId:t.trajectoryId,agent:'assistant-a',sink:'model.example',task:'Check who sent my Admissions update email.',
    program:{kind:'predicate',privateRef:{query:'Admissions update'},privateField:'from',op:'eq',value:'admissions@example.edu'}
  });
  assert.equal(out.decision,'allow');
  assert.equal(out.result,true);
  const wire=JSON.stringify(out);
  for(const secret of ['admissions@example.edu','PRIVATE_BODY_MARKER_7X2','connector.gmail.messages']) assert.equal(wire.includes(secret),false);
});

test('semantic privateField supports nested Calendar object fields',()=>{
  const k=kernel();
  k.ingestConnectorSnapshot({provider:'calendar',collection:'events',items:[{
    id:'event-1',summary:'Physics revision',location:'Room 404',
    start:{dateTime:'2026-10-08T17:00:00+05:30'},end:{dateTime:'2026-10-08T18:00:00+05:30'}
  }]});
  const t=trajectory(k,'calendar eligibility');
  const out=k.runSemantic({
    trajectoryId:t.trajectoryId,agent:'assistant-b',sink:'model.example',task:'Check the start time of Physics revision without revealing it.',
    program:{kind:'predicate',privateRef:{query:'Physics revision'},privateField:'start.dateTime',op:'eq',value:'2026-10-08T17:00:00+05:30'}
  });
  assert.equal(out.decision,'allow');
  assert.equal(out.result,true);
  const wire=JSON.stringify(out);
  assert.equal(wire.includes('2026-10-08T17:00:00+05:30'),false);
  assert.equal(wire.includes('Room 404'),false);
});

test('privateField rejects prototype, empty-segment, and excessive-depth paths',()=>{
  const k=kernel();
  k.ingestConnectorSnapshot({provider:'generic',collection:'records',items:[{id:'one',label:'Record one',value:{safe:{value:3}}}]});
  const bad=['__proto__.x','safe..value','safe.constructor.value','a.b.c.d.e.f.g'];
  for(const privateField of bad){
    const t=trajectory(k);
    assert.throws(()=>k.runSemantic({
      trajectoryId:t.trajectoryId,agent:'assistant-c',sink:'model.example',task:'Record one',
      program:{kind:'predicate',privateRef:{query:'Record one'},privateField,op:'eq',value:3}
    }),ContextSelectionError);
  }
});
