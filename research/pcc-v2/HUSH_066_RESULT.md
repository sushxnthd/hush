# HUSH-066 RESULT | Local effect fencing orders dispatch, but cannot order queued provider commits

Date: 2026-10-30. Secondary workstream on existing Hush research branch and draft PR #45. **Evidence tier: research-only cooperative broker enforcement prototype plus adversarial runtime tests. NOT an independently reviewed production security guarantee.** Protocol frozen first at `fc473726`; delayed-provider negative control frozen in Amendment A at `4e6f980` before implementation.

## What changed

HUSH-065 demonstrated that a separate process could durably close authorization after the final broker check but before a credential-bearing HTTP POST. HUSH-066 introduces `EncryptedAuthorizationStateStore.withExclusiveLockAsync(fn)`, retaining the existing HUSH-064 exclusive-create filesystem lock **until an awaited callback settles**, rather than releasing it as soon as a Promise is returned.

An explicit opt-in `EffectFencedActionBroker` wraps its entire `super.execute()` interval in that lock. The scope is intentionally conservative: it requires a transaction and a durable store with async lock support, denies when the lock is unavailable, and never reflects raw exception text. The old `ActionBroker` is unchanged and remains subject to the HUSH-065 expected counterexample. This prototype is **not wired into production routing**.

## Frozen interleavings and predictions

The new Node tests use actual encrypted authorization persistence, real loopback HTTP, separate OS-process revokers and two synthetic credential worlds.

| Interleaving | Expected durable closure | Expected provider effect | Security interpretation |
| --- | --- | --- | --- |
| Closure commits before fence acquired | CLOSED | 0 POSTs | Correct fail-closed denial |
| Closure attempted while fence held | LOCKED, not committed | 1 POST may occur | Dispatch occurs while durable authorization remains open; closure succeeds only after release |
| Orphan lock exists | No closure can commit until intervention | 0 POSTs | Fail closed, but revocation availability blocked |
| Adapter rejects during fence | Later closure succeeds | 0 POSTs in this fixture | Async finally releases lock |
| Process exits abruptly while holding fence | Orphan lock remains | 0 new POSTs after restart | Manual recovery needed; crash safety is not equivalent to effect atomicity |
| Provider accepts and queues effect before closure, then commits after closure | CLOSED before remote commit | 1 delayed effect | **Counterexample to provider-commit noninterference** |

The last row is critical. A provider that returns HTTP 202 after queueing work can perform the irreversible operation *after* the broker has released its lock and revocation has durably committed. The credential crossed the network **before** closure, so this is not the same failure as HUSH-065's post-closure credential transmission. It instead falsifies a stronger post-closure *provider-effect* claim.

## Mechanism and limitations

The limited ordering guarantee is: for cooperating local brokers sharing a trustworthy exclusive-create filesystem, a **successful durable revocation cannot interleave with a fenced adapter promise**. An attempted revocation during that interval may fail with `AUTHORIZATION_STATE_LOCKED`, and must not be represented to the user as completed. The lock cannot roll back already accepted requests, prevent a remote queued operation, prove eventual provider completion, or cancel an uncooperative adapter. If a process dies, the orphan lock deliberately fails closed until manual operator investigation. The design does not tolerate malicious local lock deletion or unreliable shared-filesystem semantics.

This is a classical critical-section ordering argument, **not a new compositional information-flow theorem**. Any broader lifecycle law must model separate events: broker authorization read, dispatch start, provider acceptance, provider irreversible commit, broker response and durable revocation. Suppressing broker output alone is insufficient, and serializing local dispatch alone is insufficient when provider commits are asynchronous.

## Verification

The dedicated [HUSH-066 GitHub Actions workflow](../../.github/workflows/hush-066-effect-fence.yml) runs the new adversarial tests on Ubuntu, Windows and macOS and reruns HUSH-065's historical unfenced leak. **At the time of this initial report, latest-head hosted results were queued; success is not claimed.** No real secrets or non-loopback network are involved. Hosted results must be appended only after completed jobs are inspected.

## Explicit release blockers

- [ ] Make all sensitive production dispatch paths use a reviewed enforcement boundary; the new class is opt-in and experimental.
- [ ] Establish provider-side revocation-epoch/capability validation at the irreversible effect commit point, or explicitly reject post-commit privacy claims.
- [ ] Test cancellation, timeouts, delayed provider acceptance, concurrent revocation and retry/idempotency semantics.
- [ ] Specify authenticated crash/restart recovery and safe operator intervention for orphan locks without silent lock stealing.
- [ ] Independently replay the state/effect history, including provider-side commit timestamps and hostile failure injection.
- [ ] Complete external security review, cross-platform CI and production threat-model signoff.

**Hush release remains BLOCKED.** No merge, force-push or deployment. Lucent E002-371 remains the primary kernel, `ABSTAIN_UNCALIBRATED` and production BLOCKED; no new physical shutter capture or independent human anatomical rating was obtained in this bounded secondary run.