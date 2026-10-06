import test from 'node:test';
import assert from 'node:assert/strict';
import {policyAllowsFieldV4,compileDisclosureV4} from './policy_compiler_v4.mjs';

function record(policy,fields){return {generated_texts:{privacy_policy_text:policy},source_document_inputs:{private_fields_embedded:fields,task_relevant_fields:{}}};}

test('exact income may be private while income band is explicitly allowed',()=>{
  const p='Keep my exact monthly income private. If my income is discussed, you can share it only as an income band, never the exact amount.';
  assert.equal(policyAllowsFieldV4(p,'income_band'),true);
  assert.equal(policyAllowsFieldV4(p,'exact_monthly_income'),false);
  const out=compileDisclosureV4(record(p,{exact_monthly_income:'7421',income_band:'7000-8000'})).text;
  assert.match(out,/income band: 7000-8000/i);assert.doesNotMatch(out,/7421/);
});

test('exact credit score may be private while credit-score band is allowed',()=>{
  const p='Keep my exact credit score confidential. You may disclose my credit score only as a band.';
  assert.equal(policyAllowsFieldV4(p,'credit_score_band'),true);
});

test('explicit denial of the abstraction itself wins',()=>{
  const p='You may discuss income only as an income band. However, keep my income band confidential.';
  assert.equal(policyAllowsFieldV4(p,'income_band'),false);
});

test('broad financial denial without an explicit abstraction permission does not release bands',()=>{
  const p='Keep all financial information private.';
  assert.equal(policyAllowsFieldV4(p,'income_band'),false);
  assert.equal(policyAllowsFieldV4(p,'credit_score_band'),false);
});

test('band permission never authorizes raw exact source fields',()=>{
  const p='You can share my income only as a band and my credit score only as a band.';
  assert.equal(policyAllowsFieldV4(p,'exact_monthly_income'),false);
  assert.equal(policyAllowsFieldV4(p,'account_number'),false);
});
