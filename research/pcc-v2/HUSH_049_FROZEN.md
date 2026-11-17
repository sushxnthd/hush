# HUSH-PCC-049 frozen protocol — close-after-dispatch cancellation gap

Frozen before executing the test. Existing branch `breakthrough-engine/transaction-scope-recovery-20261021` and draft PR #45 remain unchanged in identity. This is a bounded secondary investigation; Lucent E002-401 is the primary experiment.

## Question

HUSH-047 rechecks authorization immediately before adapter dispatch, but an arbitrary asynchronous in-process adapter can postpone its external side effect until **after** transaction closure. Does closing a transaction revoke effects already dispatched to an adapter?

## Locked adversarial test

Use a real loopback HTTP receiver, an approved broker ticket with valid global/local authorization, and an adapter that pauses after broker dispatch but before its HTTP POST. Synchronize with explicit promises (no sleep-based race). After adapter entry, call `closeAuthorizationTransaction('tx')`; then release the adapter. Record the real HTTP POST and broker decision.

- H1: No POST occurs before adapter release.
- H2: The closed transaction persists in the encrypted authorization store and rejects fresh requests after a new broker instance reloads it.
- H3: Despite H2, exactly one real HTTP effect occurs **after** closure when the already-dispatched adapter resumes.
- H4: The original `execute` returns `allow` for the completed effect, demonstrating that closure is a pre-dispatch gate, not revocation of already-dispatched work.
- H5: Control: closure before credential resolution completes denies before adapter entry and produces no HTTP effect (existing HUSH-047 behavior).

## Scope and product consequence

This is a concrete cancellation/lifecycle counterexample, not a new impossibility theorem. Without a broker-owned cancellable mediator that checks a durable transaction epoch at the *actual effect boundary*, no claim of strict cancellation or closure-time effect suppression is justified. Even a mediator cannot undo effects already externally committed. Keep release blocker active, do not claim production readiness, preserve all previous tests and negative evidence. The test does not exercise hostile OS egress or prove distributed exactly-once.
