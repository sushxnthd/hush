# PCC inference-firewall correction: preregistration

Frozen before executing the corrected differential probe or a new scheduling cohort.

## Correction

Every numeric PCC comparison release must declare a bounded integer extractor. Hush derives an opaque persistent partition key from the private source digest and trusted extractor, evaluates all comparisons sequentially on a transactional copy of the shared posterior, and denies the entire release if realized knowledge exceeds the existing firewall limit. The posterior commits only when an approved one-shot release is consumed. A second concurrently prepared release must fail stale rather than spend the same posterior twice.

## Predictions

1. The original 0..1023 identifying pair is denied during PCC preparation, leaves all 1,024 candidates feasible, and emits no boolean result.
2. The native exact predicate remains denied for the same 10-bit reason.
3. A non-identifying scheduling pair over domain 0..1439 leaves exactly 30 candidates per fresh case, below the eight-bit limit.
4. On untouched synthetic case IDs 512..767, corrected bundled PCC completes all 256 tasks/actions, exposes zero exact source matches at tested boundaries, records realized-partition protection in every receipt, uses 512 approvals, and denies every replay.
5. A complete rerun reproduces the discrete-result digest.

The correction cohort remains synthetic and deterministic. Passing does not establish semantic privacy against arbitrary priors, non-integer sources, covert channels, malicious trusted contracts, or external models.
