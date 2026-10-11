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
  // Random release IDs and epoch timestamps can coincidentally contain "110".
  // Check the human-readable fields for the private value, not opaque metadata.
  const publicText=[prepared.reason,prepared.agent,prepared.sink,prepared.purpose,prepared.category].join(' ');
  assert.equal(publicText.includes('110'),false);
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
    extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph'],min:0,max:500,integer:true},
    release:{op:'compare',label:'Groundspeed within 120 mph release limit',operator:'lte',arg:120,trueLabel:'yes',falseLabel:'no'}
  });
  const prepared=k.prepareConstraintRelease({contractId:'flight.speed-limit-check',agent:'assistant',sink:'model.example'});
  k.approveConstraintRelease(prepared.releaseId);
  const released=k.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'assistant',sink:'model.example'});
  assert.equal(released.constraint.value,true);
  assert.equal(released.constraint.statement,'Groundspeed within 120 mph release limit: yes.');
  assert.equal(JSON.stringify(released.constraint).includes('110'),false);
});

test('bounded comparison bundle needs one approval and releases at most its declared bits',()=>{
  const {k}=setup();
  for(const [id,limit] of [['flight.under-120',120],['flight.under-100',100]]){
    k.registerConstraintContract({
      id,privateRef:{category:'flight'},
      extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph'],min:0,max:500,integer:true},
      release:{op:'compare',label:`Groundspeed within ${limit} mph`,operator:'lte',arg:limit,trueLabel:'yes',falseLabel:'no'}
    });
  }
  const prepared=k.prepareConstraintReleaseBundle({
    contractIds:['flight.under-120','flight.under-100'],maxBits:2,
    agent:'assistant',sink:'model.example',purpose:'flight readiness'
  });
  assert.equal(prepared.decision,'ask');
  assert.equal(prepared.capacityBits,2);
  assert.equal(prepared.outputCount,2);
  assert.equal(Object.hasOwn(prepared,'outputs'),false);
  assert.equal(Object.hasOwn(prepared,'outputBytes'),false);
  assert.throws(()=>k.consumeConstraintReleaseBundle({bundleId:prepared.bundleId,agent:'other',sink:'model.example'}),/bound to another agent or sink/);
  k.approveConstraintReleaseBundle(prepared.bundleId);
  const released=k.consumeConstraintReleaseBundle({bundleId:prepared.bundleId,agent:'assistant',sink:'model.example'});
  assert.deepEqual(released.constraints.map(row=>row.value),[true,false]);
  assert.equal(released.capacityBits,2);
  assert.equal(released.receipt.declaredMaxBits,2);
  assert.equal(released.receipt.inferenceProtection.afterCandidates,20);
  assert.equal(Object.hasOwn(released.receipt,'outputBytes'),false);
  assert.equal(JSON.stringify(released).includes('extra hour'),false);
  assert.throws(()=>k.consumeConstraintReleaseBundle({bundleId:prepared.bundleId,agent:'assistant',sink:'model.example'}),/already consumed/);
});

test('comparison bundle fails closed for excess capacity, identity releases, and mixed sources',()=>{
  const {k}=setup();
  k.registerConstraintContract({
    id:'flight.compare',privateRef:{category:'flight'},
    extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph'],min:0,max:500,integer:true},
    release:{op:'compare',label:'Within limit',operator:'lte',arg:120}
  });
  assert.throws(()=>k.prepareConstraintReleaseBundle({contractIds:['flight.compare','flight.maximum-groundspeed'],maxBits:2}),/boolean comparison releases only/);
  assert.throws(()=>k.prepareConstraintReleaseBundle({contractIds:['flight.compare','flight.compare'],maxBits:2}),/unique contracts/);
  assert.throws(()=>k.prepareConstraintReleaseBundle({contractIds:['flight.compare','flight.maximum-groundspeed'],maxBits:1}),/maxBits/);

  k.put('medical.status',{eligible:true},{label:'Medical status',category:'medical'});
  k.registerConstraintContract({
    id:'medical.eligible',privateRef:{category:'medical'},privateField:'eligible',
    extractor:{kind:'boolean'},release:{op:'compare',label:'Eligible',operator:'eq',arg:true}
  });
  assert.throws(()=>k.prepareConstraintReleaseBundle({contractIds:['flight.compare','medical.eligible'],maxBits:2}),/same private record/);
});

