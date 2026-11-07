# HUSH-PCC-056 — crash-after-effect replay experiment

Date: 2026-10-27. [Frozen before implementation](HUSH_056_FROZEN.md), commit `8dfa7c4907da2f4178ccf5ec080409cf8f605ecd`. **Evidence tier:** committed real-process adversarial ActionBroker experiment, hosted outcome **pending**. No production deployment, real external provider or independent external security review.

## New concrete failure window

The broker reserves a one-use ticket synchronously before dispatch, but the ticket and completed receipt are in-memory. A process can die after a provider applies a side effect and before the broker receives the adapter return. On restart, the requester may retry the same logical intent. The broker does not itself establish provider-side exactly-once semantics across this boundary.

The [test](../../test/action-broker-crash-replay-effect.test.js) uses two real Node processes, the actual ActionBroker, an adapter with a fsynced simulated-provider file ledger, and a parent that independently reads the durable effect **before** sending SIGKILL to the first process. A new broker in a fresh process reissues and approves the same request. It compares stable request hashes and durable ledger effects. This is a test of a simulated local provider, not proof of behavior for any cloud API.

## Frozen predictions awaiting hosted observation

| Case | Expected durable effects | Interpretation |
| --- | ---: | --- |
| Crash after first effect, then retry without provider idempotency | **2** | Duplicate side effect despite one logical intent |
| Same crash/retry with durable provider key deduplication | **1** | Provider-side idempotency can suppress modeled duplicate |
| Crash after first effect, no retry | **1** | Missing broker receipt does not imply no effect |

The test also checks that a real SIGKILL occurred, the first effect was fsynced before the kill, the restarted request hash is unchanged, and the successful replay produces one completed receipt. The parent independently parses the ledger; the replay worker does not decide the pass/fail effect count. The idempotency fixture is **sequential and local**; it does not prove atomicity under concurrent provider requests, retention or network partitions.

[Dedicated hosted workflow](../../.github/workflows/hush-056-crash-replay.yml) runs the three crash/restart cases, preserves HUSH-053/055 leakage controls and requires the production readiness gate to return BLOCK. **Do not claim tests passed until the hosted run is verified.** A failure must be preserved and fixed before further science.

## Compositional information-flow and lifecycle consequence

A complete broker claim must cover not only authorized return-value projections but the **joint trace** of effect, acknowledgment, crash, retry and externally visible provider state. A returned receipt is not a linearization point for an already-applied external effect. A silent crash is not a proof of non-execution. This is the familiar exactly-once/idempotency boundary in distributed systems, not a new theorem. The direct enforcement consequence is to treat post-dispatch unknown outcomes as **UNKNOWN/RECONCILE**, not automatically safe-to-retry, and to demand independently verified provider idempotency for release.

[Release blocker](../pcc-runtime-product/HUSH_046_RELEASE_BLOCKER.md) now requires provider-specific crash/replay, cancellation, concurrent retry, collision and retention evidence. **Production remains BLOCKED.** Lucent E002-371's separate research branch and draft PR #26 were not modified by this Hush experiment.

## Hosted independent execution verified (2026-10-28 audit of 2026-10-27 run)

[GitHub Actions run 40428809747](https://github.com/sushxnthd/hush/actions/runs/40428809747), job `121941190748`, **completed successfully** on branch commit `2afa652adbcbe32579e301ad00ef17ebe21c30f1`. The hosted Node runner executed the actual ActionBroker SIGKILL/restart test with **3/3 passing** cases:

1. A durable provider effect followed by process crash and unprotected reapproval/replay produced the expected duplicate effect.
2. A durable simulated-provider idempotency key suppressed the duplicate effect.
3. The no-retry control preserved an effect despite the missing broker receipt.

The same hosted job passed **2/2 HUSH-055 receipt-hash controls** and **1/1 HUSH-053 request-hash control**. The production-readiness script returned the required `block` status. These are observed *hosted software-test* outcomes, not external provider guarantees, a new distributed-systems theorem, or deployment review. Concurrent provider retries, idempotency retention/collision and external runtime egress mediation remain unverified. **Production BLOCKED.**
