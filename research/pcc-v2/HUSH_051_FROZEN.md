# HUSH-PCC-051 — frozen multi-process idempotency-ledger linearizability falsification

**Date:** 2026-10-24. Secondary workstream on the existing Hush PR #45 branch. This test extends the *limits* of HUSH-050; it does not replace its verified single-server restart result or assert a novel distributed-systems theorem.

## Pre-execution hypothesis and fixture

Use **two independent Node HTTP receiver processes** that each load the same initially empty, fsynced JSON idempotency ledger at startup, as HUSH-050's local fixture does. Both use a durable write via atomic rename, but have **no shared transaction lock or linearizable compare-and-set**. Parent waits until both workers have loaded their snapshots before sending requests. The same real loopback HTTP client sends requests sequentially to remove scheduling ambiguity. A separate append-only fsynced file records each simulated external effect, so a last-writer-wins JSON ledger cannot conceal effects. No network, cloud, credentials, or third-party API.

## Frozen predictions

- P1 (same key): after both workers start with empty state, worker A accepts `(key=K, payload=P)` and returns HTTP **201**, then worker B accepts the *same* `(K,P)` and returns HTTP **201** instead of replay 200. The independent external effect log has **two** entries with K. This falsifies cross-worker exactly-once semantics despite individually fsynced ledger files.
- P2 (different keys): after two fresh workers start from another empty ledger, A accepts K1 and B accepts K2, both HTTP **201**, but the persisted JSON ledger contains only **one** key because B overwrites A's stale snapshot. The append-only external log has **two** distinct effects. This demonstrates loss of deduplication history.
- P3: a fresh receiver started from the final ledger cannot recover the lost key's history, and a retry of the missing key is accepted as a new effect.
- P4: a control receiver with a single live process and the same key twice returns **201 then 200 replay** and records one effect.
- P5: existing HUSH-048, HUSH-049, HUSH-050 tests remain passing; no prior negative result is weakened.

## Interpretation and release consequence

A durable idempotency file with atomic rename **does not imply a linearizable shared idempotency register across worker processes**. Receiver-owned idempotency requires an atomic *claim/commit* protocol across all instances, scoped keys, collision checks, durable retention and explicit uncertain-outcome reconciliation. HUSH-050 is limited to its single active receiver instance and restart scenario. Do not claim exactly-once or safe concurrent retry for horizontally scaled providers; retain production release blockers for unmediated egress, post-dispatch cancellation, partitions, expiry and external security review.

This is a deliberate adversarial **local receiver fixture**, not a claim that the production Hush broker currently uses such a multi-worker provider or that real external providers are broken.
