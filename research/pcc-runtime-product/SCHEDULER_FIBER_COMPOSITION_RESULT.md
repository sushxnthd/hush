# Scheduler-fiber composition law

## Decision

The frozen kernel survives. Individually prefix-safe components do **not**
compose under an arbitrary concurrent scheduler. They compose under a scheduler
whose next observable component choice factors through the authorization
available at that prefix and the already-public history.

## The law

Let `~t` identify private worlds with the same authorized transcript at prefix
`t`. Assume that, whenever two worlds are related and have the same public
history, every enabled component has the same next tagged observable in both
worlds.

If the scheduler also chooses the same component in those worlds, the next
composite observation is equal. Induction over prefixes proves composite
observable-fiber closure.

The scheduler condition is necessary for **universal** composition. If it
selects different components in two worlds in one authorization fiber, choose
two locally constant components with distinguishable public tags. Their first
composite observations differ even though both local traces are safe. Thus the
schedule itself carries the hidden distinction.

This necessity statement is deliberately universal, not pointwise. A fixed
untagged system can accidentally mask a private schedule choice when both
selected next events are observationally identical.

## Frozen exact result

The exhaustive model used four worlds `(public_bit, hidden_bit)`, two
authorization fibers, two individually safe one-event components, all 16 pairs
of binary payload functions of the public bit, and all 16 deterministic order
functions over the four worlds.

| Measure | Frozen prediction | Observed |
|---|---:|---:|
| Systems | 256 | 256 |
| Final canonical-multiset audit passes | 256 | 256 |
| Ordered-prefix-safe systems | 64 | 64 |
| Scheduler-fiber-safe systems | 64 | 64 |
| Scheduler-only leaks | 192 | 192 |
| Criterion disagreements | 0 | 0 |

The minimal witness uses two components that both emit the same constant
payload. One hidden world schedules `B` first and its paired world schedules
`A` first. The first tagged observation therefore distinguishes the worlds,
while the final canonical event multiset is identical. A final-only or
order-insensitive audit accepts the attack.

## Executable capability

`src/scheduler-fiber-contract.js` implements a fail-closed finite certificate.
It checks component safety first, then scheduler constancy on every current
authorization fiber, and returns the first violating world pair, selected
components, and prefix. Malformed or incomplete schedules are rejected.

Validation:

- primary enumeration reproduced byte-for-byte;
- independent Python count/hash audit: 8/8;
- focused contract tests: 3/3;
- full repository regression: 342/342.

## Priority boundary

Secret-influenced scheduling, observational determinism, concurrent
noninterference, and hyperproperties are established topics. Relevant primary
anchors include Zdancewic and Myers (CSFW 2003), Sabelfeld and Myers (IEEE JSAC
2003), and Clarkson and Schneider (JCS 2010). The broad theorem pattern is
therefore classical.

The smallest defensible contribution is Hush's authorization-fiber scheduler
contract: a sharp, prefix-indexed composition rule tied to staged disclosure,
plus an executable counterexample-producing checker. This is not claimed as a
new general theory of concurrent noninterference.

## Project consequence

Per-component trace checks are insufficient evidence for a concurrent Hush
surface. Any future broker, stream multiplexer, or parallel tool runtime must
show that component selection is a function only of the current authorized
transcript, public history, and enabled public state. Where a finite schedule
table is available, the new checker can certify it; otherwise the boundary must
enforce an equivalent public scheduler key or serialize emissions. Failure to
provide that evidence must block release.

## Limits

- The executable checker currently handles deterministic finite plans with one
  tagged event per component; the proof covers longer deterministic traces by
  induction, but that generalization is not yet implemented.
- Probabilistic schedulers require equality of conditional public
  distributions, not merely deterministic choice equality.
- Timing, starvation, termination, priorities, and resource-contention
  observables are outside this artifact.
- This is internally reproduced, not independently replicated by a third party.
