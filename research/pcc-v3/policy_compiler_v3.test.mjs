import test from 'node:test';
import assert from 'node:assert/strict';
import {compileDisclosureV3,policyAllowsFieldV3} from './policy_compiler_v3.mjs';

function record(policy,fields){return {generated_texts:{privacy_policy_text:policy},source_document_inputs:{private_fields_embedded:fields,task_relevant_fields:{}}};}

test('new target-role alias permits affirmative paraphrase',()=>{
  const p='You can share my current role and the role I am targeting.';
  assert.equal(policyAllowsFieldV3(p,'target_role'),true);
});

test('semantic deny overrides positive target-role alias',()=>{
  const p='You can share the role I am targeting. However, keep all employment information private.';
  assert.equal(policyAllowsFieldV3(p,'target_role'),false);
  assert.equal(compileDisclosureV3(record(p,{target_role:'Research Engineer'})).text,'');
});

test('semantic deny overrides troubleshooting alias',()=>{
  const p='You can share the steps we have taken to troubleshoot. However, all support troubleshooting details must not be disclosed.';
  // No v2 semantic category covers generic support details, so an exact/direct deny must still prevent release.
  assert.equal(policyAllowsFieldV3(p,'troubleshooting_steps'),false);
});

test('contact deny does not suppress unrelated customer-support allows',()=>{
  const p='You can share the category of the problem, the steps we have taken to troubleshoot, and how I am feeling about the situation. Keep all contact information private.';
  const out=compileDisclosureV3(record(p,{issue_category:'billing',troubleshooting_steps:'restarted app',customer_sentiment:'frustrated',email:'person@example.test'})).text;
  assert.match(out,/issue category: billing/i);
  assert.match(out,/troubleshooting steps: restarted app/i);
  assert.match(out,/customer sentiment: frustrated/i);
  assert.doesNotMatch(out,/person@example\.test/i);
});

test('new aliases cannot release transform-only raw concepts',()=>{
  const p='You can share the exact itinerary and the role I am targeting.';
  assert.equal(policyAllowsFieldV3(p,'exact_itinerary'),false);
  assert.equal(policyAllowsFieldV3(p,'target_role'),true);
});
