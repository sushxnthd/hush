# HUSH-PCC-050 — frozen provider-enforced idempotency crash/restart test

Date: 2026-10-24. Secondary workstream, existing draft PR #45 and branch preserved. This is a **bounded adversarial end-to-end receiver test**, not a claim of new distributed-systems theory or production readiness.

## Hypothesis and contrast
HUSH-048 proved duplicate real HTTP effects when a broker process crashes after receiver commit but before receipt. Test whether a **receiver-owned, durable, semantic-operation-keyed idempotency ledger** changes that external observable across both broker **and receiver** restarts, while the existing broker authorization still permits retry.

## Frozen predictions
- P1: Child broker A issues an approved action, POSTs a stable operation ID with a stable idempotency key, receives receiver acknowledgement, then exits 66 before returning its broker receipt. Exactly one external effect is durably recorded.
- P2: Stop and restart the HTTP receiver from its persisted idempotency ledger; start a fresh broker B with the same encrypted authorization state and repeat the operation. Receiver receives a second POST but does not commit a second effect; it returns a replay receipt.
- P3: Reusing the same key with different canonical payload is rejected (409) without effect. A distinct key/operation commits a second effect.
- P4: A missing idempotency key is rejected (400) without effect.
- P5: Receiver ledger is stored in one atomic, fsynced state file and the server responds only after its local state write succeeds. Test verifies the disk file and effect count, not merely in-memory counters. This local fixture does not prove third-party provider atomicity or OS-level hostile-adapter confinement.
- P6: Earlier HUSH-048 negative crash test and HUSH-049 post-dispatch closure test remain passing; no weakening of release blockers.

## Boundary and release consequence
Authorization tickets and broker state alone cannot imply exactly-once external effects. A **provider-owned** idempotency contract can suppress duplicate effects for stable IDs in the tested failure model; a provider that lacks this contract must be classified at-least-once/unknown. In-flight cancellation still cannot retract an already committed effect. A real release additionally needs provider contracts, durable key lifecycle, concurrency, partition/timeout injection, bounded retention, external security review and fail-closed egress enforcement. Keep PR draft; no merge.
