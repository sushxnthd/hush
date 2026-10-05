import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';

function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'hush-kernel-')); }

function predicate(kernel,threshold){
  const t=kernel.beginTrajectory({purpose:`eligibility-${threshold}`,maxBits:1,sinkMaxBits:1});
  return kernel.run({trajectoryId:t.trajectoryId,agent:`agent-${threshold}`,sink:'bank.example',program:{kind:'predicate',private:'finance.balance',op:'gt',value:threshold}});
}

test('kernel persists encrypted context and reconstruction state across restart',()=>{
  const dir=temp();
  const passphrase='persistent context passphrase';
  let kernel=new ContextKernel({dir,passphrase,firewallOptions:{fieldBudgetBits:2,audienceBudgetBits:2}});
  kernel.put('finance.balance',734219,{category:'finance'});
  assert.equal(predicate(kernel,500000).decision,'allow');
  assert.equal(predicate(kernel,700000).decision,'allow');

  const persisted=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  assert.equal(persisted.includes('734219'),false);
  assert.equal(persisted.includes('finance.balance'),false);

  kernel=new ContextKernel({dir,passphrase,firewallOptions:{fieldBudgetBits:2,audienceBudgetBits:2}});
  const blocked=predicate(kernel,750000);
  assert.equal(blocked.decision,'deny');
  assert.match(blocked.reason,/Persistent reconstruction budget/);
  assert.equal(kernel.exposure()[0].spentBits,2);
});

test('kernel returns metadata but not stored values',()=>{
  const kernel=new ContextKernel({dir:temp(),passphrase:'metadata only passphrase'});
  kernel.put('travel.preferredAirline','ANA',{category:'preference',tags:['travel']});
  const listed=kernel.list();
  assert.equal(listed.length,1);
  assert.equal('value' in listed[0],false);
  assert.equal(listed[0].path,'travel.preferredAirline');
});

test('kernel can perform blind personalization from sealed private state',()=>{
  const kernel=new ContextKernel({dir:temp(),passphrase:'blind personalization passphrase'});
  kernel.put('travel.maxBudget',1500,{category:'finance'});
  kernel.put('travel.preferredAirline','ANA',{category:'preference'});
  const t=kernel.beginTrajectory({purpose:'flight',maxBits:3,sinkMaxBits:3});
  const out=kernel.run({trajectoryId:t.trajectoryId,agent:'travel-agent',sink:'travel.example',program:{
    kind:'choose',
    candidates:[{id:'a',price:1200,airline:'JAL'},{id:'b',price:1490,airline:'ANA'},{id:'c',price:1800,airline:'ANA'}],
    constraints:[{op:'candidateLtePrivate',candidate:'price',private:'travel.maxBudget'}],
    preferences:[{kind:'matchPrivate',candidate:'airline',private:'travel.preferredAirline',weight:10}]
  }});
  assert.equal(out.decision,'allow');
  assert.equal(out.result,'b');
  assert.equal(JSON.stringify(out).includes('1500'),false);
  assert.equal(JSON.stringify(out).includes('ANA'),false);
});
