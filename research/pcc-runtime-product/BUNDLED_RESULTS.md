# Bounded PCC approval bundle: result

## Smallest supported product claim

For the tested two-predicate scheduling workflow, Hush can combine two fixed boolean PCC releases into one locally approved, one-shot bundle. After a semantic-inference counterexample forced posterior-aware hardening, the untouched case-768..1023 cohort preserved all tested utility and exact-value non-disclosure outcomes, recorded realized-posterior accounting in every receipt, and reduced approvals from three to two per completed action.

## Decisive result

| Frozen cohort 768–1023 | Separate PCC releases | Bounded PCC bundle |
|---|---:|---:|
| Task and calendar action success | 256/256 | 256/256 |
| Exact cutoff disclosed to model | 0/256 | 0/256 |
| Canary disclosed to model | 0/256 | 0/256 |
| Source match in provider payload | 0/256 | 0/256 |
| Source match in receipt | 0/256 | 0/256 |
| Two-bit capacity recorded | 256/256 | 256/256 |
| Constraint + action replay denied | 256/256 | 256/256 |
| Realized-partition receipts | 256/256 | 256/256 |
| Final posterior: 30 candidates | 256/256 | 256/256 |
| Total approvals | 768 | **512** |
| Approvals per action | 3.0 | **2.0** |
| Mean end-to-end latency | 196.1 ms | 197.2 ms |

All seven preregistered gates passed. A clean full rerun reproduced the expanded discrete-result digest exactly: `acf2651226ff29b03308c40e531589aa0d29219f2a1a986b028b38cfe8ba30fb`. Latency was descriptive and varied on replay; the discrete results did not.

## Failure history and mechanism update

The first frozen cohort failed the receipt gate in 1/256 bundled cases because the private cutoff `203` numerically collided with public metadata `outputBytes: 203`. The byte count was constant in that cohort, so this was not causal recovery of the source value. The run remains recorded as FAIL. It revealed that public serialized-size metadata was unnecessary and could become a genuine side channel when output lengths vary.

The corrective mechanism removed bundle output size from public preparation metadata and receipts, retained internal accounting, and moved confirmation to untouched case IDs 256–511. Bundle construction fails closed unless it contains 2–4 unique boolean comparison contracts over the same private record and its declared capacity covers every output but never exceeds four bits. The bundle is jointly bound to agent, sink, purpose, expiry, and one-shot consumption.

A subsequent adversarial probe found a deeper boundary: `(s >= 500, s <= 500)` uniquely reconstructed `s=500` from a 1,024-value domain while the nominal bundle ceiling reported two bits. Native Hush denied the equivalent exact query at 10 realized bits, but PCC initially bypassed that firewall. The preserved counterexample forced a second correction: bounded-integer PCC comparisons now execute transactionally against the shared realized posterior, deny identifying outputs before approval, commit only upon consumption, and reject stale concurrent preparations. The final untouched cohort verified 30 remaining candidates in every scheduling case.

## Gate status

- Product-translation gate for this synthetic workflow: **PASS**.
- Scientific breakthrough gate: **INCONCLUSIVE**.

The experiment uses synthetic scheduling records, a deterministic model proxy, and a simulated Google endpoint through Hush's actual Calendar adapter. It tests exact-value disclosure, not semantic inference leakage, adaptive composition, malicious contracts, live-provider behavior, or third-party reproduction. The result is a scoped product improvement, not universal privacy.

## Reproduce

```bash
node --test test/private-constraint-kernel.test.js
node research/pcc-runtime-product/run_inference_firewall_correction.mjs \
  --output research/pcc-runtime-product/inference_firewall_correction.json
node research/pcc-runtime-product/run_bundled_benchmark.mjs \
  --case-start 768 \
  --output research/pcc-runtime-product/bundled_results_v4.json
```

Run the benchmark a second time and compare `discrete_sha256`; latency is intentionally excluded from the digest.
