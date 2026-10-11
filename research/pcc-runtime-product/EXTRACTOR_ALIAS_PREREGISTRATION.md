# PCC extractor-alias composition probe

Status: **frozen before execution**.

## Classification

DISCRIMINATION / adversarial composition test on an opened synthetic domain.
This is not external evidence and does not alter any earlier frozen result.

## Hypothesis and mechanism

The realized-posterior firewall identifies a PCC private field from the private
path, source digest, and complete extractor specification. Two trusted contracts
can extract the same scalar from the same source while using semantically
equivalent but syntactically different extractors. If those extractors create
different posterior keys, adaptive releases can spend the privacy budget twice.

For a secret `s = 500` in the declared integer domain `0..1023`, the observations
`s >= 500` and `s <= 500` jointly identify `s` exactly. Each observation alone
leaves hundreds of candidates and is below the eight-bit realized-knowledge
limit. Composition must nevertheless be denied before the identifying second
output, regardless of extractor aliases.

## Frozen differential

Use the actual encrypted Context Kernel and PCC release path.

1. **Shared-extractor control:** two contracts use byte-identical bounded-integer
   extractors and release `>= 500`, then `<= 500` sequentially.
2. **Extractor-alias intervention:** the same two comparisons target the same
   record and source digest, but the second extractor adds a harmless anchor.
   Numeric sources do not use anchors for extraction, so both contracts recover
   the same scalar and domain.

Every successful release is locally approved and consumed before the next is
prepared. An independent set enumerator intersects the observed predicate
preimages without using Hush's posterior implementation.

## Preregistered prediction and gates

Mechanism prediction: the shared-extractor control denies the identifying
second query, while the extractor-alias intervention releases both booleans,
the independent enumerator reconstructs exactly `[500]`, and Hush exposes two
separate PCC posterior entries that individually remain below the knowledge
limit.

The security-consistency gate passes only if both arms deny exact
reconstruction. It **fails** if the alias intervention emits both observations
and independently leaves one candidate. A denial must emit no protected value
and must not mutate the pre-query posterior.

## Boundaries

This deterministic probe covers bounded integer comparison contracts and one
syntactic alias. It does not establish exploitability by an untrusted model,
because contract registration is a trusted-local action. It tests whether Hush
can safely compose separately authored trusted contracts. Timing, prose
semantics, inaccurate domains, malicious local code, and covert channels remain
out of scope.

