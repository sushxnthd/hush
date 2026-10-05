import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PrivateDecisionRuntime} from '../src/private-decision.js';
import {JointChoiceReconstructionFirewall} from '../src/joint-choice-firewall.js';
import {ContextKernel} from '../src/context-kernel.js';
import {callNativeMcpTool} from '../src/native-mcp.js';

function task(runtime,{sink='sink:test',agent='agent:test',maxBits=16}={}){
  const t=runtime.beginTrajectory({purpose:'adversarial-choice',maxBits,sinkMaxBits:maxBits});
  return (program)=>runtime.run({trajectoryId:t.trajectoryId,agent,sink,program});
}

function singleExactChoice(field,target){
  return {
    kind:'choose',
    candidates:[
      {id:'rare',target,bias:0},
      {id:'fallback',target:-1,bias:0.5}
    ],
    preferences:[
      {kind:'matchPrivate',candidate:'target',private:field,weight:1},
      {kind:'higherPublic',candidate:'bias',weight:1,scale:1}
    ]
  };
}

function thresholdChoice(field,threshold){
  return {
    kind:'choose',
    candidates:[
      {id:'below',cut:0,rank:0},
      {id:'at-or-above',cut:threshold,rank:1}
    ],
    constraints:[{op:'candidateLtePrivate',candidate:'cut',private:field}],
    preferences:[{kind:'higherPublic',candidate:'rank',weight:1,scale:1}]
  };
}

function exactPairChoice(aField,aValue,bField,bValue){
  return {
    kind:'choose',
    candidates:[
      {id:'rare',a:aValue,b:bValue,bias:0},
      {id:'fallback',a:-1,b:-1,bias:1.5}
    ],
    preferences:[
      {kind:'matchPrivate',candidate:'a',private:aField,weight:1},
      {kind:'matchPrivate',candidate:'b',private:bField,weight:1},
      {kind:'higherPublic',candidate:'bias',weight:1,scale:1}
    ]
  };
}

test('mixed protected and undeclared fields cannot downgrade choose accounting',()=>{
  const runtime=new PrivateDecisionRuntime({firewall:false});
  runtime.setPrivate('secret.protected',7,{domain:{type:'integer',min:0,max:15}});
  runtime.setPrivate('secret.dummy',1);
  const program={
    kind:'choose',
    candidates:[{id:'a',p:7,d:1},{id:'b',p:0,d:0}],
    preferences:[
      {kind:'matchPrivate',candidate:'p',private:'secret.protected',weight:1},
      {kind:'matchPrivate',candidate:'d',private:'secret.dummy',weight:1}
    ]
  };
  const out=task(runtime)(program);
  assert.equal(out.decision,'deny');
  assert.match(out.reason,/protected.*undeclared|declared finite domains/i);
  assert.equal('result' in out,false);
});

test('single protected-field choose is priced by realized winner partition',()=>{
  const rareRuntime=new PrivateDecisionRuntime({firewall:false});
  rareRuntime.setPrivate('secret.value',511,{domain:{type:'integer',min:0,max:511}});
  const rare=task(rareRuntime)(singleExactChoice('secret.value',511));
  assert.equal(rare.decision,'deny');
  assert.equal(rare.capacity.accounting,'realized-joint-choice');
  assert.equal(rare.joint.beforeCandidates,512);
  assert.equal(rare.joint.afterCandidates,1);
  assert.equal(rare.joint.totalKnowledgeBits,9);
  assert.equal('result' in rare,false);

  const commonRuntime=new PrivateDecisionRuntime({firewall:false});
  commonRuntime.setPrivate('secret.value',510,{domain:{type:'integer',min:0,max:511}});
  const common=task(commonRuntime)(singleExactChoice('secret.value',511));
  assert.equal(common.decision,'allow');
  assert.equal(common.result,'fallback');
  assert.equal(common.capacity.accounting,'realized-joint-choice');
  assert.equal(common.joint.afterCandidates,511);
  assert.ok(common.joint.marginalKnowledgeBits<0.01);
});

