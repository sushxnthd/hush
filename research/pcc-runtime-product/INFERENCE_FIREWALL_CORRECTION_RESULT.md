# PCC realized-posterior firewall: correction result

## Smallest supported claim

For bounded integer comparison contracts, PCC now accounts for the realized posterior—not merely the nominal number of boolean outputs—before any result can be released. It blocks a two-boolean exact-identification attack while preserving the tested non-identifying scheduling workflow and its one-third approval reduction.

## Mechanism test

| Frozen differential over domain 0..1023 | Before correction | Corrected PCC |
|---|---:|---:|
| Query | `s >= 500`, `s <= 500` | Same |
| Observed vector if `s=500` | `(true,true)` released | **No output** |
| Independent posterior | 1 candidate | 1 candidate predicted |
| Firewall decision | Bypassed | **DENY before approval** |
| Committed candidates after denial | 1024 | **1024** |

The native private-decision control and corrected PCC both denied the identifying result at 10 realized knowledge bits. Correction evidence SHA-256: `271bcc811c6087f926d32b33eac248d2b0fd6f993a5bbc53bb06c675bb84f0b3`.

## Untouched scheduling confirmation

| Case IDs 768–1023 | Separate PCC | Bundled PCC |
|---|---:|---:|
| Task and action success | 256/256 | 256/256 |
| Model cutoff/canary matches | 0/256 | 0/256 |
| Provider/receipt source matches | 0/256 | 0/256 |
| Realized-partition receipts | 256/256 | 256/256 |
| Final posterior exactly 30 candidates | 256/256 | 256/256 |
| Constraint and action replay denied | 256/256 | 256/256 |
| Total approvals | 768 | **512** |

All seven frozen gates passed. A complete rerun reproduced the expanded discrete SHA-256 exactly: `acf2651226ff29b03308c40e531589aa0d29219f2a1a986b028b38cfe8ba30fb`. The full repository suite passed 299/299 tests.

## Implementation boundary

- Comparison releases require an explicitly bounded safe-integer extractor.
- All contracts in a bundle must address the same private source and extractor.
- Predicates are evaluated sequentially on a transactional copy of the persistent posterior.
- Any identifying step denies the whole release before approval or output.
- Posterior state commits only when the approved one-shot release is consumed.
- Concurrent preparations are bound to the prior posterior and fail stale after another release commits.

## Preserved failures

The original differential remains a frozen counterexample: nominal two-bit accounting released a vector carrying 10 realized bits and left Hush's posterior falsely unchanged. The first post-correction scheduling cohort also remains formally inconclusive because its benchmark omitted the preregistered receipt/posterior gates; those gates were added before the case-768..1023 cohort.

## Claim boundary

This is a strong security and product-engineering foothold, not a new information-theory result or a scientific breakthrough. It covers analyzable bounded-integer comparisons under Hush's declared-domain model. It does not cover arbitrary prose semantics, inaccurate domains, malicious trusted contracts, external priors, non-integer sources, timing/covert channels, or external-model inference.

## Reproduce

```bash
node research/pcc-runtime-product/run_inference_firewall_correction.mjs \
  --output research/pcc-runtime-product/inference_firewall_correction.json
node research/pcc-runtime-product/run_bundled_benchmark.mjs \
  --case-start 768 \
  --output research/pcc-runtime-product/bundled_results_v4.json
npm test
```
