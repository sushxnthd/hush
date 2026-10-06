import test from 'node:test';
import assert from 'node:assert/strict';
import {policyAllowsFieldV5,compileDisclosureV5} from './policy_compiler_v5.mjs';

function record(policy,fields){return {generated_texts:{privacy_policy_text:policy},source_document_inputs:{private_fields_embedded:fields,task_relevant_fields:{}}};}

test('legal high-level summary may be released while private notes remain blocked',()=>{
  const p='You can provide a high level summary of the legal issue. However, keep private legal notes confidential.';
  assert.equal(policyAllowsFieldV5(p,'task_relevant_fact'),true);
  assert.equal(policyAllowsFieldV5(p,'private_legal_notes'),false);
});

test('general travel date window may be released while exact itinerary stays blocked',()=>{
  const p='You can share a general window of travel dates. Do not disclose my precise travel schedule or exact itinerary.';
  assert.equal(policyAllowsFieldV5(p,'travel_date_window'),true);
  assert.equal(policyAllowsFieldV5(p,'exact_itinerary'),false);
  const out=compileDisclosureV5(record(p,{travel_date_window:'mid June',exact_itinerary:'Flight 123 at 08:05 on June 14'})).text;
  assert.match(out,/travel date window: mid June/i);
  assert.doesNotMatch(out,/Flight 123/i);
});

test('explicit denial of a travel date window still wins',()=>{
  const p='You can describe my trip generally, but do not share my travel date window.';
  assert.equal(policyAllowsFieldV5(p,'travel_date_window'),false);
});

test('high-level legal summary permission does not release raw legal notes',()=>{
  const p='You may provide a high level summary of the case. All privileged legal strategy and private notes are off limits.';
  const out=compileDisclosureV5(record(p,{task_relevant_fact:'Contract dispute about delivery timing',private_legal_notes:'Settle below $40k'})).text;
  assert.match(out,/contract dispute/i);
  assert.doesNotMatch(out,/40k/i);
});

test('generic case permission without high-level abstraction wording does not create a new override',()=>{
  const p='You can discuss the case type. Keep case details private.';
  assert.equal(policyAllowsFieldV5(p,'task_relevant_fact'),false);
});
