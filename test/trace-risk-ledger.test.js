import test from 'node:test';
import assert from 'node:assert/strict';
import {IndependentStepLedger,TraceEnvelopeLedger} from '../src/trace-risk-ledger.js';

test('trace envelope is the running maximum and weakly dominates independent steps',()=>{
  const trace=new TraceEnvelopeLedger();
  const independent=new IndependentStepLedger();
  const matrix=[[1,0],[0.25,1.5],[1.25,0.75]];
  const expected=[1,1.5,1.5];
  matrix.forEach((row,index)=>{
    assert.equal(trace.update(row).chargeBits,expected[index]);
    assert.ok(trace.snapshot().chargeBits<=independent.update(row).chargeBits);
  });
  assert.equal(trace.snapshot().stateScalars,1);
  assert.equal(independent.snapshot().stateScalars,3);
});

test('invalid and changing ensembles fail closed',()=>{
  const trace=new TraceEnvelopeLedger();
  assert.throws(()=>trace.update([]),/nonempty/);
  assert.throws(()=>trace.update([Number.NaN]),/finite/);
  assert.throws(()=>trace.update([-1]),/nonnegative/);
  const independent=new IndependentStepLedger();
  independent.update([0,1]);
  assert.throws(()=>independent.update([0]),/ensemble size changed/);
});
