# HUSH-PCC-048 — real process-crash / acknowledgement-loss duplicate-effect witness

**Date:** 2026-10-23. **Evidence:** executed local HTTP effect oracle, two distinct Node.js child processes, encrypted authorization state reloaded from disk. **CI:** [GitHub Actions run 39981797472](https://github.com/sushxnthd/hush/actions/runs/39981797472), completed SUCCESS (1/1 test passed). Frozen protocol committed as `36560d5` before the test.

## Observed negative result
1. First child registered an authorization transaction and issued an approved one-use action ticket.
2. Its adapter sent an actual POST to a local HTTP receiver; the receiver recorded the fixed semantic operation and returned HTTP 204.
3. The child then deliberately exited with status **66** before returning the action result or receipt to the client.
4. A **fresh second child** loaded the same encrypted transaction state and key, issued a new ticket for the same semantic operation, and exited successfully.
5. The receiver recorded **two identical committed operations**. The restarted broker did not have a durable provider-level deduplication record.

The exact test is `test/action-broker-crash-retry-duplicate.test.js`; it uses no real credentials or external services. This is a counterexample to treating persisted authorization and one-use in-memory tickets as an exactly-once effect guarantee. The test deliberately demonstrates a **failure** and its passing CI result is not a security certificate.

## Compositional lifecycle boundary
The broker can establish a local pre-dispatch authorization decision, but after dispatch there are three independently relevant observables: external side effect, durable local receipt, and client acknowledgement. If the side effect commits before receipt/acknowledgement and a retry is permitted without provider-enforced idempotency, a second effect remains possible. This is classical distributed-systems behavior, not a novel impossibility theorem. For adversarial in-process adapters, the earlier HUSH-046 unmediated-egress counterexample still applies independently.

## Enforced product decision / release blocker
**BLOCK production claims of exactly-once external actions.** A release requires:
- stable semantic operation IDs bound to authorization and replay requests;
- provider-side persistent idempotency keys and atomic deduplication **or** a transactional outbox with reconciliation and documented at-least-once behavior;
- independent crash injection before dispatch, after dispatch/before receipt, after receipt/before acknowledgement, and during cancellation/restart;
- tests with concurrent processes, retried client calls and provider timeouts;
- external review of the threat model, egress mediation and durable state invariants.

This run did not implement a provider-backed idempotency protocol, verify OS-level containment, prove arbitrary adapter noninterference, or establish deployment readiness. Keep draft PR #45 open and release gates closed.
