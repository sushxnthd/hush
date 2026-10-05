import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ModelRouter,modelRouterOptions} from '../src/model-router.js';
import {ContextKernel} from '../src/context-kernel.js';

function models(router){
  router.register({id:'local-fast',provider:'local',locality:'local',trustLevel:'trusted',capabilities:['chat','tools'],quality:0.65,inputCostPerMillion:0,outputCostPerMillion:0,latencyMs:200,toolUse:true});
  router.register({id:'remote-smart',provider:'provider-a',locality:'remote',trustLevel:'standard',capabilities:['chat','tools','reasoning'],quality:0.95,inputCostPerMillion:2,outputCostPerMillion:8,latencyMs:800,toolUse:true});
  router.register({id:'remote-limited',provider:'provider-b',locality:'remote',trustLevel:'limited',capabilities:['chat','reasoning'],quality:0.99,inputCostPerMillion:1,outputCostPerMillion:3,latencyMs:500,toolUse:false});
  return router;
}

test('router options make raw private-context routing impossible by construction',()=>{
  assert.deepEqual(modelRouterOptions().privateContextModes,['none','bounded','sanitized']);
  const router=models(new ModelRouter());
  assert.throws(()=>router.route({privateContext:'raw'}),/does not route tasks that require raw private context/);
});

test('bounded private computation can route to the strongest remote model without copying raw context',()=>{
  const router=models(new ModelRouter());
  const out=router.route({requiredCapabilities:['reasoning','tools'],privateContext:'bounded',privacyPreference:'strict'});
  assert.equal(out.decision,'allow');
  assert.equal(out.model.id,'remote-smart');
  assert.equal(out.request.privateContext,'bounded');
});

test('strict sanitized-context tasks stay local even when a remote model scores higher on quality',()=>{
  const router=models(new ModelRouter());
  const out=router.route({requiredCapabilities:['chat'],privateContext:'sanitized',privacyPreference:'strict'});
  assert.equal(out.decision,'allow');
  assert.equal(out.model.id,'local-fast');
  assert.ok(out.rejected.some(x=>x.id==='remote-smart'&&x.reason==='strict-sanitized-context-requires-local-model'));
});

test('balanced mode rejects limited remote models for sanitized context',()=>{
  const router=models(new ModelRouter());
  const out=router.route({requiredCapabilities:['reasoning'],privateContext:'sanitized',privacyPreference:'balanced'});
  assert.equal(out.decision,'allow');
  assert.equal(out.model.id,'remote-smart');
  assert.ok(out.rejected.some(x=>x.id==='remote-limited'&&x.reason==='sanitized-context-requires-standard-or-trusted-remote-model'));
});

test('router respects hard capability, tool, cost and latency constraints',()=>{
  const router=models(new ModelRouter());
  const out=router.route({requiredCapabilities:['reasoning'],requiresTools:true,privateContext:'none',maxOutputCostPerMillion:5,maxLatencyMs:600});
  assert.equal(out.decision,'deny');
  assert.ok(out.rejected.some(x=>x.id==='remote-smart'&&x.reason==='output-cost-limit'));
  assert.ok(out.rejected.some(x=>x.id==='remote-limited'&&x.reason==='tool-use-required'));
});

test('user-configured model registry persists encrypted with the Context Kernel',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-router-kernel-'));
  const passphrase='router persistence passphrase';
  let kernel=new ContextKernel({dir,passphrase});
  kernel.registerModel({id:'local-private',provider:'local',locality:'local',capabilities:['chat'],quality:0.7});
  assert.equal(kernel.listModels().length,1);

  const persisted=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  assert.equal(persisted.includes('local-private'),false);

  kernel=new ContextKernel({dir,passphrase});
  assert.equal(kernel.listModels()[0].id,'local-private');
  const routed=kernel.routeTask({requiredCapabilities:['chat'],privateContext:'sanitized',privacyPreference:'strict'});
  assert.equal(routed.model.id,'local-private');
});
