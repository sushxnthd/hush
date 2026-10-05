import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';

function kernel(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-context-fallback-'));
  const k=new ContextKernel({dir,passphrase:'context fallback test passphrase'});
  k.put('travel.profile',{
    displayName:'Ada Lovelace',
    email:'ada@example.com',
    maxBudget:734219,
    start:'2026-10-05T12:34:56Z',
    notes:'Send the itinerary to ada@example.com'
  },{label:'Travel profile',category:'preference',tags:['travel','profile']});
  return k;
}

test('preparing fallback returns metadata only and cannot release before approval',()=>{
  const k=kernel();
  const prepared=k.prepareContextRelease({
    task:'help plan my trip using my travel profile',
    privateRef:{query:'travel profile'},
    mode:'pseudonymous',
    agent:'assistant-a',sink:'model-a.example',purpose:'trip planning'
  });
  assert.equal(prepared.decision,'ask');
  assert.equal(Object.hasOwn(prepared,'context'),false);
  const wire=JSON.stringify(prepared);
  assert.equal(wire.includes('Ada Lovelace'),false);
  assert.equal(wire.includes('ada@example.com'),false);
  assert.equal(wire.includes('734219'),false);

  const before=k.consumeContextRelease({releaseId:prepared.releaseId,agent:'assistant-a',sink:'model-a.example'});
  assert.equal(before.decision,'ask');
  assert.equal(Object.hasOwn(before,'context'),false);
});

test('approved fallback is bound to agent and sink, sanitized, and one-shot',()=>{
  const k=kernel();
  const prepared=k.prepareContextRelease({privateRef:{query:'travel profile'},agent:'assistant-a',sink:'model-a.example',purpose:'trip planning'});
  assert.throws(()=>k.consumeContextRelease({releaseId:prepared.releaseId,agent:'assistant-b',sink:'model-a.example'}),/bound to another agent or sink/);

  const approved=k.approveContextRelease(prepared.releaseId);
  assert.equal(approved.decision,'approved');
  const released=k.consumeContextRelease({releaseId:prepared.releaseId,agent:'assistant-a',sink:'model-a.example'});
  assert.equal(released.decision,'allow');
  const wire=JSON.stringify(released.context);
  for(const secret of ['Ada Lovelace','ada@example.com','734219','2026-10-05T12:34:56Z']) assert.equal(wire.includes(secret),false);
  assert.equal(released.context.email,'person-1@example.invalid');
  assert.equal(released.context.maxBudget,'100000–1000000');
  assert.equal(released.context.start,'2026-10');
  assert.equal(released.receipt.oneShot,true);
  assert.equal(released.receipt.rawPrivatePathIncluded,false);
  assert.throws(()=>k.consumeContextRelease({releaseId:prepared.releaseId,agent:'assistant-a',sink:'model-a.example'}),/already consumed/);
});

test('denied fallback never becomes releasable',()=>{
  const k=kernel();
  const prepared=k.prepareContextRelease({privateRef:{query:'travel profile'},agent:'assistant',sink:'model.example'});
  const denied=k.denyContextRelease(prepared.releaseId);
  assert.equal(denied.decision,'deny');
  assert.throws(()=>k.approveContextRelease(prepared.releaseId),/was denied/);
  assert.throws(()=>k.consumeContextRelease({releaseId:prepared.releaseId,agent:'assistant',sink:'model.example'}),/was denied/);
});

test('changing selected private context invalidates an unconsumed prepared release',()=>{
  const k=kernel();
  const prepared=k.prepareContextRelease({privateRef:{query:'travel profile'},agent:'assistant',sink:'model.example'});
  k.put('travel.profile',{displayName:'Grace Hopper'},{label:'Travel profile',category:'preference',tags:['travel','profile']});
  assert.throws(()=>k.approveContextRelease(prepared.releaseId),/not found/);
});
