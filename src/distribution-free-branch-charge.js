function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive safe integer`);
  return value;
}

export function distributionFreeBranchCharge({domainSize, branchSize}) {
  const n = positiveInteger(domainSize, 'domainSize');
  const k = positiveInteger(branchSize, 'branchSize');
  if (k > n) throw new RangeError('branchSize cannot exceed domainSize');
  const extremalFactor = n - k + 1;
  return Object.freeze({
    mechanism: 'distribution-free-branch-v1',
    domainSize: n,
    branchSize: k,
    chargeBits: Math.log2(extremalFactor),
    extremalFactor,
    coverageRequired: false,
  });
}