test('adaptive choice attack cannot reset by rotating tasks agents or sinks',()=>{
  const runtime=new PrivateDecisionRuntime({firewall:false});
  const secret=777;
  runtime.setPrivate('secret.value',secret,{domain:{type:'integer',min:0,max:1023}});
  let lo=0,hi=1023;
  let denied=null;
  for(let i=0;i<10;i++){
    const threshold=Math.floor((lo+hi+1)/2);
    const run=task(runtime,{sink:`sink:${i}`,agent:`agent:${i}`,maxBits:16});
    const out=run(thresholdChoice('secret.value',threshold));
    if(out.decision==='deny'){
      denied={i,out,lo,hi,threshold};
      break;
    }
    if(out.result==='at-or-above') lo=threshold;
    else hi=threshold-1;
  }
  assert.ok(denied,'expected cumulative choice reconstruction to be denied');
  assert.equal(denied.i,8,'eight balanced bits may be released; the ninth must be denied');
  assert.equal(denied.out.capacity.accounting,'realized-joint-choice');
  assert.match(denied.out.reason,/joint-choice knowledge/i);
  assert.equal('result' in denied.out,false);
  assert.ok(denied.out.joint.totalKnowledgeBits>8);
});

test('overlapping field groups compose transitively',()=>{
  const joint=new JointChoiceReconstructionFirewall({maxKnowledgeBits:2});
  const runtime=new PrivateDecisionRuntime({firewall:false,jointChoiceFirewall:joint});
  for(const field of ['secret.a','secret.b','secret.c']) runtime.setPrivate(field,1,{domain:{type:'integer',min:0,max:1}});

  const first=task(runtime)(exactPairChoice('secret.a',1,'secret.b',1));
  assert.equal(first.decision,'allow');
  assert.equal(first.result,'rare');
  assert.equal(first.joint.totalKnowledgeBits,2);

  const second=task(runtime,{sink:'sink:other',agent:'agent:other'})(exactPairChoice('secret.b',1,'secret.c',1));
  assert.equal(second.decision,'deny');
  assert.equal('result' in second,false);
  assert.deepEqual(second.joint.fields,['secret.a','secret.b','secret.c']);
  assert.equal(second.joint.totalKnowledgeBits,3);
});

test('large joint state space is analyzed or withheld before release',()=>{
  const runtime=new PrivateDecisionRuntime({firewall:false});
  runtime.setPrivate('secret.a',1,{domain:{type:'integer',min:0,max:399}});
  runtime.setPrivate('secret.b',1,{domain:{type:'integer',min:0,max:399}});
  const out=task(runtime)(exactPairChoice('secret.a',1,'secret.b',1));
  assert.equal(out.decision,'deny');
  assert.match(out.reason,/exceeds analyzable limit|joint-choice knowledge/i);
  assert.equal('result' in out,false);
});

test('updating an involved field resets stale joint observations but unrelated updates do not',()=>{
  const runtime=new PrivateDecisionRuntime({firewall:false});
  runtime.setPrivate('secret.a',0,{domain:{type:'integer',min:0,max:1}});
  runtime.setPrivate('secret.b',0,{domain:{type:'integer',min:0,max:1}});
  runtime.setPrivate('unrelated.value',0,{domain:{type:'integer',min:0,max:1}});
  const out=task(runtime)(exactPairChoice('secret.a',1,'secret.b',1));
  assert.equal(out.decision,'allow');
  assert.equal(runtime.jointChoiceFootprint().length,1);

  runtime.setPrivate('unrelated.value',1,{domain:{type:'integer',min:0,max:1}});
  assert.equal(runtime.jointChoiceFootprint().length,1);

  runtime.setPrivate('secret.a',1,{domain:{type:'integer',min:0,max:1}});
  assert.equal(runtime.jointChoiceFootprint().length,0);
});

test('native MCP withholds a rare joint-choice result before it reaches the client',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-joint-mcp-'));
  const kernel=new ContextKernel({dir,passphrase:'joint mcp privacy test passphrase'});
  for(let i=0;i<9;i++) kernel.put(`secret.bit${i}`,1,{domain:{type:'integer',min:0,max:1}});
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{purpose:'recommend',maxBits:16,sinkMaxBits:16},kernel,agent:'assistant',sink:'mcp:joint'});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const rare={id:'rare',bias:0};
  const fallback={id:'fallback',bias:8.5};
  const preferences=[];
  for(let i=0;i<9;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.bit${i}`,weight:1});
  }
  preferences.push({kind:'higherPublic',candidate:'bias',weight:1,scale:1});
  const out=callNativeMcpTool({name:'hush_private_decision',args:{trajectoryId,program:{kind:'choose',candidates:[rare,fallback],preferences}},kernel,agent:'assistant',sink:'mcp:joint'});
  assert.equal(out.isError,true);
  assert.equal(out.structuredContent.decision,'deny');
  assert.equal('result' in out.structuredContent,false);
  assert.equal(out.structuredContent.joint.afterCandidates,1);
  assert.equal(JSON.stringify(out).includes('"result":"rare"'),false);
});
