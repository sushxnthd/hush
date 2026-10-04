import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDecisionRuntime} from '../src/private-decision.js';

function rareBitsProgram(width){
  const rare={id:'rare',penalty:width-0.5};
  const fallback={id:'fallback',penalty:0};
  const preferences=[];
  for(let i=0;i<width;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.bit${i}`,weight:1});
  }
  preferences.push({kind:'lowerPublic',candidate:'penalty',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function runtimeWithBits(width,value){
  const runtime=new PrivateDecisionRuntime({firewall:false});
  for(let i=0;i<width;i++) runtime.setPrivate(`secret.bit${i}`,value,{domain:{type:'integer',min:0,max:1}});
  return runtime;
}

function run(runtime,program){
  const trajectory=runtime.beginTrajectory({purpose:'symbolic-runtime',maxBits:64,sinkMaxBits:64});
  return runtime.run({trajectoryId:trajectory.trajectoryId,agent:'stress-agent',sink:'stress-sink',program});
}

test('runtime symbolically blocks a rare winner over 2^32 private profiles',()=>{
  const runtime=runtimeWithBits(32,1);
  const out=run(runtime,rareBitsProgram(32));
  assert.equal(out.decision,'deny');
  assert.equal('result' in out,false);
  assert.equal(out.capacity.accounting,'realized-joint-choice');
  assert.equal(out.joint.beforeCandidates,2**32);
  assert.equal(out.joint.afterCandidates,1);
  assert.equal(out.joint.totalKnowledgeBits,32);
  assert.equal(out.joint.analysis.method,'symbolic-branch-and-bound');
  assert.ok(out.joint.analysis.nodesVisited<200,`expected symbolic pruning, visited ${out.joint.analysis.nodesVisited}`);
});

test('sub-nanobit common winner is still recorded internally despite rounded public display',()=>{
  const runtime=runtimeWithBits(32,0);
  const out=run(runtime,rareBitsProgram(32));
  assert.equal(out.decision,'allow');
  assert.equal(out.result,'fallback');
  assert.equal(out.joint.beforeCandidates,2**32);
  assert.equal(out.joint.afterCandidates,2**32-1);
  assert.equal(out.joint.analysis.method,'symbolic-branch-and-bound');
  assert.equal(out.joint.marginalKnowledgeBits,0,'public report may round the tiny value to zero');
  assert.equal(runtime.jointChoiceFootprint().length,1,'nonzero leakage must still be persisted internally');
});
