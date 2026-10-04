import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDecisionRuntime} from '../src/private-decision.js';

const WIDTH=16;

function probeProgram(width=WIDTH){
  const rare={id:'rare-profile',bias:width-0.5};
  const fallback={id:'fallback',bias:0};
  const preferences=[];
  for(let i=0;i<width;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.bit${i}`,weight:1});
  }
  preferences.push({kind:'lowerPublic',candidate:'bias',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function runtimeFor(bits,{joint=true}={}){
  const runtime=new PrivateDecisionRuntime({firewall:false,jointChoiceFirewall:joint?undefined:false});
  for(let i=0;i<bits.length;i++) runtime.setPrivate(`secret.bit${i}`,bits[i],{domain:{type:'integer',min:0,max:1}});
  return runtime;
}

function run(runtime,program){
  const task=runtime.beginTrajectory({purpose:'candidate-set-probe',maxBits:2,sinkMaxBits:2});
  return runtime.run({trajectoryId:task.trajectoryId,agent:'adversarial-recommender',sink:'recommender.example',program});
}

test('cardinality-only choose accounting allows a rare winner that identifies a 16-bit profile',()=>{
  const runtime=runtimeFor(Array(WIDTH).fill(1),{joint:false});
  const out=run(runtime,probeProgram());
  assert.equal(out.decision,'allow');
  assert.equal(out.result,'rare-profile');
  assert.equal(out.capacity.accounting,'output-cardinality');
  assert.ok(Math.abs(out.capacity.marginalBits-Math.log2(3))<1e-6);
});

test('joint-choice firewall denies the same rare winner before release',()=>{
  const runtime=runtimeFor(Array(WIDTH).fill(1));
  const out=run(runtime,probeProgram());
  assert.equal(out.decision,'deny');
  assert.match(out.reason,/joint-choice knowledge/i);
  assert.equal(out.capacity.accounting,'realized-joint-choice');
  assert.equal(out.joint.beforeCandidates,2**WIDTH);
  assert.equal(out.joint.afterCandidates,1);
  assert.equal(out.joint.totalKnowledgeBits,WIDTH);
  assert.equal('result' in out,false);
});

test('common winner is allowed and charged only by realized joint shrinkage',()=>{
  const bits=Array(WIDTH).fill(1);
  bits[WIDTH-1]=0;
  const runtime=runtimeFor(bits);
  const out=run(runtime,probeProgram());
  assert.equal(out.decision,'allow');
  assert.equal(out.result,'fallback');
  assert.equal(out.capacity.accounting,'realized-joint-choice');
  assert.equal(out.joint.afterCandidates,2**WIDTH-1);
  assert.ok(out.joint.marginalKnowledgeBits<0.001);
  assert.ok(out.capacity.marginalBits<0.001);
});

test('same released choice across a fresh task adds zero joint knowledge',()=>{
  const bits=Array(WIDTH).fill(1);
  bits[0]=0;
  const runtime=runtimeFor(bits);
  const program=probeProgram();
  const first=run(runtime,program);
  const second=run(runtime,program);
  assert.equal(first.decision,'allow');
  assert.equal(second.decision,'allow');
  assert.equal(second.joint.observationsComposed,1);
  assert.equal(second.joint.marginalKnowledgeBits,0);
  assert.equal(second.capacity.marginalBits,0);
});

test('public joint-choice footprint does not reveal the selected result',()=>{
  const bits=Array(WIDTH).fill(1);
  bits[0]=0;
  const runtime=runtimeFor(bits);
  const out=run(runtime,probeProgram());
  assert.equal(out.decision,'allow');
  const footprint=runtime.jointChoiceFootprint();
  assert.equal(footprint.length,1);
  assert.equal('result' in footprint[0],false);
  assert.equal(JSON.stringify(footprint).includes('fallback'),false);
  assert.deepEqual(footprint[0].fields,Array.from({length:WIDTH},(_,i)=>`secret.bit${i}`).sort());
});
