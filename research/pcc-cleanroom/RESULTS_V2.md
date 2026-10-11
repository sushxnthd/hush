# PCC clean-room replication v2 result

Status: **scoped PASS; not a breakthrough-gate pass**.

## Provenance

- Base repository commit: `f8511cd55018fe845c3d4ad886ba03d9dc9097b2`
- First protocol/implementation freeze: `9f77b1fb44dc3c554f911214d242779d247a0be1`
- First execution: failed before scoring; preserved in `FIRST_RUN_FAILURE.md`
- V2 contract-bound freeze: `a711306c2714c74867cb403bb9611824f4d38a6b`
- Python: `3.12.14`
- Result JSON SHA-256: `80d40aa9ae0efa4b3eb9a04835f10076b29e91ecd021828ee40400ad8e81a26f`
- Repository regression suite: 294/294 tests passed

## Decisive result

| Arm / check | Task or oracle success | Exact protected canaries at model/provider boundary | Gate |
|---|---:|---:|---|
| Clean-room PCC exhaustive mechanism | 114,688 / 114,688 | 0 / 114,688 | PASS |
| Raw-context scheduling | 512 / 512 | 512 / 512 | comparator |
| Coarse redaction scheduling | 162 / 512 | 0 / 512 | utility loss |
| PCC scheduling | 512 / 512 | 0 / 512 | PASS |
| PCC receipt audit | n/a | 0 / 512 source/canary disclosures | PASS |
| Unbudgeted adaptive predicates | 4,096 / 4,096 secrets reconstructed | n/a | expected failure mode |
| Five-bit cumulative guard | 0 / 4,096 secrets reconstructed; minimum 128 candidates remain | n/a | PASS |

All ten v2 gates passed. Two deterministic runs produced the same result JSON
checksum.

## What changed after the failed first run

The first implementation assumed that a numeric source would contain one unique
bounded integer. A canary containing digits falsified that assumption before
the first score was produced. The v2 mechanism binds extraction to a
declarative contract capture rather than scanning all numbers. V2 retained
unrelated in-bounds numbers in every source and rejected all 64 sources with
two distinct field-bound values.

This is not cosmetic error handling: it identifies a general failure mode for
private computation over fused prose. Type alone is insufficient; evidence
selection must also be bound to the intended field/anchor.

## Smallest supported claim

A Python implementation written without importing the Hush PCC compiler
reproduced the bounded numeric compute-before-disclose mechanism over 114,688
exhaustive cases. In a deterministic 512-case scheduling prototype, it matched
raw-context task decisions while no exact protected canary or source appeared
at the simulated model/provider boundary; raw context exposed every canary and
coarse redaction preserved privacy but solved only 31.64% of cases.

The result also independently reproduces the composition boundary: a sequence
of individually bounded boolean answers can reconstruct every secret in a
4096-value domain, whereas a five-bit cumulative guard stopped all 4,096
attacks with at least 128 candidates remaining.

## Limitations and unresolved risks

- This is an internal second implementation, not a third-party reproduction.
- The workload is synthetic and deterministic, not a fresh external holdout.
- The extractor handles only contract-bound integers, not arbitrary prose.
- Absence of exact canaries is not semantic or inference privacy. The released
  booleans intentionally reveal bounded information.
- Receipt source hashes may permit dictionary attacks when source entropy is
  low; this prototype did not claim that hashes hide low-entropy inputs.
- Timing, length, error, retry, collusion, provider, operating-system, and
  network side channels were not tested.
- The provider boundary is simulated; no live email/calendar provider or model
  call was made.

## Next decisive action

**DISCRIMINATION / PRODUCT-TRANSLATION:** port the contract-bound extractor
property into the actual Hush connector/PCC runtime and freeze an end-to-end
calendar workflow using an external public task set. Capture the actual model,
MCP, provider, receipt, error, and retry traces. Compare raw context, semantic
minimization, and PCC under the same task verifier. The mechanism prediction is
that task success remains within five percentage points of raw context while
exact source disclosure at the model boundary falls to zero; provider-visible
action fields must be reported rather than counted as private.