test('changing private evidence invalidates an unconsumed comparison bundle',()=>{
  const {k}=setup();
  for(const [id,limit] of [['flight.a',120],['flight.b',130]]) k.registerConstraintContract({
    id,privateRef:{category:'flight'},extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph'],min:0,max:500,integer:true},
    release:{op:'compare',label:id,operator:'lte',arg:limit}
  });
  const prepared=k.prepareConstraintReleaseBundle({contractIds:['flight.a','flight.b'],maxBits:2,agent:'assistant',sink:'model.example'});
  k.put('flight.readiness','Maximum planned groundspeed is 95 mph.',{label:'Flight readiness evidence',category:'flight',tags:['flight']});
  assert.throws(()=>k.approveConstraintReleaseBundle(prepared.bundleId),/not found/);
});

test('PCC bundle denies a two-boolean vector that identifies an exact finite-domain value',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-inference-'));
  const k=new ContextKernel({dir,passphrase:'pcc inference denial test'});
  k.put('finance.balance',500,{category:'finance',domain:{type:'integer',min:0,max:1023}});
  for(const [id,operator] of [['finance.gte','gte'],['finance.lte','lte']]) k.registerConstraintContract({
    id,privateRef:{category:'finance'},extractor:{kind:'number',min:0,max:1023,integer:true},
    release:{op:'compare',label:id,operator,arg:500}
  });
  assert.throws(()=>k.prepareConstraintReleaseBundle({contractIds:['finance.gte','finance.lte'],maxBits:2}),/denied by inference firewall/);
  assert.equal(k.partitionExposure().find(row=>row.field==='finance.balance').remainingCandidates,1024);
});

test('stale concurrent PCC preparations cannot spend the same posterior twice',()=>{
  const {k}=setup();
  for(const [id,limit] of [['flight.concurrent-a',120],['flight.concurrent-b',130]]) k.registerConstraintContract({
    id,privateRef:{category:'flight'},extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph'],min:0,max:500,integer:true},
    release:{op:'compare',label:id,operator:'lte',arg:limit}
  });
  const args={contractIds:['flight.concurrent-a','flight.concurrent-b'],maxBits:2,agent:'assistant',sink:'model.example'};
  const first=k.prepareConstraintReleaseBundle(args),second=k.prepareConstraintReleaseBundle(args);
  k.approveConstraintReleaseBundle(first.bundleId);k.consumeConstraintReleaseBundle({bundleId:first.bundleId,agent:'assistant',sink:'model.example'});
  k.approveConstraintReleaseBundle(second.bundleId);
  assert.throws(()=>k.consumeConstraintReleaseBundle({bundleId:second.bundleId,agent:'assistant',sink:'model.example'}),/privacy state changed/);
});

test('semantically equivalent extractor aliases share one PCC posterior ledger',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-extractor-alias-'));
  const k=new ContextKernel({dir,passphrase:'extractor alias regression test'});
  k.put('finance.balance',500,{category:'finance',domain:{type:'integer',min:0,max:1023}});
  const base={kind:'number',min:0,max:1023,integer:true};
  for(const [id,operator,extractor] of [
    ['finance.lower','gte',base],
    ['finance.upper','lte',{...base,anchors:['balance']}]
  ]) k.registerConstraintContract({
    id,privateRef:{category:'finance'},extractor,
    release:{op:'compare',label:id,operator,arg:500}
  });
  const first=k.prepareConstraintRelease({contractId:'finance.lower',agent:'assistant',sink:'model.example'});
  k.approveConstraintRelease(first.releaseId);
  const released=k.consumeConstraintRelease({releaseId:first.releaseId,agent:'assistant',sink:'model.example'});
  assert.equal(released.constraint.value,true);
  assert.throws(()=>k.prepareConstraintRelease({contractId:'finance.upper',agent:'assistant',sink:'model.example'}),/denied by inference firewall/);
  const ledgers=k.partitionExposure().filter(row=>String(row.field).startsWith('pcc:'));
  assert.equal(ledgers.length,1);
  assert.equal(ledgers[0].remainingCandidates,524);
});

