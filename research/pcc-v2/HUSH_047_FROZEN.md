# HUSH-PCC-047 — frozen concurrent execution and closure-race protocol

Date 2026-10-23. Existing Hush PR #45 branch only; do not replace branch, merge or force push.

## Kernel
Authorization-scope certificates are not enough if a single approved action ticket can be dispatched more than once across an asynchronous credential-resolution boundary, or if a transaction closes after scope validation but before adapter dispatch. This is a lifecycle/linearizability test, **not** a novel information-flow theorem.

## Prospective adversarial test
Use a real local HTTP receiver. Register an adapter with one opaque credential reference and an async secret resolver held behind a deferred promise. Create one approved transaction-bound ticket. Start two execute calls concurrently before resolving the secret. In the original implementation, both can pass the consumed/attempted check before awaiting the secret resolver. Record actual HTTP dispatch count, not just broker return values.

Independently, start execution, close the authorization transaction while credential resolution is pending, then release the resolver. The closure should prevent dispatch if closure semantics are intended to revoke pending work. Test denial of new requests after closure. Persist the closed transaction and verify fresh-process restart cannot reopen it.

## Frozen predictions
- P1: Before mitigation, the await-before-reservation interleaving admits two dispatches for one ticket.
- P2: Before mitigation, the scope-check-before-await interleaving admits dispatch after a transaction has closed.
- P3: Reserving a ticket synchronously before the first await eliminates double-dispatch; rechecking transaction scope immediately before adapter dispatch eliminates the demonstrated closure race.
- P4: Closure *after* dispatch begins cannot revoke already executed external effects without a separately enforced cancellation/egress boundary. Keep this as a release blocker, not a solved case.

## Evidence tier and limitations
Local Node HTTP tests establish one event-loop race and one closed-transaction interleaving. They do not prove distributed exactly-once semantics, OS-level network mediation, cancellation safety, or production readiness. Preserve the pre-mitigation witness and independent reproduction commands. Fail closed when the authorization state is missing, corrupted or closed.
