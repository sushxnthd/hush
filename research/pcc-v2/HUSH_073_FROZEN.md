# HUSH-073 FROZEN | Post-revocation provider failure is a status side channel

Date: 2026-10-31. Bounded Hush secondary workstream; Lucent E002-371 remains primary. This protocol is committed before the adversarial test or broker patch. No real private data or external provider is used.

## Distinct untested failure mode

HUSH-060 checks successful provider responses after a durable authorization close. HUSH-072 checks client cancellation and later provider commit. Neither checks a **private-dependent provider rejection** after revocation. The current ActionBroker success path rechecks authorization after `await adapter.execute` and suppresses the result; its exception path catches untrusted adapter errors and returns `decision:error` without a completion-time scope check. The exception text is redacted, but the decision/status can disclose a private bit when the other world resolves normally and returns `decision:deny`.

## Pre-registered two-world attack

Use the actual repository ActionBroker, encrypted durable authorization store, and a real loopback HTTP provider. Both worlds share the same public parity authorization and identical approved ticket shape. Hold the HTTP response after provider arrival, durably close the authorization transaction, independently reload a fresh broker to verify closure, then release the provider. Private world 0 returns HTTP 200 with JSON; private world 1 returns HTTP 503 with an untrusted secret-bearing error body. The adapter rejects on non-200. No raw secret or response body may be projected to the observer.

**Predicted prepatch:** world 0 => `deny`, receipt `deny`; world 1 => `error`, receipt `error`. A single decision bit recovers the private world despite identical public authorization and no result payload.

**Required postpatch:** both closed worlds => `deny`, identical public denial reason and receipt status, null result digest, no `result` property, and no secret text in JSON. A successful durable closure must suppress *both success and failure* channels at the broker-to-agent boundary. Do not infer provider effects or privacy of timing/network traffic.

## Controls and kill criteria

1. Approved **open** world 0 must return `allow`; approved **open** world 1 must return sanitized `error` (authorized provider failure).
2. Unapproved ticket must dispatch zero provider requests.
3. A durable close must be independently visible to a fresh broker before provider release.
4. Two-world closed test must use the actual ActionBroker, not a stub; preserve a prepatch expected-leak run if possible and run the patched suite on Linux, Windows and macOS.
5. Run HUSH-060, HUSH-072 and existing scope-expiry regressions. Do not call an unverified queued CI run successful.
6. If any closed-world status, reason, digest or untrusted error text distinguishes the private worlds, **fail** the patch and keep production blocked.

## Scope and consequence

This is a concrete runtime information-flow counterexample to **broker-owned post-revocation status noninterference**, not a novel general compositional law. It does not cover provider-visible requests, effects, response timing, scheduling, headers, client disconnects or malicious adapters. The enforcement rule is: after an asynchronous adapter settles **by either fulfillment or rejection**, the broker must re-evaluate the authorization boundary before publishing any outcome-dependent status. Production remains BLOCKED pending provider-enforced commit authorization, durable reconciliation, complete mediation and external review.
