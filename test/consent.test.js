import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ConsentRegistry,describeConsentRule,consentModes} from '../src/consent.js';
import {ContextKernel} from '../src/context-kernel.js';

function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'hush-consent-')); }

const baseRequest={capability:'context.release',agent:'assistant-a',sink:'model.example',purpose:'trip planning',category:'travel',resource:'Travel profile'};

test('consent registry supports allow once, always allow, ask, and never',()=>{
  assert.deepEqual(consentModes(),['once','always','ask','never']);
  const registry=new ConsentRegistry();
  registry.set({mode:'always',capability:'context.release',agent:'assistant-a',category:'travel'});
  assert.equal(registry.evaluate(baseRequest).decision,'allow');
  assert.equal(registry.evaluate({...baseRequest,agent:'assistant-b'}).decision,'ask');
});

test('allow-once consent is consumed atomically and cannot be reused',()=>{
  let now=1000;
  const registry=new ConsentRegistry({now:()=>now});
  const rule=registry.set({mode:'once',capability:'memory.write',agent:'assistant-a',category:'travel',resource:'Preferred seat'});
  const request={capability:'memory.write',agent:'assistant-a',sink:'hush-memory',purpose:'shared memory',category:'travel',resource:'Preferred seat'};
  assert.equal(registry.evaluate(request).decision,'allow');
  const used=registry.evaluate(request,{consume:true});
  assert.equal(used.decision,'allow');
  assert.equal(used.consumed,true);
  now+=1;
  assert.equal(registry.evaluate(request).decision,'ask');
  assert.ok(registry.list().find(x=>x.id===rule.id).consumedAt);
});

test('never wins conservatively over overlapping allow rules',()=>{
  const registry=new ConsentRegistry();
  registry.set({mode:'always',capability:'context.release',agent:'assistant-a',category:'travel'});
  registry.set({mode:'never',capability:'context.release',sink:'blocked.example'});
  const verdict=registry.evaluate({...baseRequest,sink:'blocked.example'});
  assert.equal(verdict.decision,'deny');
  assert.equal(verdict.rule.mode,'never');
});

test('consent descriptions are human-readable and scoped',()=>{
  const description=describeConsentRule({mode:'always',scope:{capability:'context.release',agent:'assistant-a',sink:'model.example',purpose:'trip planning',category:'travel',resource:'Travel profile'}});
  assert.match(description,/Always allow assistant-a/);
  assert.match(description,/context\.release/);
  assert.match(description,/travel/);
  assert.match(description,/model\.example/);
});

test('context release honors persistent allow and never consent without exposing raw context',()=>{
  const kernel=new ContextKernel({dir:temp(),passphrase:'context release consent passphrase'});
  kernel.put('travel.profile',{email:'ada@example.com',budget:734219},{label:'Travel profile',category:'travel',tags:['travel','profile']});
  kernel.setConsentRule({mode:'always',capability:'context.release',agent:'assistant-a',sink:'model.example',purpose:'trip planning',category:'travel',resource:'Travel profile'});

  const allowed=kernel.prepareContextRelease({privateRef:{query:'travel profile'},agent:'assistant-a',sink:'model.example',purpose:'trip planning'});
  assert.equal(allowed.decision,'approved');
  assert.equal(allowed.consent.mode,'always');
  const released=kernel.consumeContextRelease({releaseId:allowed.releaseId,agent:'assistant-a',sink:'model.example'});
  assert.equal(released.decision,'allow');
  assert.equal(JSON.stringify(released.context).includes('ada@example.com'),false);
  assert.equal(JSON.stringify(released.context).includes('734219'),false);

  kernel.setConsentRule({mode:'never',capability:'context.release',sink:'blocked.example'});
  const denied=kernel.prepareContextRelease({privateRef:{query:'travel profile'},agent:'assistant-a',sink:'blocked.example',purpose:'trip planning'});
  assert.equal(denied.decision,'deny');
  assert.throws(()=>kernel.consumeContextRelease({releaseId:denied.releaseId,agent:'assistant-a',sink:'blocked.example'}),/was denied/);
});

test('allow-once memory consent commits exactly one matching proposal',()=>{
  const kernel=new ContextKernel({dir:temp(),passphrase:'memory consent passphrase'});
  kernel.setConsentRule({mode:'once',capability:'memory.write',agent:'assistant-a',category:'travel',resource:'Preferred seat'});
  const first=kernel.proposeMemory({agent:'assistant-a',label:'Preferred seat',category:'travel',tags:['seat'],value:'aisle'});
  assert.equal(first.decision,'approved');
  assert.equal(first.consent.mode,'once');
  assert.equal(kernel.list().length,1);

  const second=kernel.proposeMemory({agent:'assistant-a',label:'Preferred seat',category:'travel',tags:['seat'],value:'window'});
  assert.equal(second.decision,'ask');
  assert.equal(kernel.list().length,1);
});

test('consent rules persist only inside encrypted Context Kernel state',()=>{
  const dir=temp();
  const passphrase='encrypted consent persistence passphrase';
  let kernel=new ContextKernel({dir,passphrase});
  kernel.setConsentRule({mode:'always',capability:'context.release',agent:'private-assistant',sink:'private-model.example',category:'finance'});
  const disk=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  assert.equal(disk.includes('private-assistant'),false);
  assert.equal(disk.includes('private-model.example'),false);
  assert.equal(disk.includes('context.release'),false);

  kernel=new ContextKernel({dir,passphrase});
  const rules=kernel.listConsentRules({includeInactive:false});
  assert.equal(rules.length,1);
  assert.equal(rules[0].mode,'always');
  assert.equal(kernel.evaluateConsent({capability:'context.release',agent:'private-assistant',sink:'private-model.example',purpose:'anything',category:'finance',resource:'anything'}).decision,'allow');
});
