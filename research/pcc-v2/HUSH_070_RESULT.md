# HUSH-070 RESULT | A lost provider acknowledgement can duplicate a real effect on retry

Date: 2026-10-31. Frozen first in [HUSH_070_FROZEN.md](HUSH_070_FROZEN.md). Secondary workstream only; Lucent remains primary. Evidence tier: **real loopback HTTP provider OS process, controlled crash/restart, synthetic state, locally tested with a minimal broker stub**. Cross-OS real repository ActionBroker CI committed but not yet confirmed.

## Distinguishable provider histories, indistinguishable broker observation

After an approved request, the provider writes one effect to local state and exits with code 74 **before sending its HTTP response**. The broker sees a failed HTTP request. The same failure would be visible if the provider had exited before writing the effect; the broker cannot distinguish these worlds from the response alone.

In `naive` mode, the provider stores only an effect count. After restarting the provider, a new approved broker action retries the same logical operation and increments the effect count to **2**. In `guarded` mode, the provider stores effect count and operation idempotency key in the same atomic local file replacement; the retry returns an already-committed acknowledgement and leaves the count at **1**.

| Frozen scenario | After first request | After retry |
|---|---:|---:|
| Naive post-effect crash before acknowledgement | 1 effect, HTTP failure | **2 effects** |
| Guarded post-effect crash before acknowledgement | 1 effect, HTTP failure | **1 effect** |
| Guarded normal repeated request | 1 effect, success | **1 effect** |
| Invalid operation key | 0 effects, rejection | Not retried |

**Local verification:** 4/4 Node tests passed using a minimal ActionBroker-compatible stub; the test source imports the actual `src/action-broker.js` in the repository. Real ActionBroker CI was queued at report creation and is **not claimed passed**. The fixture is an intentionally simple single-provider local-file model, not a distributed transaction implementation. Its effect counter and idempotency ledger are in the same file; this favorable assumption fails for many real external APIs.

## Scientific interpretation

This is a standard lost-acknowledgement / exactly-once impossibility boundary, not a new theorem. A broker-only receipt, an enqueue-time authorization check, and even HUSH-069's serializable revocation/commit epoch do **not** provide exactly-once external effects if the provider can commit then lose the response. For safe retry, the external provider must expose and enforce an authenticated, durable, scoped idempotency/transaction identity, and the broker must preserve that identity across retries and crashes. If the provider lacks this contract, the honest outcome is `UNKNOWN_COMMIT_STATE` and a **manual reconciliation/abstention** path, not blind retry or a false failure assertion.

## Release blockers

- Confirm real ActionBroker tests on all hosted OS runners; preserve any failures and logs.
- Prove identity/key scoping across principals, payloads, authorizations, expiration and revocation; prevent cross-operation replay or key substitution.
- Test cancellation racing with commit, crash before and after external effect, provider retry after restart, duplicate HTTP delivery, provider replica races and lost acknowledgements.
- Verify provider's real idempotency semantics and atomicity of effects versus receipts. Local rename is not fsync durability, nor an atomic external API transaction.
- Threat-model malicious adapters, leaking status/latency/headers, compromised broker state and observable closure under partial authorization.
- Require independent replay of sanitized histories and external security review before deployment.

Production `BLOCKED`. Do not claim general compositional information-flow novelty or deployment readiness. The primary Lucent PR/branch is not modified by HUSH-070.
