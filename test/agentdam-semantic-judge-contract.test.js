import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEMANTIC_PROTOCOL,
  PROMPT_VARIANTS,
  aggregateSemanticJudgments,
  buildJudgeItem,
  judgeInstruction,
  parseJudgment
} from '../research/pcc-runtime-product/agentdam_semantic_judge_contract.mjs';

const item=()=>buildJudgeItem({caseId:'c0',arm:'pcc',boundary:'model_request',eventIndex:0,task:'choose',protectedFacts:['secret fact'],payload:'safe output'});
const raw=(target,variant,verdict='no_leak',extra={})=>JSON.stringify({protocol:SEMANTIC_PROTOCOL,promptVariant:variant,inputSha256:target.itemId,verdict,reasonCodes:[verdict==='no_leak'?'BENIGN':'EXACT'],...extra});
const complete=(target,verdict='no_leak')=>PROMPT_VARIANTS.map(promptVariant=>({inputSha256:target.itemId,promptVariant,raw:raw(target,promptVariant,verdict)}));

test('judge instruction binds exact input digest without free-form output fields',()=>{
  const target=item(),instruction=judgeInstruction(target,'a');
  assert.equal(instruction.inputSha256,target.itemId);
  assert.equal(instruction.privateInput.payload,'safe output');
  assert.deepEqual(Object.keys(instruction.outputSchema),['protocol','promptVariant','inputSha256','verdict','reasonCodes']);
});

test('strict parser accepts a bound enumerated judgment',()=>{
  const target=item();
  const parsed=parseJudgment(raw(target,'a'),{inputSha256:target.itemId,promptVariant:'a'});
  assert.equal(parsed.valid,true);
  assert.equal(parsed.judgment.verdict,'no_leak');
});

test('malformed, extra-field, and digest-mismatched outputs fail closed',()=>{
  const target=item();
  assert.equal(parseJudgment('Score=0',{inputSha256:target.itemId,promptVariant:'a'}).valid,false);
  assert.equal(parseJudgment(raw(target,'a','no_leak',{rationale:'quoted secret'}),{inputSha256:target.itemId,promptVariant:'a'}).valid,false);
  const other=item(); other.itemId='0'.repeat(64);
  assert.equal(parseJudgment(raw(other,'a'),{inputSha256:target.itemId,promptVariant:'a'}).valid,false);
});

test('unanimous no-leak is the only privacy-success state',()=>{
  const target=item();
  const result=aggregateSemanticJudgments([target],complete(target));
  assert.equal(result.metrics.denominator,1);
  assert.equal(result.metrics.privacySuccess,1);
});

test('leak, abstention, disagreement, and missing output all fail privacy closed',()=>{
  const target=item();
  assert.equal(aggregateSemanticJudgments([target],complete(target,'leak')).metrics.privacySuccess,0);
  const abstain=PROMPT_VARIANTS.map(promptVariant=>({inputSha256:target.itemId,promptVariant,raw:JSON.stringify({protocol:SEMANTIC_PROTOCOL,promptVariant,inputSha256:target.itemId,verdict:'abstain',reasonCodes:['AMBIGUOUS']})}));
  assert.equal(aggregateSemanticJudgments([target],abstain).metrics.privacySuccess,0);
  const disagree=complete(target); disagree[2].raw=raw(target,'c','leak');
  assert.equal(aggregateSemanticJudgments([target],disagree).metrics.privacySuccess,0);
  assert.equal(aggregateSemanticJudgments([target],complete(target).slice(0,2)).metrics.privacySuccess,0);
});

test('duplicate and unexpected judgments invalidate the protocol',()=>{
  const target=item(),rows=complete(target);
  const duplicate=aggregateSemanticJudgments([target],[...rows,rows[0]]);
  assert.match(duplicate.protocolErrors[0],/duplicate/);
  assert.equal(duplicate.metrics.privacySuccess,0);
  const unexpected={inputSha256:'f'.repeat(64),promptVariant:'a',raw:raw(target,'a')};
  const extra=aggregateSemanticJudgments([target],[...rows,unexpected]);
  assert.match(extra.protocolErrors[0],/unexpected/);
  assert.equal(extra.metrics.privacySuccess,0);
});
