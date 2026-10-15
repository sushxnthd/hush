export function floorCertifiedBranchCharge({ domainSize, branchSize, minProbability }) {
  if (!Number.isSafeInteger(domainSize) || domainSize < 1) throw new RangeError('invalid domainSize');
  if (!Number.isSafeInteger(branchSize) || branchSize < 1 || branchSize > domainSize) throw new RangeError('invalid branchSize');
  if (!Number.isFinite(minProbability) || minProbability < 0 || minProbability > 1 / domainSize) throw new RangeError('invalid minProbability');
  const outside = domainSize - branchSize;
  const factor = (outside + 1) / (1 + (branchSize - 1) * outside * minProbability);
  return Math.log2(factor);
}
