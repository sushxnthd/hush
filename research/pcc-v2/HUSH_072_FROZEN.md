# HUSH-072 FROZEN | HTTP client cancellation is not provider-effect cancellation

Date: 2026-10-31. Secondary Hush workstream, existing `breakthrough-engine/transaction-scope-recovery-20261021` branch and draft PR #45. Lucent E002-371 remains primary. Frozen before implementation or test execution.

## Hypothesis and precise threat model

A lower-trust client sends an approved action through a loopback HTTP wrapper. The wrapper calls the actual repository ActionBroker; its trusted adapter sends a POST to a separate loopback provider, which holds the request before committing an irreversible synthetic effect. The client disconnects after provider arrival; the authorization transaction is then durably closed. The provider is released after closure. ActionBroker has no caller-supplied AbortSignal or provider cancellation contract in its `execute` API. **Prediction:** the provider still commits one effect, while the client receives no completed response; ActionBroker suppresses the late private result. This is not a proof that all adapters ignore cancellation or that a real third-party API has these semantics.

## Frozen adversarial scenarios

1. Two synthetic private worlds, bit=0 and bit=1, equal public authorization. Each has an approved broker action, actual HTTP wrapper and actual HTTP provider. Wait for provider arrival; abort client HTTP; durably close transaction; then release provider. Expect exactly one provider effect per world, no completed client response, and broker decision `deny` with null result digest. The provider effect may contain the synthetic private bit: public broker-output equality does not imply joint external-observer noninterference.
2. Control: approved, no abort or closure. Expect one provider effect and a successful client response.
3. Control: unapproved request. Expect zero provider effects and a public `ask` result.
4. Independent Python replay consumes sanitized event histories written by the Node test, checking ordering `provider_arrived < client_abort < durable_close < provider_commit`, effect counts and public broker result suppression. Reject missing/duplicate phases or changed effect counts.

No production credentials, external network or real user data. Real loopback HTTP and actual ActionBroker only. Keep traces synthetic, do not upload private results. Preserve negative results; no patch is presumed necessary because cancellation is currently an **unsupported guarantee**. No auto-merge or force-push.

## Enforcement consequence and limitations

Client disconnect, AbortController cancellation, and broker denial after dispatch must never be described as external-effect cancellation. Once a provider request is in flight, return `UNKNOWN_COMMIT_STATE` or equivalent until provider-enforced idempotency/transaction status is independently reconciled. Require verified cancellation acknowledgement at provider commit boundary, linearizable revocation and retry semantics before claiming cancellation safety. A broker-only output gate cannot retract a provider effect or suppress all timing/egress channels.

This test is a classical cancellation/distributed-systems counterexample, **not** a novel information-flow theorem or production-readiness certificate. Production remains BLOCKED pending independent provider review, real crash/restart/cancellation tests, full runtime egress mediation and external security review.