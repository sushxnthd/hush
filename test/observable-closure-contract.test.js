import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyObservableClosure} from '../src/observable-closure-contract.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const factored={'00':['same'],'11':['same'],'01':['other'],'10':['other']};
const privateBit={'00':[0],'01':[0],'10':[1],'11':[1]};

test('observable closure accepts complete authorization-factored coverage',()=>{
  const result=certifyObservableClosure({
    worlds,globalAuthorization:parity,
    externalChannels:['return','status','network'],
    closure:{
      return:{mode:'broker-owned',traces:factored},
      status:{mode:'suppressed'},
      network:{mode:'independently-verified',traces:factored}
    }
  });
  assert.equal(result.safe,true);
  assert.equal(result.channels.length,3);
  assert.match(result.commitment,/^[a-f0-9]{64}$/);
});

test('uncovered external channel abstains',()=>{
  const result=certifyObservableClosure({
    worlds,globalAuthorization:parity,
    externalChannels:['return','out-of-band'],
    closure:{return:{mode:'broker-owned',traces:factored}}
  });
  assert.deepEqual(result,{safe:false,reason:'OBSERVABLE_CLOSURE_INCOMPLETE',missing:['out-of-band']});
});

test('dishonest private-bit trace is rejected even with safe declaration elsewhere',()=>{
  const result=certifyObservableClosure({
    worlds,globalAuthorization:parity,
    externalChannels:['declared','out-of-band'],
    closure:{
      declared:{mode:'broker-owned',traces:factored},
      'out-of-band':{mode:'independently-verified',traces:privateBit}
    }
  });
  assert.equal(result.safe,false);
  assert.equal(result.reason,'OBSERVABLE_TRACE_REFINEMENT');
  assert.equal(result.channel,'out-of-band');
});

test('suppression is an enforceable constant, not a label',()=>{
  const result=certifyObservableClosure({
    worlds,globalAuthorization:parity,
    externalChannels:['timing'],
    closure:{timing:{mode:'suppressed',traces:privateBit}}
  });
  assert.equal(result.safe,false);
  assert.equal(result.reason,'SUPPRESSED_CHANNEL_NOT_CONSTANT');
});
