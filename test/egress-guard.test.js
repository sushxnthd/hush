import test from 'node:test';
import assert from 'node:assert/strict';
import {guardOutboundValue} from '../src/egress-guard.js';

test('egress guard removes long copied private spans while preserving unrelated text',()=>{
  const source='Case details: Mr. Smithson is accused of embezzling a significant amount of funds. The witness evidence is disputed.';
  const outbound='Public update: Mr. Smithson is accused of embezzling a significant amount of funds. More details will follow.';
  const out=guardOutboundValue(outbound,{protectedValues:[source],mode:'pseudonymous'});
  assert.equal(out.sanitized.includes('embezzling a significant amount of funds'),false);
  assert.equal(out.sanitized.startsWith('Public update:'),true);
  assert.equal(out.sanitized.endsWith('More details will follow.'),true);
  assert.ok(out.protectedMatches>=1);
});

test('egress guard leaves unrelated prose substantially intact',()=>{
  const source='The patient discussed a confidential medication change during the appointment yesterday.';
  const outbound='The appointment has been completed and the follow-up is scheduled for next week.';
  const out=guardOutboundValue(outbound,{protectedValues:[source],mode:'pseudonymous'});
  assert.equal(out.sanitized,outbound);
  assert.equal(out.protectedMatches,0);
});

test('egress guard handles structured outbound payloads',()=>{
  const protectedValue={notes:'The customer is renegotiating their mortgage because of a temporary income loss.'};
  const outbound={recipient:'external-team',body:'Status: the customer is renegotiating their mortgage because of a temporary income loss. Please review.'};
  const out=guardOutboundValue(outbound,{protectedValues:[protectedValue],mode:'pseudonymous'});
  assert.equal(String(out.sanitized.body).includes('renegotiating their mortgage because of a temporary income loss'),false);
  assert.equal(out.sanitized.recipient.startsWith('[person-')||out.sanitized.recipient==='external-team',true);
});
