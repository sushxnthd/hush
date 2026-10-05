import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-kernel-'));
  const passphrase='private constraint compilation test passphrase';
  const k=new ContextKernel({dir,passphrase});
  k.put('flight.readiness','Maximum planned groundspeed is 110 mph, although the pilot said every extra hour reduces what they earn.',{
    label:'Flight readiness evidence',category:'flight',tags:['flight','readiness','groundspeed']
  });
  k.registerConstraintContract({
    id:'flight.maximum-groundspeed',
    privateRef:{category:'flight'},
    extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph','miles per hour'],min:0,max:500},
    release:{label:'Maximum planned groundspeed',unit:'mph'}
  });
  return {k,dir,passphrase};
}

test('PCC release hides source and compiled value until local approval',()=>{
  const {k}=setup();
  const prepared=k.prepareConstraintRelease({
    contractId:'flight.maximum-groundspeed',
    task:'check maximum groundspeed for flight readiness',
    agent:'assistant-a',sink:'model-a.example',purpose:'flight readiness'
  });
  assert.equal(prepared.decision,'ask');
  assert.equal(prepared.derivedDisclosure,true);
  assert.equal(Object.hasOwn(prepared,'statement'),false);
  assert.equal(Object.hasOwn(prepared,'value'),false);
  const wire=JSON.stringify(prepared);
  assert.equal(wire.includes('110'),false);
  assert.equal(wire.includes('extra hour'),false);
  assert.equal(wire.includes('what they earn'),false);
});

test('approved PCC release emits only the derived constraint and is one-shot',()=>{
  const {k}=setup();
  const prepared=k.prepareConstraintRelease({contractId:'flight.maximum-groundspeed',agent:'assistant-a',sink:'model-a.example',purpose:'flight readiness'});
  assert.throws(()=>k.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'assistant-b',sink:'model-a.example'}),/bound to another agent or sink/);
  k.approveConstraintRelease(prepared.releaseId);
  const released=k.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'assistant-a',sink:'model-a.example'});
  assert.equal(released.decision,'allow');
  assert.equal(released.constraint.statement,'Maximum planned groundspeed: 110 mph.');
  assert.equal(released.constraint.value,110);
  const wire=JSON.stringify(released);
  assert.equal(wire.includes('extra hour'),false);
  assert.equal(wire.includes('what they earn'),false);
  assert.equal(released.receipt.rawSourceIncluded,false);
  assert.equal(released.receipt.rawPrivatePathIncluded,false);
  assert.equal(released.receipt.oneShot,true);
  assert.throws(()=>k.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'assistant-a',sink:'model-a.example'}),/already consumed/);
});

test('changing private evidence invalidates an unconsumed compiled release',()=>{
  const {k}=setup();
  const prepared=k.prepareConstraintRelease({contractId:'flight.maximum-groundspeed',agent:'assistant',sink:'model.example'});
  k.put('flight.readiness','Maximum planned groundspeed is 95 mph.',{label:'Flight readiness evidence',category:'flight',tags:['flight','readiness','groundspeed']});
  assert.throws(()=>k.approveConstraintRelease(prepared.releaseId),/not found/);
});

test('trusted PCC contracts persist encrypted with the Context Kernel state',()=>{
  const {k,dir,passphrase}=setup();
  assert.equal(k.listConstraintContracts().length,1);
  const reopened=new ContextKernel({dir,passphrase});
  assert.equal(reopened.listConstraintContracts().length,1);
  assert.equal(reopened.listConstraintContracts()[0].id,'flight.maximum-groundspeed');
});

test('comparison contracts can disclose less than the extracted private value',()=>{
  const {k}=setup();
  k.registerConstraintContract({
    id:'flight.speed-limit-check',
    privateRef:{category:'flight'},
    extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph'],min:0,max:500},
    release:{op:'compare',label:'Groundspeed within 120 mph release limit',operator:'lte',arg:120,trueLabel:'yes',falseLabel:'no'}
  });
  const prepared=k.prepareConstraintRelease({contractId:'flight.speed-limit-check',agent:'assistant',sink:'model.example'});
  k.approveConstraintRelease(prepared.releaseId);
  const released=k.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'assistant',sink:'model.example'});
  assert.equal(released.constraint.value,true);
  assert.equal(released.constraint.statement,'Groundspeed within 120 mph release limit: yes.');
  assert.equal(JSON.stringify(released.constraint).includes('110'),false);
});
