# HUSH-066 FROZEN | Cooperative asynchronous effect fence versus durable revocation

Date: 2026-10-30. Secondary Hush kernel on existing `breakthrough-engine/transaction-scope-recovery-20261021` and draft PR #45. This protocol is committed before implementation or test execution. Lucent remains primary; no Lucent branch writes in this bounded secondary run.

## Exact question

HUSH-065 proved a real loopback HTTP credential disclosure after an independent process had **durably committed** revocation, because the broker's final authorization read was not ordered with adapter dispatch. Test a *narrow, opt-in* mitigation: an exclusive, cross-process filesystem lock held from before the broker's authorization check through settlement of the asynchronous adapter promise. A competing durable revocation uses the existing HUSH-064 lock and therefore cannot commit inside this critical section.

This is cooperative serialization of the **adapter promise interval**, not provider-side transactional revocation or a new noninterference theorem. The protected observable is a local adapter invocation and HTTP request initiated before the adapter promise settles; a remote provider may commit an effect later. No deployment readiness follows.

## Frozen adversarial predictions

Use two synthetic credential worlds, a real encrypted filesystem authorization store, an independent Node.js child process attempting closure, and a real loopback HTTP POST provider.

1. **Close before fence acquisition:** asynchronously resolve the credential only after a separate process durably closes the transaction. The fenced broker must deny, with **zero HTTP POSTs** and no credential/result digest disclosure.
2. **Close during fence:** after the broker's final durable authorization read but before the adapter's POST, a separate process attempts closure. The child must receive `AUTHORIZATION_STATE_LOCKED`; the provider may receive one POST **while revocation is not durably committed**. After the adapter settles and the fence releases, closure must succeed. Do not mislabel this as an immediately effective revocation.
3. **Orphan lock:** a pre-existing lock must cause a fail-closed denial and **zero provider effects**. No automatic PID/age lock stealing.
4. **Adapter rejection:** the lock must be released in `finally` so a later revocation can commit. Exceptions must not reveal credential text.
5. **No implicit protection:** the existing unfenced ActionBroker remains covered by the HUSH-065 expected-counterexample regression. New opt-in API must not be described as protecting old call sites.
6. **Conservative semantics:** missing durable state store or missing asynchronous lock support denies the opt-in path. A failed closure while an effect is in flight is an availability and revocation-latency limitation, not evidence that a user request to revoke succeeded.

## Threat model and kill criteria

Assume cooperating local processes, a trusted filesystem with exclusive-create semantics, trusted adapter code, and no adversarial local lock deletion. Exclude malicious privileged processes, network filesystems with unreliable locks, provider-side delayed/queued effects, arbitrary process termination during an external effect, cancellation propagation, and durable exactly-once provider idempotency. A crashed lock owner leaves an orphan that blocks new fenced effects and revocations until operator investigation.

**Kill** the mitigation if any provider HTTP POST starts after independently confirmed durable closure, if a lock can be released before the adapter promise settles, if a competing closer reports success inside the fence, if a lock failure leaks credentials, or if a stale/orphan lock is silently removed.

## Reproduction and evidence tier

Tests should use Node 22 built-in test runner, temporary encrypted state, real loopback HTTP, and spawned independent Node closers; no external network, real secrets or human data. Report both the positive and negative controls. This is a security **engineering experiment** and narrow enforcement consequence, not proof of global provider noninterference. Keep Hush release BLOCKED pending provider commit-point cooperation, crash/restart, cancellation, races, independent replay and external review.

Lucent primary E002-371 remains `ABSTAIN_UNCALIBRATED` and BLOCKED pending physical shutter/clock calibration and two independent blinded anatomical raters.