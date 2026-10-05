import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDecisionRuntime} from '../src/private-decision.js';

const FIXED=7;
const BRIDGE='secret.bridge';
const TARGET='secret.target';

function sevenBitRareProgram(){
  const rare={id:'rare',bias:FIXED-0.5,bridge:1};
  const fallback={id:'fallback',bias:0,bridge:0};
  const preferences=[];
  for(let i=0;i<FIXED;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.fixed${i}`,weight:1});
  }
  // Reference the bridge while contributing zero score. This makes it part of the
  // connected private component without changing which candidate wins.
  preferences.push({kind:'matchPrivate',candidate:'bridge',private:BRIDGE,weight:0});
  preferences.push({kind:'lowerPublic',candidate:'bias',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function bridgeTargetProgram(){
  return {
    kind:'choose',
    candidates:[
      {id:'rare',bridge:1,target:1,bias:1.5},
      {id:'fallback',bridge:0,target:0,bias:0}
    ],
    preferences:[
      {kind:'matchPrivate',candidate:'bridge',private:BRIDGE,weight:1},
      {kind:'matchPrivate',candidate:'target',private:TARGET,weight:1},
      {kind:'lowerPublic',candidate:'bias',weight:1,scale:1}
    ]
  };
}

test('v0.9 specialized guards permit a default-policy mixed choose-then-predicate transcript above the connected knowledge limit',()=>{
  const runtime=new PrivateDecisionRuntime();
  for(let i=0;i<FIXED;i++) runtime.setPrivate(`secret.fixed${i}`,1,{domain:{type:'integer',min:0,max:1}});
  runtime.setPrivate(BRIDGE,0,{domain:{type:'integer',min:0,max:1}});
  runtime.setPrivate(TARGET,1,{domain:{type:'integer',min:0,max:1}});

  const t1=runtime.beginTrajectory({purpose:'seven-bit-choice',maxBits:8,sinkMaxBits:8});
  const first=runtime.run({
    trajectoryId:t1.trajectoryId,
    agent:'choice-agent-a',
    sink:'choice-a.example',
    program:sevenBitRareProgram()
  });
  assert.equal(first.decision,'allow');
  assert.equal(first.result,'rare');
  assert.equal(first.joint?.afterCandidates,2);
  assert.equal(first.joint?.totalKnowledgeBits,7);

  const t2=runtime.beginTrajectory({purpose:'bridge-choice',maxBits:2,sinkMaxBits:2});
  const second=runtime.run({
    trajectoryId:t2.trajectoryId,
    agent:'choice-agent-b',
    sink:'choice-b.example',
    program:bridgeTargetProgram()
  });
  assert.equal(second.decision,'allow');
  assert.equal(second.result,'fallback');
  assert.equal(second.joint?.beforeCandidates,4);
  assert.equal(second.joint?.afterCandidates,3);
  assert.ok(second.joint?.totalKnowledgeBits<8);
  assert.ok(Math.abs(second.joint.totalKnowledgeBits-(9-Math.log2(3)))<1e-9);

  // The connected posterior now has exactly three possibilities for (bridge,target):
  // 00, 01, 10. Observing target==1 leaves only 01, so the conditional predicate
  // leaks log2(3) bits and takes total connected knowledge from ~7.415 to 9 bits.
  const trueConnectedAfterPredicateBits=9;

  const t3=runtime.beginTrajectory({purpose:'final-predicate',maxBits:2,sinkMaxBits:2});
  const final=runtime.run({
    trajectoryId:t3.trajectoryId,
    agent:'predicate-agent',
    sink:'predicate.example',
    program:{kind:'predicate',private:TARGET,op:'eq',value:1}
  });

  // This deliberately captures the v0.9 composition gap. The successor connected
  // posterior guard must change this outcome to deny before releasing `true`.
  assert.equal(final.decision,'allow');
  assert.equal(final.result,true);
  assert.equal(final.partition?.totalKnowledgeBits,1);
  assert.ok(trueConnectedAfterPredicateBits>8);
});
