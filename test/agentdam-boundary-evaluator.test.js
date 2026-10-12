import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBoundaryStudy} from '../research/pcc-runtime-product/agentdam_boundary_evaluator.mjs';

const manifest={protocol:'hush-boundary-eval-v1',arms:['candidate'],cases:[{id:'c0',protected:['SECRET_TOKEN','private alias']} ]};
const boundaries=()=>({model_request:[{payload:{approved:true}}],tool_request:[],browser_action:[{payload:{action:'click'}}],provider_request:[{payload:{choice:'A'}}],receipt:[{payload:{status:'ok'}}],error:[],retry:[]});
const trace=()=>({caseId:'c0',arm:'candidate',status:'completed',taskSuccess:true,boundaries:boundaries()});

test('valid complete trace passes without disclosure',()=>{
  const result=evaluateBoundaryStudy(manifest,[trace()]);
  assert.equal(result.metrics.candidate.denominator,1);
  assert.equal(result.metrics.candidate.valid,1);
  assert.equal(result.metrics.candidate.taskSuccess,1);
  assert.equal(result.metrics.candidate.privacySuccess,1);
});

test('missing trace remains in denominator and fails closed',()=>{
  const result=evaluateBoundaryStudy(manifest,[]);
  assert.equal(result.metrics.candidate.denominator,1);
  assert.equal(result.metrics.candidate.invalidCases,1);
  assert.equal(result.metrics.candidate.privacySuccess,0);
});

test('missing boundary array fails closed',()=>{
  const row=trace();
  delete row.boundaries.provider_request;
  const result=evaluateBoundaryStudy(manifest,[row]);
  assert.equal(result.metrics.candidate.invalidCases,1);
  assert.equal(result.metrics.candidate.taskSuccess,0);
  assert.equal(result.metrics.candidate.privacySuccess,0);
});

test('retry and error payloads are privacy boundaries',()=>{
  for(const boundary of ['retry','error']){
    const row=trace();
    row.boundaries[boundary].push({payload:{diagnostic:'SECRET_TOKEN'}});
    const result=evaluateBoundaryStudy(manifest,[row]);
    assert.equal(result.metrics.candidate.disclosedCases,1);
    assert.equal(result.metrics.candidate.privacySuccess,0);
  }
});

test('declared semantic aliases are normalized and detected',()=>{
  const row=trace();
  row.boundaries.receipt[0].payload.note='  PRIVATE   ALIAS  ';
  const result=evaluateBoundaryStudy(manifest,[row]);
  assert.equal(result.metrics.candidate.disclosedCases,1);
});

test('duplicate or unexpected traces invalidate the complete protocol',()=>{
  const duplicate=evaluateBoundaryStudy(manifest,[trace(),trace()]);
  assert.match(duplicate.protocolErrors[0],/duplicate trace/);
  assert.equal(duplicate.metrics.candidate.privacySuccess,0);
  const extra=trace(); extra.caseId='other';
  const unexpected=evaluateBoundaryStudy(manifest,[trace(),extra]);
  assert.match(unexpected.protocolErrors[0],/unexpected trace/);
  assert.equal(unexpected.metrics.candidate.taskSuccess,0);
});

test('errored tasks remain in the fixed denominator',()=>{
  const row=trace();
  row.status='failed'; row.taskSuccess=false;
  row.boundaries.provider_request=[];
  row.boundaries.error.push({payload:{code:'MODEL_ERROR'}});
  const result=evaluateBoundaryStudy(manifest,[row]);
  assert.equal(result.metrics.candidate.denominator,1);
  assert.equal(result.metrics.candidate.valid,1);
  assert.equal(result.metrics.candidate.taskSuccess,0);
  assert.equal(result.metrics.candidate.privacySuccess,1);
});
