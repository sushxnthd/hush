import test from 'node:test';
import assert from 'node:assert/strict';
import {distributionFreeBranchCharge} from '../src/distribution-free-branch-charge.js';

test('implements the sharp prior-free branch law', () => {
  assert.deepEqual(distributionFreeBranchCharge({domainSize: 3, branchSize: 2}), {
    mechanism: 'distribution-free-branch-v1', domainSize: 3, branchSize: 2,
    chargeBits: 1, extremalFactor: 2, coverageRequired: false,
  });
  assert.equal(distributionFreeBranchCharge({domainSize: 8, branchSize: 1}).chargeBits, 3);
  assert.equal(distributionFreeBranchCharge({domainSize: 8, branchSize: 8}).chargeBits, 0);
});

test('charge decreases monotonically as the branch grows', () => {
  const values = Array.from({length: 16}, (_, i) =>
    distributionFreeBranchCharge({domainSize: 16, branchSize: i + 1}).chargeBits);
  assert.ok(values.every((value, i) => i === 0 || value < values[i - 1]));
});

test('invalid domains and branches fail closed', () => {
  for (const args of [
    {domainSize: 0, branchSize: 1}, {domainSize: 4, branchSize: 0},
    {domainSize: 4, branchSize: 5}, {domainSize: 4.5, branchSize: 2},
  ]) assert.throws(() => distributionFreeBranchCharge(args));
});

