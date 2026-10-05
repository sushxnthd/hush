import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeContextValue,contextSanitizationModes} from '../src/context-sanitizer.js';

test('sanitizer exposes only explicit fallback modes',()=>{
  assert.deepEqual(contextSanitizationModes(),['strict','coarse','pseudonymous']);
  assert.throws(()=>sanitizeContextValue('secret',{mode:'exact'}),/Unsupported context sanitization mode/);
});

test('pseudonymous fallback replaces structural identifiers and detected PII while coarsening exact numbers and dates',()=>{
  const raw={
    id:'msg-938472',
    displayName:'Ada Lovelace',
    email:'ada@example.com',
    phone:'+91 98765 43210',
    address:'17 Private Road, Delhi',
    balance:734219,
    start:'2026-10-05T12:34:56Z',
    body:'Contact ada@example.com or visit https://private.example/path.'
  };
  const out=sanitizeContextValue(raw,{mode:'pseudonymous'});
  const wire=JSON.stringify(out.sanitized);
  for(const value of ['msg-938472','Ada Lovelace','ada@example.com','98765','17 Private Road','734219','2026-10-05T12:34:56Z','private.example']){
    assert.equal(wire.includes(value),false,`sanitized output leaked ${value}`);
  }
  assert.equal(out.sanitized.email,'person-1@example.invalid');
  assert.equal(out.sanitized.body.includes('person-1@example.invalid'),true);
  assert.equal(out.sanitized.start,'2026-10');
  assert.equal(out.sanitized.balance,'100000–1000000');
  assert.equal(out.requiresApproval,true);
  assert.equal(out.exactPrivateValuesIntended,false);
  assert.equal(out.bestEffortTextSanitization,true);
});

test('strict fallback masks free text and scalar detail rather than pretending anonymization is perfect',()=>{
  const out=sanitizeContextValue({subject:'Highly private topic',score:87,active:true},{mode:'strict'});
  assert.deepEqual(out.sanitized,{subject:'[private text]',score:'[number]',active:true});
  assert.ok(out.transformations.includes('text-mask'));
  assert.ok(out.transformations.includes('numeric-mask'));
});
