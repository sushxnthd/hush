import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';

const WIDTH=8;

function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'hush-joint-choice-')); }

function program(){
  const rare={id:'rare-profile',bias:WIDTH-0.5};
  const fallback={id:'fallback',bias:0};
  const preferences=[];
  for(let i=0;i<WIDTH;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.bit${i}`,weight:1});
  }
  preferences.push({kind:'lowerPublic',candidate:'bias',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function query(kernel){
  const task=kernel.beginTrajectory({purpose:'persistent-choice-probe',maxBits:2,sinkMaxBits:2});
  return kernel.run({trajectoryId:task.trajectoryId,agent:'recommender',sink:'recommender.example',program:program()});
}

test('joint choice observations survive encrypted Context Kernel restart',()=>{
  const dir=temp();
  const passphrase='joint choice persistence passphrase';
  let kernel=new ContextKernel({dir,passphrase});
  for(let i=0;i<WIDTH;i++) kernel.put(`secret.bit${i}`,i===0?0:1,{domain:{type:'integer',min:0,max:1}});

  const first=query(kernel);
  assert.equal(first.decision,'allow');
  assert.equal(first.result,'fallback');
  assert.equal(first.joint.observationsComposed,0);
  assert.equal(kernel.jointChoiceExposure().length,1);

  const persisted=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  assert.equal(persisted.includes('rare-profile'),false);
  assert.equal(persisted.includes('secret.bit0'),false);

  kernel=new ContextKernel({dir,passphrase});
  const second=query(kernel);
  assert.equal(second.decision,'allow');
  assert.equal(second.result,'fallback');
  assert.equal(second.joint.observationsComposed,1);
  assert.equal(second.joint.marginalKnowledgeBits,0);
  assert.equal(second.capacity.marginalBits,0);
});