test('conflicting domains for extractor aliases fail closed',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-domain-alias-'));
  const k=new ContextKernel({dir,passphrase:'domain alias regression test'});
  k.put('finance.balance',500,{category:'finance',domain:{type:'integer',min:0,max:1023}});
  for(const [id,max,anchors] of [['finance.wide',1023,[]],['finance.narrow',800,['balance']]]) k.registerConstraintContract({
    id,privateRef:{category:'finance'},extractor:{kind:'number',min:0,max,integer:true,anchors},
    release:{op:'compare',label:id,operator:'gte',arg:400}
  });
  const first=k.prepareConstraintRelease({contractId:'finance.wide',agent:'assistant',sink:'model.example'});
  k.approveConstraintRelease(first.releaseId);
  k.consumeConstraintRelease({releaseId:first.releaseId,agent:'assistant',sink:'model.example'});
  assert.throws(()=>k.prepareConstraintRelease({contractId:'finance.narrow',agent:'assistant',sink:'model.example'}),/identical declared integer domain/);
});

test('semantically equivalent private-field aliases share one PCC posterior ledger',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-field-alias-'));
  const k=new ContextKernel({dir,passphrase:'field alias regression test'});
  k.put('finance.account',{balance:500,availableBalance:500},{category:'finance'});
  for(const [id,operator,privateField] of [
    ['finance.lower','gte','balance'],
    ['finance.upper','lte','availableBalance']
  ]) k.registerConstraintContract({
    id,privateRef:{category:'finance'},privateField,
    extractor:{kind:'number',min:0,max:1023,integer:true},
    release:{op:'compare',label:id,operator,arg:500}
  });
  const first=k.prepareConstraintRelease({contractId:'finance.lower',agent:'assistant',sink:'model.example'});
  k.approveConstraintRelease(first.releaseId);
  assert.equal(k.consumeConstraintRelease({releaseId:first.releaseId,agent:'assistant',sink:'model.example'}).constraint.value,true);
  assert.throws(()=>k.prepareConstraintRelease({contractId:'finance.upper',agent:'assistant',sink:'model.example'}),/denied by inference firewall/);
  const ledgers=k.partitionExposure().filter(row=>String(row.field).startsWith('pcc:'));
  assert.equal(ledgers.length,1);
  assert.equal(ledgers[0].remainingCandidates,524);
});

test('equal-valued field aliases with conflicting domains fail closed',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-field-domain-alias-'));
  const k=new ContextKernel({dir,passphrase:'field alias domain regression test'});
  k.put('finance.account',{balance:500,availableBalance:500},{category:'finance'});
  for(const [id,max,privateField] of [
    ['finance.wide',1023,'balance'],
    ['finance.narrow',800,'availableBalance']
  ]) k.registerConstraintContract({
    id,privateRef:{category:'finance'},privateField,
    extractor:{kind:'number',min:0,max,integer:true},
    release:{op:'compare',label:id,operator:'gte',arg:400}
  });
  const first=k.prepareConstraintRelease({contractId:'finance.wide',agent:'assistant',sink:'model.example'});
  k.approveConstraintRelease(first.releaseId);
  k.consumeConstraintRelease({releaseId:first.releaseId,agent:'assistant',sink:'model.example'});
  assert.throws(()=>k.prepareConstraintRelease({contractId:'finance.narrow',agent:'assistant',sink:'model.example'}),/identical declared integer domain/);
});

test('public PCC partition footprint does not expose the scalar digest',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-public-footprint-'));
  const k=new ContextKernel({dir,passphrase:'public footprint regression test'});
  k.put('finance.balance',500,{category:'finance',domain:{type:'integer',min:0,max:1023}});
  k.registerConstraintContract({
    id:'finance.lower',privateRef:{category:'finance'},
    extractor:{kind:'number',min:0,max:1023,integer:true},
    release:{op:'compare',label:'balance at least 400',operator:'gte',arg:400}
  });
  const prepared=k.prepareConstraintRelease({contractId:'finance.lower',agent:'assistant',sink:'model.example'});
  k.approveConstraintRelease(prepared.releaseId);
  k.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'assistant',sink:'model.example'});
  const pcc=k.partitionExposure().find(row=>String(row.field).startsWith('pcc:'));
  assert.equal(pcc.field,'pcc:derived');
  assert.equal(pcc.remainingCandidates,624);
});
