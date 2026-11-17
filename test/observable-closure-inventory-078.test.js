import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyObservableClosure} from '../src/observable-closure-contract.js';

// HUSH-078: certificate scope counterexample. A complete certificate over a
// *declared* channel set is not proof that the deployed observer sees no other
// channel. The extra channel is deliberately private-dependent.
test('HUSH-078: undeclared observable is not covered by certificate',()=>{
  const worlds=['private0','private1'];
  const globalAuthorization={private0:'ask',private1:'ask'};
  const externalChannels=['http.body'];
  const closure={
    'http.body':{mode:'suppressed',traces:{private0:[],private1:[]}},
    'http.response-order':{mode:'suppressed',traces:{
      private0:['a','b'],private1:['b','a']
    }}
  };
  const certificate=certifyObservableClosure({worlds,globalAuthorization,externalChannels,closure});
  // Existing implementation returns safe:true and lists the omitted channel.
  // This is a deliberately failing security expectation, not a passing suite.
  assert.equal(certificate.safe,false,
    'FAIL-CLOSED required: undeclared private-dependent channel cannot be ignored');
});
