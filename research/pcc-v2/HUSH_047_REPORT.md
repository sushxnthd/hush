# HUSH-PCC-047 — One-ticket concurrency and transaction-closure race

**Evidence tier:** adversarial local HTTP runtime test, 2026-10-23. The information-flow/observable-closure work remains in draft PR #45. This is an engineering counterexample and a narrowly scoped mitigation, **not** a new information-flow theorem or proof of deployment readiness.

## Frozen pre-mitigation witnesses
See [HUSH_047_FROZEN.md](HUSH_047_FROZEN.md). In the original broker, `execute()` checked `attemptedAt` and `consumedAt` synchronously, but awaited the credential resolver **before** setting `attemptedAt`. Two concurrent calls could both pass the guard and dispatch the same approved ticket. Separately, `_scopeVerdict` ran before the credential-resolution await; closing the transaction during that await did not prevent later adapter dispatch.

The source-level interleavings are deterministic. The new Node test exercises the effects using a **real loopback HTTP receiver**, not only mock return values. No private credentials or external network are required.

## Enforcement consequence implemented
1. Synchronously set `attemptedAt` immediately after the initial scope check, before the first await. A second concurrent execution of the same ticket now fails without reaching the adapter.
2. Move asynchronous credential resolution into the existing error-handling block.
3. Recompute the authorization/scope verdict immediately before adapter dispatch. A transaction closed during credential resolution is denied and produces no HTTP request.
4. Preserve the existing encrypted transaction-state recovery behavior and deny new requests for closed transactions.

## Reproduction
```bash
node --test test/action-broker-concurrency-closure.test.js
node --test test/action-broker-real-network-counterexample.test.js
```
The second test is deliberately a **negative** observable-closure witness: an adapter can still leak through an unmediated network sink despite a declared certificate. A passing negative test does not establish safety.

## Unresolved limitations and release blockers
- An action that has **already entered** arbitrary adapter code cannot be cancelled or rolled back by closing its transaction. The broker has no independent OS/network egress mediation for arbitrary in-process adapters.
- No distributed exactly-once guarantee exists across process crash, external side-effect completion and lost acknowledgements. Receipt persistence and idempotency must be enforced at the external provider boundary or through a transactional outbox with reconciliation.
- A malicious adapter can emit network/process/file side effects outside the broker's declared observable channels; the HUSH-PCC-046 counterexample remains valid.
- The new tests cover one event-loop interleaving and one local HTTP channel; they are not independent security review, OS-level sandbox validation, multi-process race testing or a 72-hour soak.

**Release decision: BLOCK** until independent runtime egress mediation, crash/restart/cancel replay, idempotent provider actions, complete observable-channel inventory, external review and signed evidence artifacts pass. Do not claim the scientific result is novel merely because these robustness gaps were closed.
