# HUSH-PCC-051 — verified multi-process receiver-idempotency falsification

**Date:** 2026-10-24. **Frozen before test implementation:** [HUSH_051_FROZEN.md](HUSH_051_FROZEN.md), commit `7d53fc91ef294c864136764619b12afa3c57567a`. **Evidence:** adversarial real loopback HTTP, separate Node receiver processes, fsynced atomic-renamed JSON ledger and separate append-only fsynced effect witness. **CI:** [run 40062130887](https://github.com/sushxnthd/hush/actions/runs/40062130887), commit `b60bd7f12e28a817d8d6558c72d099072e2c9839`; dedicated test and HUSH-048–050 predecessor controls passed. This is a *counterexample to a local receiver fixture under multi-worker deployment*, not a finding of a deployed Hush exploit.

## Frozen predictions versus actual observations

| Prediction | Verified observation | Decision |
| --- | --- | --- |
| P1: same key/payload sent sequentially to two already-started receiver processes | HTTP **201, 201**; external append-only effect log **2** entries; shared JSON ledger only **1** effect | **PASS** (unsafe duplicate witnessed) |
| P2: different keys to two receivers sharing a stale startup snapshot | HTTP **201, 201**; **2** effects in append-only log but only **1** key survives in JSON ledger | **PASS** (acknowledged dedup history lost) |
| P3: restart receiver and retry the missing key | HTTP **201**; append-only log reaches **3** effects | **PASS** (lost key cannot be deduplicated) |
| P4: one active receiver, same key twice | HTTP **201, 200 replay**; **1** external effect | **PASS** (single-worker positive control) |
| P5: preserve HUSH-048–050 | **4/4** predecessor tests passed, including crash retry, post-dispatch closure and durable single-worker idempotency | **PASS** |

The test intentionally sends requests **sequentially**, so the result does not depend on probabilistic timing or a scheduler race. Each process loaded the ledger *before* the first request. The per-process fsync and atomic rename do not make the shared read/modify/write sequence linearizable.

## Boundary and priority

This is a concrete instantiation of established concurrency theory. Herlihy and Wing (1990), *Linearizability: A Correctness Condition for Concurrent Objects*, ACM TOPLAS 12(3):463–492, [DOI 10.1145/78969.78972](https://doi.org/10.1145/78969.78972), established the correctness condition that shared concurrent operations appear to take effect atomically between invocation and response. The local HUSH-051 witness is **not a novel linearizability theorem** and does not establish general exactly-once impossibility. It falsifies the unsupported inference from a locally fsynced ledger to safe horizontally scaled receiver effects.

The external-effect witness is a separate append-only file; it is not a real payment, email, third-party API or physical actuator. Its persistence is not atomically coupled to the JSON ledger. The test does **not** establish provider transaction guarantees, network partition tolerance, cancellation or hostile-adapter confinement. It does show that a second receiver with stale local state can return a second successful commit and erase prior deduplication history, even though the original HUSH-050 single-worker restart test passed.

## Enforced product consequence

`scripts/production-readiness.mjs` now adds an explicit **Authority & real actions** release gate for independently evidenced provider-side idempotency linearizability, collision handling, retry/reconciliation and retention. The expected attestation `release/attestations/provider-idempotency-linearizability.json` is intentionally **absent**: release must remain blocked until a real independently verified provider contract and artifacts exist. The gate requires independent and artifact-backed evidence; simply passing the local counterexample cannot satisfy it.

No assertion of exactly-once external effects, cancel-after-dispatch rollback, complete egress mediation, or production readiness is justified. The Hush broker itself was not changed by this fixture experiment; HUSH-046/049 remain release blockers. PR #45 stays draft.

## Reproduction

```sh
node --check test/action-broker-provider-multiprocess-ledger.test.js
node --test test/action-broker-provider-multiprocess-ledger.test.js
node --test test/action-broker-crash-retry-duplicate.test.js test/action-broker-postdispatch-close.test.js test/action-broker-provider-idempotency.test.js
node scripts/production-readiness.mjs --json
```

The last command is expected to report release **BLOCK**, not PASS. This is deliberate; production attestation evidence is missing.
