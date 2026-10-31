# HUSH-PCC-050 — durable provider-idempotency crash/restart contrast

**Date:** 2026-10-24. **Frozen protocol:** `HUSH_050_FROZEN.md` committed at `89fc5f3` before test implementation. **Evidence:** real loopback HTTP POSTs; two separate broker child processes; a restarted receiver server instance loading a fsynced, atomically renamed local ledger; independent HUSH-048/049 negative regressions. **CI:** [40032414025](https://github.com/sushxnthd/hush/actions/runs/40032414025), completed SUCCESS. No real third-party provider or deployment-security claim.

## Executed result

1. The first broker process registered the existing transaction, approved a one-use action and sent a POST carrying stable semantic operation `fixed-operation-050` and deterministic idempotency key. The receiver durably recorded one effect and returned HTTP 201. The child then exited deliberately with status **66** before delivering its receipt.
2. The receiver HTTP server was closed. A new server instance reloaded its **on-disk** idempotency ledger. A new broker child reloaded the encrypted transaction state and issued another approved ticket for the same semantic operation.
3. The restarted receiver observed a second real HTTP POST, but returned **200 replay** and committed **no additional effect**. Persisted effect count remained **1** for the operation.
4. A changed payload under the same key was rejected with **409** and no new effect. A missing key was rejected with **400**. A distinct operation/key returned **201** and increased the persisted effect count to **2**.
5. The prior HUSH-048 unprotected duplicate-effect witness and HUSH-049 post-dispatch cancellation witness were rerun and passed as **negative controls**. Their failures remain real and have not been silently reclassified as safe.

## Generalizable boundary, not novelty

The broker's authorization is a local *permission* property, not a receiver-side *effect cardinality* property. After an external effect commits but before client acknowledgement, a retry may be observationally indistinguishable from an uncommitted request to the caller. Exactly-once *effect* claims require a receiver/provider contract that atomically binds a stable semantic idempotency key to the effect and persists it across restart (or equivalent reconciliation). This is established distributed-systems knowledge, not a novel impossibility theorem.

This controlled receiver uses a single JSON file with a locally fsynced atomic rename for both the key and effect log. It does **not** prove atomicity with a third-party payment, email, cloud API, physical actuator or arbitrary external side effect. The receiver restart was a new server instance in the same test process; the brokers were distinct child processes. No concurrency, partition, storage-corruption, timeout ambiguity, provider retention expiry or OS-level hostile-adapter confinement was tested.

## Direct enforcement consequence and release blockers

- Broker-side tickets and durable transaction state cannot justify `exactly_once_external_effect`. Keep this claim disabled.
- For a real provider, require a documented idempotency contract, stable operation IDs bound to authorization scope and payload, durable deduplication, mismatch rejection and replay semantics. Otherwise expose at-least-once/unknown effect status and require reconciliation.
- Independently test concurrent duplicate requests, provider crash before/after effect commit, restart after lost ACK, key expiry, timeout/partition, replay with changed payload, and cross-tenant key collision.
- Keep unmediated runtime egress, post-dispatch cancellation, receipt/retry recovery and external security review as hard release blockers. HUSH-050 does not solve HUSH-046 or HUSH-049.

**Product status:** Not deployment-ready. PR #45 remains draft; no merge or force push.
