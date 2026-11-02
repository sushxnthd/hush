# HUSH-PCC-049 — post-dispatch cancellation boundary

**Date: 2026-10-23. Frozen before execution at `c166c8a`. Evidence tier: executable real-loopback HTTP adversarial test, independently reproduced in hosted GitHub Actions.** No deployment readiness or external security review is claimed.

## Mechanism and predicted counterexample

HUSH-047's `ActionBroker.execute` rechecks transaction scope **immediately before** `adapter.execute`, preventing dispatch when closure occurs during credential resolution. However, `adapter.execute` is arbitrary asynchronous trusted local code. Once it begins, the broker does not own the external effect boundary.

The new test `test/action-broker-postdispatch-close.test.js` uses explicit promise barriers:

1. The broker approves an authorized action ticket and enters the adapter, which waits before sending a request.
2. The test confirms no HTTP effect has occurred, then closes the authorization transaction and durably saves its closed state.
3. A fresh broker instance reloads the encrypted authorization state and refuses to reopen the transaction.
4. The already-entered adapter is released and sends a **real HTTP POST after closure**.
5. The original action reports `allow` when the adapter returns.

This distinguishes **no new dispatch after closure** from the much stronger, currently unsupported claim **no external effect after closure**. The test includes a pre-dispatch credential-resolution control, which must still deny without entering the adapter.

The expected post-dispatch effect is a **release-blocking counterexample**, not an exploit claim against an OS-isolated or provider-mediated system. The test uses a cooperative in-process adapter and local receiver to expose a lifecycle gap deterministically. The original effect may be irreversible once committed.

## Exact enforcement consequence

A strict closure/cancellation guarantee requires the broker or a separately verified mediator to own every external effect boundary. The mediator must atomically check a durable authorization epoch immediately before each effect, cancel queued uncommitted work, and record outcome/ambiguity across crashes and restarts. Where the provider does not support atomic authorization check plus commit, the product must explicitly distinguish **cancel requested**, **no effect dispatched**, **effect may have committed**, and **effect confirmed committed**; it must not report cancellation as a guaranteed rollback. For arbitrary in-process adapters with unmediated network access, no complete enforcement claim is justified.

Release blockers remain:
- broker-owned or OS-enforced egress mediation, independently reviewed;
- durable effect IDs and provider-backed idempotency/reconciliation for crash retries;
- actual cancellation/closure semantics tested at the effect boundary under races;
- independent process-crash, restart, network-timeout and provider-replay evidence;
- external security review of observable channels and threat-model limitations.

## Reproduce

```bash
node --test test/action-broker-postdispatch-close.test.js
node --test test/action-broker-concurrency-closure.test.js
node --test test/action-broker-crash-retry-duplicate.test.js
```

Dedicated CI: [HUSH-049 run 40004005586](https://github.com/sushxnthd/hush/actions/runs/40004005586). **CI 40004005586 completed successfully** on the test/workflow commit `2aa4e5a`, running the new real-HTTP counterexample and both prior race/crash regression suites. This success verifies the expected failure witness, not production security. Later documentation-only CI runs have separate statuses. The dedicated workflow runs the new real-HTTP test and both prior race/crash regression suites.

This is a classical lifecycle/TOCTOU boundary, not a novel general noninterference theorem. Hush draft PR #45 remains unmerged and not production-ready.
