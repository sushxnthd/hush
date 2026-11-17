# HUSH-078: incomplete channel inventory is not an observable-closure certificate

**Evidence tier:** source-level counterexample with a prospective failing regression test; not an executed runtime exploit, external review, or deployment validation.

## Exact witness
In `src/observable-closure-contract.js`, `certifyObservableClosure` checks only the names in `externalChannels`. It computes `extras=Object.keys(closure).filter(channel=>!channels.includes(channel))` but nevertheless returns `{safe:true,reason:'CERTIFIED',...,extras}`. For worlds `private0` and `private1` with the same global authorization `ask`, declare only `http.body` with identical traces. Supply an additional `http.response-order` channel with traces `['a','b']` versus `['b','a']`. The undeclared channel reveals the private world, yet the declared-channel certificate reports safe. This is a scope/inventory counterexample, **not evidence that the deployed broker actually emits the extra channel**. The independent network-order channel already has a separate synthetic wrapper witness (HUSH-052).

## Why it matters
Noninterference is compositional only when the projection covers the complete observer-visible trace, including presence/absence, ordering, timing where measurable, transport errors, persistence/replay, cancellation, and restart. Equality of selected projections does not imply equality of their union with an unexamined channel. In symbols, equality of P_C(T0) and P_C(T1) says nothing about P_(C union {e})(T0) versus P_(C union {e})(T1).

## Enforcement consequence
A channel certificate must be tied to an independently audited, versioned **complete channel inventory** for a specific broker/runtime/transport boundary. Reject extras instead of returning CERTIFIED; reject unenumerated transport or scheduler channels; require independent runtime tests across restart/cancel/races. A closed schema is necessary but not sufficient: even no extras in the caller's supplied object cannot establish that the real runtime has no undeclared channel. An adapter cannot self-certify completeness. Gate deployment on external inventory review.

## Reproduction
`node --test test/observable-closure-inventory-078.test.js` is intentionally red against the inspected implementation; a passing run requires a fail-closed fix and independent checks. No execution or GitHub Actions success is claimed in this artifact.

**Release status:** BLOCKED pending complete runtime channel inventory, fail-closed enforcement, real end-to-end adversarial tests, and external review.
