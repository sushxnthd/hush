import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyLifecycleTraceAuthorization,payloadOnlyLifecycleSafe} from '../src/lifecycle-trace-contract.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};

test('absence is treated as an observable symbol',()=>{
  const traces={'00':[null],'11':['constant'],'01':[null],'10':[null]};
  assert.equal(payloadOnlyLifecycleSafe({worlds,globalAuthorization:parity,traces}),true);
  const result=certifyLifecycleTraceAuthorization({worlds,globalAuthorization:parity,traces});
  assert.equal(result.safe,false);
  assert.equal(result.reason,'LIFECYCLE_TRACE_REFINEMENT');
  assert.deepEqual([result.witness.left,result.witness.right],['00','11']);
});

test('authorization-factored lifecycle traces certify',()=>{
  const traces={'00':['complete'],'11':['complete'],'01':['error'],'10':['error']};
  assert.equal(certifyLifecycleTraceAuthorization({worlds,globalAuthorization:parity,traces}).safe,true);
});

test('incomplete declarations fail closed',()=>{
  assert.throws(()=>certifyLifecycleTraceAuthorization({worlds,globalAuthorization:parity,traces:{'00':[],'01':[],'10':[]}}),/missing world 11/);
});
