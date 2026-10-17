# PCC pre-approval metadata probe: preregistration

## Classification

DISCRIMINATION / ADVERSARIAL SECURITY.

## Hypothesis and mechanism

`prepareConstraintRelease()` is intended to require explicit local approval
before a derived private result is disclosed. Its public metadata currently
contains both serialized output size and realized-posterior statistics. Either
quantity can be a deterministic function of the unreleased boolean result.
Consequently, an agent may infer the result from preparation metadata without
approval or consumption.

The same risk applies to bundle preparation metadata through its realized
`afterCandidates` and `totalKnowledgeBits` fields, even though bundle output
size was already removed.

## Frozen predictions

Use bounded integer secrets over the declared domain 0..1023 and perform no
approval or consumption.

1. **Realized-count channel:** for `secret >= 500`, the public
   `afterCandidates` value will distinguish the true branch (524 candidates)
   from the false branch (500 candidates).
2. **Serialized-size channel:** for the balanced predicate `secret >= 512`,
   equal branch cardinalities remove the count channel, but deliberately
   unequal public labels will make `outputBytes` distinguish true from false.
3. **Bundle channel:** a two-predicate preparation will expose a
   result-dependent realized posterior before approval.

The security gate fails if preparation metadata alone correctly recovers any
unapproved boolean result. The probe must not approve, consume, inspect the
pending-release maps, read encrypted state, or use the private record after
preparation.

## Cheapest correction if falsified

Pre-approval metadata must contain only result-independent risk information.
Remove serialized output size and realized `afterCandidates` /
`totalKnowledgeBits` from safe single and bundle metadata. Retain configured
budget/capacity and non-secret pre-query state. Realized accounting may appear
only with the approved, consumed output and receipt. Re-run this immutable
probe and the complete suite.

## Boundary

This tests the agent-facing preparation boundary. It does not cover timing,
memory access, a compromised local runtime, malicious trusted contracts, or
other covert channels.
