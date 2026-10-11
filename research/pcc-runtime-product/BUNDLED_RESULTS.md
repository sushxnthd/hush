# Bounded PCC approval bundle: result

## Smallest supported product claim

For the tested two-predicate scheduling workflow, Hush can combine two fixed boolean PCC releases into one locally approved, two-bit, one-shot bundle. On the untouched correction cohort this preserved all tested utility and exact-value non-disclosure outcomes while reducing approvals from three to two per completed action.

## Decisive result

| Frozen cohort 256–511 | Separate PCC releases | Bounded PCC bundle |
|---|---:|---:|
| Task and calendar action success | 256/256 | 256/256 |
| Exact cutoff disclosed to model | 0/256 | 0/256 |
| Canary disclosed to model | 0/256 | 0/256 |
| Source match in provider payload | 0/256 | 0/256 |
| Source match in receipt | 0/256 | 0/256 |
| Two-bit capacity recorded | 256/256 | 256/256 |
| Constraint + action replay denied | 256/256 | 256/256 |
| Total approvals | 768 | **512** |
| Approvals per action | 3.0 | **2.0** |
| Mean end-to-end latency | 196.1 ms | 197.2 ms |

All six preregistered gates passed. A clean full rerun reproduced the discrete-result digest exactly: `437164b51432e67990ebbed11505b9fc115545a428ad9a2cb3cb2b01934fc269`. Latency was descriptive and varied on replay; the discrete results did not.

## Failure history and mechanism update

The first frozen cohort failed the receipt gate in 1/256 bundled cases because the private cutoff `203` numerically collided with public metadata `outputBytes: 203`. The byte count was constant in that cohort, so this was not causal recovery of the source value. The run remains recorded as FAIL. It revealed that public serialized-size metadata was unnecessary and could become a genuine side channel when output lengths vary.

The corrective mechanism removed bundle output size from public preparation metadata and receipts, retained internal accounting, and moved confirmation to untouched case IDs 256–511. Bundle construction fails closed unless it contains 2–4 unique boolean comparison contracts over the same private record and its declared capacity covers every output but never exceeds four bits. The bundle is jointly bound to agent, sink, purpose, expiry, and one-shot consumption.

## Gate status

- Product-translation gate for this synthetic workflow: **PASS**.
- Scientific breakthrough gate: **INCONCLUSIVE**.

The experiment uses synthetic scheduling records, a deterministic model proxy, and a simulated Google endpoint through Hush's actual Calendar adapter. It tests exact-value disclosure, not semantic inference leakage, adaptive composition, malicious contracts, live-provider behavior, or third-party reproduction. The result is a scoped product improvement, not universal privacy.

## Reproduce

```bash
node --test test/private-constraint-kernel.test.js
node research/pcc-runtime-product/run_bundled_benchmark.mjs \
  --case-start 256 \
  --output research/pcc-runtime-product/bundled_results_v2.json
```

Run the benchmark a second time and compare `discrete_sha256`; latency is intentionally excluded from the digest.
