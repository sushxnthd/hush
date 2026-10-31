# HUSH-070 FROZEN | Post-effect/pre-ack crash makes retry ambiguous

Date: 2026-10-31. Bounded secondary workstream; preserve branch `breakthrough-engine/transaction-scope-recovery-20261021` and draft PR #45. HUSH-069 real ActionBroker cross-process CI succeeded, but commit/revocation serialization does not solve provider retry after an acknowledgement is lost.

## Falsifiable lifecycle claim
A broker observes the same failed HTTP response in two worlds: (a) provider committed an effect and died before acknowledgement, (b) provider died before committing. Retrying without provider-side idempotency may duplicate the effect; refusing retry sacrifices liveness in world (b). This is a classical distributed-systems indistinguishability argument, **not novel information-flow theory**.

## Frozen controlled test
Use the actual repository ActionBroker to approve a synthetic operation and send it to a loopback HTTP provider in a separate OS process. The provider has two modes: `naive` persists an effect counter without durable operation identity; `guarded` atomically writes effect counter and idempotency key into the same local state file. In each mode the first provider process must commit once and terminate before returning HTTP success. The broker must observe failure. Restart the provider and retry the same logical operation with a new approved broker action. Predictions: naive ends with 2 effects; guarded ends with 1 effect and a replay acknowledgement. Test the no-crash normal path and reject an invalid idempotency key. Use no real credentials, no external endpoints, no secret-bearing traces.

## Negative controls and release consequence
- A post-effect crash with no provider ledger must duplicate on retry, otherwise preserve falsification.
- Guarded replay must not create a second effect. This only works because the synthetic effect and ledger share one atomic file rename; **external side effects cannot generally be rolled back or made atomic with a local ledger**.
- If crash happens before effect, a retry is necessary for progress, but a lost acknowledgement is observationally indistinguishable from the post-effect case to the broker.
- If the provider lacks a documented idempotency/transaction contract, Hush must abstain from exactly-once or safe-retry promises. Production BLOCKED pending real provider review, crash durability, cancellation, races, hostile adapters and external security assessment.
