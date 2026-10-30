# HUSH-067 FROZEN | Abort and process death do not revoke a provider's accepted work

Date: 2026-10-30. Existing Hush branch `breakthrough-engine/transaction-scope-recovery-20261021` and draft PR #45. Bounded secondary workstream; Lucent E002-371 remains primary. **Frozen before implementing this experiment.**

## Question and distinct contribution

HUSH-066 showed a queued provider can commit after durable closure when the local fenced broker finishes normally. This experiment targets **actual transport cancellation and OS process death**, which HUSH-066 did not exercise as provider-side effects. Does either event justify saying an accepted external action was cancelled, or that post-revocation effects are impossible?

**Prediction: no.** For a provider that accepts the complete HTTP request body and retains a work item, an aborted client request or killed broker process does not retract that item. Local revocation, orphan-lock fail-closed behavior and provider work can coexist. This is a classical distributed-systems limitation, not a novel theorem.

## Frozen tests

Use a real 127.0.0.1 HTTP provider that reads the complete credential-bearing POST and intentionally withholds its response. Use two synthetic credential worlds, an encrypted authorization state file, a separate Node revoker, and the existing opt-in EffectFencedActionBroker. No external network or real secrets.

1. **Abort after provider receipt:** Once the provider has read a complete POST, abort the adapter's fetch via AbortController. Expect the broker to return `decision:error` with no secret/result leakage, and release its cooperative lock. Then an independent process must durably close authorization. Finally the provider may commit the previously accepted work *after* that closure. A successful local abort is not provider cancellation.
2. **Kill after provider receipt:** Launch a separate broker process that holds the effect fence while awaiting a withheld provider response. After the provider receives the POST, kill the child process. Expect an orphan lock, a restarted broker denying further fenced dispatch, and an independent revoker reporting `LOCKED`. The provider can nevertheless commit the accepted work after process death. No stale-lock auto-removal is allowed.
3. **Trace and replay:** Emit sanitized event traces with explicit ordering (provider_received, local_abort / child_exit, broker_error / restart_denied, durable_closed or revocation_locked, provider_committed). Independently replay ordering and assert no trace contains synthetic credential strings. Do not infer remote provider commit timestamps from local client receipt timestamps.
4. **Negative controls:** A request that never reaches provider acceptance must not be counted as an effect. Abort before receipt is out of scope and must not be conflated with abort after receipt. These tests model cooperative filesystem locking and a deliberately hostile-but-conforming delayed provider.

## Kill criteria

Kill the experiment if the provider did not receive the complete request before abort/kill, if closure is reported as committed while a live fence remains, if a restarted broker dispatches through an orphan lock, if the broker reports `allow` after abort, or if trace/reply exposes credential bytes. Record infrastructure failures separately from a scientific disagreement.

## Consequence and limitations

The only defensible local guarantee is ordered cooperative dispatch relative to durable local closure *while the process and lock are live*. An HTTP abort, process death, successful local close or restarted broker's denial **cannot guarantee provider-side cancellation**. End-to-end prevention requires a provider-enforced authorization epoch checked at the irreversible commit point (or a narrower explicit product claim), plus idempotency/reconciliation, authenticated crash recovery, and independent review. Keep Hush production BLOCKED.

Lucent E002-540 hosted CI should be verified independently; no new Lucent physiological claims are authorized by this secondary test.
