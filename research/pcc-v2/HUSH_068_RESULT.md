# HUSH-068 RESULT | Provider commit-point guard versus enqueue-only authorization

2026-10-31. Secondary Hush workstream, existing draft PR #45. Frozen before executable at `31c7045`. **Evidence tier: local provider-fixture tests with a minimal broker test double; actual repository ActionBroker hosted verification pending. No real external provider or deployment review.**

## Hypothesis and controlled interleavings

HUSH-066/067 established that broker-side fencing, abort and crash do not retract provider-accepted work. HUSH-068 tests a complementary enforcement requirement: provider revocation and irreversible commit must linearize against the **same** authorization state. In the loopback fixture, POST /enqueue accepts approved broker work, POST /revoke changes the provider's file-backed revocation bit, and POST /commit checks that bit immediately before incrementing an effect counter.

| Controlled order | Commit-point gate | Effects | Interpretation |
|---|---|---:|---|
| Broker enqueues, provider revokes, then attempts commit | Enabled | 0 | Deny after successful revocation |
| Broker enqueues, commits, then revokes | Enabled | 1 | Earlier effect is allowed; later revocation cannot undo it |
| Provider revokes before enqueue | Enabled | 0 | Reject unauthorized enqueue |
| Broker enqueues, revokes, then commits | **Disabled** | **1** | Expected post-revocation counterexample |
| Provider state file disappears before commit | Enabled | 0 | Fail closed rather than default open |
| Provider instance restarts after revocation | Enabled | 0 | File-backed revocation is reloaded; not a crash-durability proof |

The tests iterate two distinct synthetic credential worlds for the first two cases. Provider state and broker responses do not intentionally include raw credentials.

## Conditional lifecycle law

For the modeled provider, assume (i) every irreversible effect crosses a provider commit-point authorization guard, (ii) that guard and successful revocation linearize against the same trustworthy state, and (iii) the provider has no bypassing effect path. Then a successful revocation ordered before the commit guard prevents that effect. If an effect is queued before revocation but commits afterward, an **enqueue-only** check is insufficient. This is a standard serializability/cut-set argument, **not** a novel general information-flow theorem.

The local fixture serializes handlers in a single Node event loop and uses rename-based JSON state replacement. It does not provide authenticated distributed transactions, atomic cross-process read/modify/write, fsync guarantees, provider-side idempotency, malicious-adapter mediation, network partition recovery, or real-world cancellation. The restart test is a controlled server-instance restart, not an abrupt crash injection.

## Verification

- [Frozen protocol](HUSH_068_FROZEN.md).
- [Five real-loopback provider tests](../../test/action-broker-provider-commit-068.test.js) use the repository ActionBroker when run in GitHub Actions.
- A local **provider-only** dry run with a minimal ActionBroker test double passed 5/5; it does not count as testing the real broker.
- [Cross-OS hosted workflow](../../.github/workflows/hush-068-provider-commit.yml) was committed. Hosted result pending; no CI pass is claimed until run jobs are inspected.

## Product release blocker

Require an independently reviewed, provider-enforced authorization check at the irreversible effect commit point, or explicitly narrow Hush's security promise to **broker-local output suppression**. The same durable revocation epoch must be consulted at every effect path, including queued jobs, retries, cancellations and crash recovery. Before release, demonstrate external provider enforcement, idempotency and reconciliation, authenticated crash/restart, cross-process serializability, adversarial observables (timing/errors/length/network), and independent security review.

**Hush production remains BLOCKED.** No merge, force-push or deployment. Lucent primary remains `ABSTAIN_UNCALIBRATED` and production BLOCKED; no physical shutter or independently rated human eyelid evidence was obtained in this secondary run.
