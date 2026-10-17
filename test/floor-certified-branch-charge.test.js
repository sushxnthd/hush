import test from 'node:test';
import assert from 'node:assert/strict';
import { floorCertifiedBranchCharge } from '../src/floor-certified-branch-charge.js';

test('interpolates between the prior-free and uniform-prior charges', () => {
  assert.equal(floorCertifiedBranchCharge({domainSize: 8, branchSize: 3, minProbability: 0}), Math.log2(6));
  assert.equal(floorCertifiedBranchCharge({domainSize: 8, branchSize: 3, minProbability: 1/8}), Math.log2(8/3));
  assert.equal(floorCertifiedBranchCharge({domainSize: 8, branchSize: 8, minProbability: 0.01}), 0);
  assert.ok(floorCertifiedBranchCharge({domainSize: 8, branchSize: 3, minProbability: 0.05}) < Math.log2(6));
});

test('fails closed on invalid contracts', () => {
  for (const minProbability of [-1, NaN, 0.2]) {
    assert.throws(() => floorCertifiedBranchCharge({domainSize: 8, branchSize: 3, minProbability}));
  }
  assert.throws(() => floorCertifiedBranchCharge({domainSize: 0, branchSize: 1, minProbability: 0}));
  assert.throws(() => floorCertifiedBranchCharge({domainSize: 8, branchSize: 9, minProbability: 0}));
});
