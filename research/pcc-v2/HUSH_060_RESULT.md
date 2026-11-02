# HUSH-060 | Authorization closure must gate private results after adapter await

Date: 2026-10-29. Secondary Hush kernel, existing research branch and draft PR #45. [Frozen preregistration](HUSH_060_FROZEN.md) was committed at `72370617` before the executable test or broker patch.

## Distinct scientific and engineering question

HUSH-049 already established that an asynchronous adapter can perform a **real external HTTP effect after a transaction closes**. HUSH-060 tests the separate, broker-owned disclosure boundary: after a transaction closes while an HTTP adapter is waiting for a private result, does ActionBroker still return that result and a digest to the agent?

The prepatch implementation checked scope before dispatch but not after `await adapter.execute(...)`. The frozen [two-world test](../../test/action-broker-postdispatch-private-result.test.js) makes a real loopback HTTP provider hold a JSON response while the transaction is closed and persisted. A fresh broker confirms durable closure before the HTTP response is released. The private worlds differ by one low-entropy bit. The predicted prepatch observation is `allow` plus the private bit and result digest; the predicted postpatch observation is content-free denial with `receipt.resultDigest=null`. The no-closure and no-approval controls distinguish legitimate approved reads from unauthorized late release.

## Patch and enforcement consequence

[Patch ba30ae8](https://github.com/sushxnthd/hush/commit/ba30ae8594c0411d1303137b906a59bb43248ea5) adds a completion-time `_scopeVerdict(ticket)` **before cloning, redacting, serializing, hashing or returning** the private adapter result. If the scope has expired, closed or changed, the broker consumes the ticket, records a public denial receipt with no result digest, and returns no private result. This is deliberately not described as a pre-dispatch denial: the adapter's provider request or external effect may already have happened.

[Regression adjustment 7bd69f6](https://github.com/sushxnthd/hush/commit/7bd69f6d80d0cdeadf70d4135acb2891c26b71a7) preserves HUSH-049's real post-closure provider-effect witness while requiring the broker's result channel to be suppressed. The [CI workflow](../../.github/workflows/hush-060-postdispatch-private-result.yml) runs the new two-world test and existing post-dispatch, expiry, concurrency and truncated-result controls.

## Evidence and limitations

- [Frozen prepatch hosted run 40768309333](https://github.com/sushxnthd/hush/actions/runs/40768309333) was queued at this report's creation. It runs the original implementation with `HUSH060_EXPECT_LEAK=1`; **do not claim the predicted leak was observed until the run passes**.
- [Patched hosted run 40768483544](https://github.com/sushxnthd/hush/actions/runs/40768483544) was queued at this report's creation. **No hosted pass is claimed**.
- This patch only protects the **same-process broker-to-agent result release**. It does not retract provider-side effects, prevent a malicious trusted adapter from exfiltrating, close timing/size side channels, ensure cancellation of in-flight HTTP, or synchronize transaction closure across concurrently running broker processes. A second broker can have stale in-memory authorization state even if the first broker durably closes the transaction. Cross-process revocation, crash/restart, egress mediation, cancellation/races, and external review remain blockers.
- No production provider or user private data was accessed. The two private bits are synthetic; the HTTP effects and durable encrypted state transitions are real local runtime operations.

**Hush production: BLOCKED.** Lucent E002-371 remains primary and physically unvalidated. No merge, force-push, deployment or schedule change.
