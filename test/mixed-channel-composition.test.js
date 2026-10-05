import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDecisionRuntime} from '../src/private-decision.js';

const FIXED=6;
const BRIDGE='secret.bridge';
const HELPER='secret.helper';
const TARGET='secret.target';

function sixBitRareProgram(){
  const rare={id:'rare',bias:FIXED-0.5,bridge:1};
  const fallback={id:'fallback',bias:0,bridge:0};
  const preferences=[];
  for(let i=0;i<FIXED;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.fixed${i}`,weight:1});
  }
  // Reference bridge without changing the winner. This joins it to the same
  // reconstruction component while leaving its value completely unresolved.
  preferences.push({kind:'matchPrivate',candidate:'bridge',private:BRIDGE,weight:0});
  preferences.push({kind:'lowerPublic',candidate:'bias',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function bridgeHelperRareProgram(){
  return {
    kind:'choose',
    candidates:[
      {id:'rare',bridge:1,helper:1,target:1,bias:1.5},
      {id:'fallback',bridge:0,helper:0,target:0,bias:0}
    ],
    preferences:[
      {kind:'matchPrivate',candidate:'bridge',private:BRIDGE,weight:1},
      {kind:'matchPrivate',candidate:'helper',private:HELPER,weight:1},
      // Target is deliberately connected but contributes no score, so this choice
      // leaves target perfectly unresolved.
      {kind:'matchPrivate',candidate:'target',private:TARGET,weight:0},
      {kind:'lowerPublic',candidate:'bias',weight:1,scale:1}
    ]
  };
}

test('v0.9 specialized guards permit a default-policy mixed choose-then-predicate transcript above the connected knowledge limit',()=>{
  const runtime=new PrivateDecisionRuntime();
  for(let i=0;i<FIXED;i++) runtime.setPrivate(`secret.fixed${i}`,1,{domain:{type:'integer',min:0,max:1}});
  runtime.setPrivate(BRIDGE,1,{domain:{type:'integer',min:0,max:1}});
  runtime.setPrivate(HELPER,1,{domain:{type:'integer',min:0,max:1}});
  runtime.setPrivate(TARGET,1,{domain:{type:'integer',min:0,max:1}});

  // Query 1: 7 connected binary fields, but bridge remains free. Support 128 -> 2,
  // so the realized release is exactly 6 bits: equal to the default audience cap.
  const t1=runtime.beginTrajectory({purpose:'six-bit-choice',maxBits:6,sinkMaxBits:6});
  const first=runtime.run({
    trajectoryId:t1.trajectoryId,
    agent:'choice-agent-a',
    sink:'choice-a.example',
    program:sixBitRareProgram()
  });
  assert.equal(first.decision,'allow');
  assert.equal(first.result,'rare');
  assert.equal(first.joint?.afterCandidates,2);
  assert.equal(first.joint?.totalKnowledgeBits,6);

  // Query 2 expands the connected component to all 9 fields. Under the first
  // observation 8 assignments remain (bridge,helper,target are free). Requiring
  // bridge=helper=1 leaves target free: support 8 -> 2, exactly +2 bits. Total=8.
  const t2=runtime.beginTrajectory({purpose:'bridge-helper-choice',maxBits:2,sinkMaxBits:2});
  const second=runtime.run({
    trajectoryId:t2.trajectoryId,
    agent:'choice-agent-b',
    sink:'choice-b.example',
    program:bridgeHelperRareProgram()
  });
  assert.equal(second.decision,'allow');
  assert.equal(second.result,'rare');
  assert.equal(second.joint?.beforeCandidates,8);
  assert.equal(second.joint?.afterCandidates,2);
  assert.equal(second.joint?.marginalKnowledgeBits,2);
  assert.equal(second.joint?.totalKnowledgeBits,8);

  // Target is still 0/1 in the connected posterior. Revealing target==1 therefore
  // collapses support 2 -> 1 and takes true connected knowledge from 8 to 9 bits.
  const t3=runtime.beginTrajectory({purpose:'final-predicate',maxBits:1,sinkMaxBits:1});
  const final=runtime.run({
    trajectoryId:t3.trajectoryId,
    agent:'predicate-agent',
    sink:'predicate.example',
    program:{kind:'predicate',private:TARGET,op:'eq',value:1}
  });

  // This deliberately captures the v0.9 composition gap. The successor connected
  // posterior guard must change this outcome to DENY before releasing `true`.
  assert.equal(final.decision,'allow');
  assert.equal(final.result,true);
  assert.equal(final.partition?.totalKnowledgeBits,1);
});
