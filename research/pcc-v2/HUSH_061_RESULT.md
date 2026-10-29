# HUSH-061 | Durable cross-process revocation is invisible to a stale broker

Date: 2026-10-29. Secondary Hush kernel; existing branch and draft PR #45. [Frozen preregistration](HUSH_061_FROZEN.md) committed before the adversarial test and patch. Evidence tier: real local HTTP, encrypted durable authorization, separate OS-process revocation, software regression; **not production security certification**.

## Observational-cut law and falsification

Let two worlds differ only in a private adapter result bit. If transaction authorization has been durably revoked before the broker releases the result, the broker-to-agent observable must not depend on that bit. A check against an old in-memory authorization snapshot is insufficient: an independent broker can close the transaction in persistent storage while the first broker is suspended at an asynchronous adapter boundary.

This is a concrete instance of a standard compositional noninterference requirement: every path from a private source to an observable sink must cross a revocation-aware enforcement cut. **The cut must be ordered with revocation to give a global guarantee.** A synchronous re-read improves detection but does not make the read and output atomic across processes. This is not claimed as a new general information-flow theorem.

## Frozen prepatch witness

The [test](../../test/action-broker-cross-instance-revocation.test.js) dispatches a real loopback HTTP read and holds the response. A separate ActionBroker in a distinct OS process closes the transaction in the shared encrypted state file, and a fresh broker verifies that the durable closure exists before the private HTTP response is released. The original broker still holds an open in-memory transaction.

The [prepatch GitHub Actions run 40813437683](https://github.com/sushxnthd/hush/actions/runs/40813437683) completed with two expected test failures: it returned `allow` where `deny` was required for (1) a stale broker after durable closure and (2) corrupted persistent state. The existing HUSH-058/060 controls passed. At that stage the test used two independent in-process broker instances; the test was subsequently strengthened to use a **real child OS process** for closure. The prepatch hosted result establishes the stale-instance disclosure, while the child-process variant still requires hosted verification. The two-world private bits are synthetic; HTTP and persistence operations are real.

## Enforcement change

[Patch 4a344c1](https://github.com/sushxnthd/hush/commit/4a344c1aa98baaeb59c2971305ca19a89a3eaee8) makes `_scopeVerdict` read and verify the durable transaction on every authorization check when an encrypted store is configured, including before dispatch and immediately after adapter completion. Missing, duplicate, closed, corrupt, unreadable or commitment-mismatched durable state fails closed before any private result is cloned, redacted, serialized, hashed or returned. Unscoped actions and brokers without a configured persistent store retain their existing semantics. The patch does not rewrite another worker's durable state.

[HUSH-061 hosted postpatch run](https://github.com/sushxnthd/hush/actions/runs/40813484511) was queued when this report was written; no success is claimed until the run completes. A prior postpatch run 40813456838 was also queued. Test commits and hosted failures are retained, not rewritten.

## Precisely remaining leakage and release blockers

1. **Time-of-check/time-of-use:** another process can close the transaction immediately after the final synchronous reload and before result emission. No linearizable authorization lease or revocation/return ordering is implemented.
2. **Stale writers:** independent writers can overwrite newer encrypted state without a cross-process compare-and-swap/lock. Durable encryption and atomic rename do not provide serializable authorization state.
3. **External effects:** the provider request already occurred before completion-time denial. This patch cannot retract HTTP writes, guarantee cancellation, or constrain trusted-adapter exfiltration.
4. **Observable side channels:** elapsed time, network traffic, provider-visible requests, error types and result-size effects remain outside the broker result-channel proof.
5. **Crash/restart:** recovery, in-flight cancellation, idempotency and process termination still require adversarial end-to-end verification with real providers or controlled replicas.
6. **Independent replay/review:** an external security review, a precise deployed threat model, production audit logging and fail-closed integration tests are absent.

**Enforcement consequence:** Treat a durable close detected at the completion cut as a content-free denial with null result digest. Do not advertise cross-process revocation safety, provider-side secrecy or deployment readiness. Hush production remains BLOCKED. Lucent E002-371 human validation remains primary and untouched.
