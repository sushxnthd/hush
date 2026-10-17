# PCC structural-identity lifecycle differential

Status: **frozen before probe implementation or execution**.

## Question

Does result-independent PCC composition survive deletion and recreation of the
same logical private-context path, or does storage-record identity silently
create a fresh privacy ledger?

## Mechanism under test

The corrected default identity is the encrypted record identifier plus private
field. Updating an existing path preserves that identifier, but removing and
recreating the path may allocate a new identifier while the old PCC posterior
remains persisted. If so, a connector refresh or lifecycle operation can reset
composition accounting for unchanged private evidence.

## Frozen differential

For secret `s=500` in declared integer domain `0..1023`:

1. approve and consume `s >= 500`;
2. in the control, leave the record unchanged;
3. in the intervention, remove and recreate the same path, category, domain and
   value;
4. prepare `s <= 500` through the same logical path;
5. compare the public decision and, if allowed, the joint posterior implied by
   both released predicates.

Also restart the kernel after an ordinary in-place update of the same path as a
stability control.

## Preregistered prediction and gate

If storage lifecycle resets composition, the unchanged and in-place/restart
controls will deny the identifying second predicate, while remove/recreate will
return `ask`; approving it will release `true`, and the intersection of both
released predicates will be exactly `[500]`.

The gate passes only if all three lifecycle paths use one stable logical privacy
identity and deny the second predicate before disclosure. Any decision split is
a failure even if no remote provider is involved.

## Claim boundary

This tests a trusted local lifecycle operation on one bounded integer record.
It does not establish that a remote model can invoke deletion, nor does it test
semantic aliases, malicious contracts, timing, or arbitrary side channels.
