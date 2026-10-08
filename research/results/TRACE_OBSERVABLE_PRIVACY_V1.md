# TOP v1 result record

**Protocol:** [TRACE_OBSERVABLE_PRIVACY.md](../TRACE_OBSERVABLE_PRIVACY.md)  
**Implementation:** [bench/trace-observable-privacy.js](../../bench/trace-observable-privacy.js)  
**Commit:** `caf7f17139bcea902c0283a0fa5015407eee3cb5`  
**Recorded:** 9 October 2026

## Execution evidence

The benchmark ran as part of the repository’s normal checks:

- CI benchmark job: https://github.com/sushxnthd/hush/actions/runs/37829633402 — **success**
- Frozen research-benchmarks job: https://github.com/sushxnthd/hush/actions/runs/37829633317 — **success**
- Cross-platform test matrix in CI: Ubuntu, macOS and Windows — **success**

The benchmark is deterministic and fails on any violated assertion.

## Observed result

For a uniform 16-value secret domain:

| Trace | Maximum realized support leakage | Synthetic task utility |
|---|---:|---:|
| Naive model-visible action | 4 bits | 100% |
| Opaque model-visible plan + local executor | 0 bits | 100% |
| Provider-side action trace | 4 bits, intentionally observable | 100% |
| Denied model-visible action | 0 bits | 0% |

The result supports a narrow mechanism claim:

> An opaque plan can preserve synthetic task utility while keeping a secret-dependent action choice out of the named model-visible trace, provided action selection occurs in a trusted local executor.

It also falsifies the broader claim that the action becomes private everywhere: the downstream provider trace remains injective and therefore exposes the full four-bit domain in this toy setup.

## Claim boundary

This is internal synthetic evidence, not an external benchmark, independent reproduction, peer-reviewed result, or production security guarantee. It does not cover timing, retries, failures, payload length, network observers, browser/OS telemetry, colluding agents, arbitrary natural-language plans or runtime integration. Tier A–C external validation remains open.
