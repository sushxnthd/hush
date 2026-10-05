import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PrivateDecisionRuntime} from '../src/private-decision.js';
import {ContextKernel} from '../src/context-kernel.js';

const domain={type:'integer',min:0,max:999999};
const secret=734219;
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'hush-partition-'));

test('runtime denies a rare exact-match branch before releasing the result',()=>{
  const r=new PrivateDecisionRuntime();
  r.setPrivate('finance.balance',secret,{domain});
  const t=r.beginTrajectory({purpose:'eligibility',maxBits:8,sinkMaxBits:8});
  const out=r.run({trajectoryId:t.trajectoryId,agent:'a',sink:'bank',program:{kind:'predicate',private:'finance.balance',op:'eq',value:secret}});
  assert.equal(out.decision,'deny');
  assert.match(out.reason,/posterior knowledge/i);
  assert.equal('result' in out,false);
  assert.equal(out.partition.afterCandidates,1);
  assert.ok(out.partition.marginalKnowledgeBits>19.9);
  assert.equal(r.partitionFootprint()[0].remainingCandidates,1_000_000);
});

test('runtime charges harmless false guesses by realized shrinkage',()=>{
  const r=new PrivateDecisionRuntime();
  r.setPrivate('finance.balance',secret,{domain});
  const t=r.beginTrajectory({purpose:'eligibility',maxBits:8,sinkMaxBits:8});
  for(let guess=0;guess<100;guess++){
    const out=r.run({trajectoryId:t.trajectoryId,agent:'a',sink:'bank',program:{kind:'predicate',private:'finance.balance',op:'eq',value:guess}});
    assert.equal(out.decision,'allow');
    assert.equal(out.result,false);
    assert.equal(out.capacity.accounting,'realized-partition');
  }
  const status=r.partitionFootprint()[0];
  assert.equal(status.remainingCandidates,999900);
  assert.ok(status.totalKnowledgeBits<0.001);
});

test('encrypted context kernel persists partition state across restart',()=>{
  const dir=temp(),passphrase='partition persistence passphrase';
  let kernel=new ContextKernel({dir,passphrase});
  kernel.put('finance.balance',secret,{category:'finance',domain});
  const t=kernel.beginTrajectory({purpose:'eligibility',maxBits:8,sinkMaxBits:8});
  const first=kernel.run({trajectoryId:t.trajectoryId,agent:'a',sink:'bank',program:{kind:'predicate',private:'finance.balance',op:'gt',value:500000}});
  assert.equal(first.decision,'allow');
  assert.equal(kernel.partitionExposure()[0].remainingCandidates,499999);

  const persisted=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  assert.equal(persisted.includes('finance.balance'),false);
  assert.equal(persisted.includes('"domain"'),false);

  kernel=new ContextKernel({dir,passphrase});
  assert.equal(kernel.partitionExposure()[0].remainingCandidates,499999);
  const t2=kernel.beginTrajectory({purpose:'fresh-task',maxBits:8,sinkMaxBits:8});
  const exact=kernel.run({trajectoryId:t2.trajectoryId,agent:'b',sink:'other',program:{kind:'predicate',private:'finance.balance',op:'eq',value:secret}});
  assert.equal(exact.decision,'deny');
  assert.equal('result' in exact,false);
});

test('unsafe prototype-like private paths fail closed',()=>{
  const r=new PrivateDecisionRuntime();
  assert.throws(()=>r.setPrivate('__proto__.polluted',1),/Unsafe private path/);
  assert.equal({}.polluted,undefined);
});

test('malformed trajectory TTL cannot create a non-expiring task',()=>{
  const r=new PrivateDecisionRuntime();
  assert.throws(()=>r.beginTrajectory({ttlMs:'not-a-number'}),/Trajectory TTL/);
  assert.throws(()=>r.beginTrajectory({ttlMs:null}),/Trajectory TTL/);
});
