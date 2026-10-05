import test from 'node:test';
import assert from 'node:assert/strict';
import {guardGroundedOutboundValue} from '../src/grounded-egress-guard.js';

test('grounded guard blocks a paraphrased clause derived from protected context',()=>{
  const protectedValues=[{
    note:'Alice was prescribed sertraline 50 mg to treat depression and asked that the diagnosis remain private.'
  }];
  const result=guardGroundedOutboundValue(
    'Alice takes sertraline 50 mg for depression. Please schedule a follow-up next week.',
    {protectedValues}
  );
  assert.equal(result.groundedContextGuard,true);
  assert.ok(result.groundedMatches>=1);
  assert.equal(String(result.sanitized).includes('sertraline'),false);
  assert.equal(String(result.sanitized).includes('schedule a follow-up'),true);
});

test('grounded guard preserves unrelated outbound text',()=>{
  const protectedValues=['Private note: Bob is handling a pending legal case for a bank official accused of embezzlement.'];
  const result=guardGroundedOutboundValue(
    'The quarterly project review is scheduled for Tuesday afternoon.',
    {protectedValues}
  );
  assert.equal(result.groundedMatches,0);
  assert.equal(result.sanitized,'The quarterly project review is scheduled for Tuesday afternoon.');
});

test('grounded guard recursively protects structured payload strings',()=>{
  const protectedValues=[{message:'Carol told us her passport number is XH1234567 and her flight departs Monday morning.'}];
  const result=guardGroundedOutboundValue({
    subject:'Trip update',
    body:'Carol passport XH1234567 flight departs Monday morning.',
    status:'ready'
  },{protectedValues,minOverlapTokens:3,minCoverage:0.5,minWeightedCoverage:0.5});
  assert.ok(result.groundedMatches>=1);
  assert.equal(JSON.stringify(result.sanitized).includes('XH1234567'),false);
});
