# Observable-fiber prefix law and fail-closed trace checker

## Status

**PASS — exact structural boundary and executable checker.** This is a classical staged-noninterference result operationalized for Hush, not a new information-flow theorem.

## The law

Fix public input `x`, finite private worlds `s`, a staged authorized transcript `A_<=t(x,s)`, and the public runtime trace `O_<=t(x,s)`. The trace adds no distinction before or beyond the authorization available at time `t` exactly when, for every prefix,

`A_<=t(x,s1) = A_<=t(x,s2)  =>  O_<=t(x,s1) = O_<=t(x,s2)`.

Equivalently, at each time there is a function `f_(x,t)` with `O_<=t = f_(x,t)(A_<=t)`. The proof is exact: constancy on each authorized-prefix fiber makes `f_(x,t)` well-defined; factorization immediately implies constancy.

Prefix closure implies final closure. The converse holds for every possible public trace exactly when no current authorized fiber is refined by a later authorized transcript. If a future release splits a current fiber, publishing that future class now is a minimal trace that passes final-only checking but violates prefix closure. Thus future refinement is the sharp structural boundary between equivalent and non-equivalent final/prefix enforcement.

## Exact enumeration

Every binary authorized-event/public-observable schedule was exhausted for two or three private worlds and one to three event times.

| Quantity | Count |
|---|---:|
| Schedule pairs | 270,672 |
| Prefix-safe | 76,872 |
| Final-safe | 188,872 |
| Final-safe but prefix-unsafe | 112,000 |
| Prefix-safe but final-unsafe | 0 |
| Independent audit | 10/10 |

There was no gap at one event time. The smallest strict witness used two worlds and two event times: both worlds had the same first authorized event, their later authorized events differed, and the first public observation exposed that future class early. Across every enumerated authorized schedule, a final-safe/prefix-unsafe public trace existed if and only if a later authorized event refined an earlier authorized fiber; boundary disagreements were zero.

## Adversarial channel prediction

Five unseen trace classes were tested: status, payload byte length, event order, item multiplicity, and high-level work count. In each fixture the final aggregate control was identical across worlds, while the intermediate trace differed. The checker rejected all five at prefix one. This confirms that fixed total work or a harmless eventual result does not certify the event trace.

## SCIENCE ledger

- **True:** final-output factorization can accept an early release of information that becomes authorized only later.
- **Sharp boundary:** final-only checking is universally sufficient exactly when later authorization never refines an earlier authorized fiber.
- **Exact support:** 270,672/270,672 finite schedules agreed with the boundary; an independently written enumerator reproduced every shape count.
- **Prior-art boundary:** noninterference, declassification, observational determinism, and post-processing are established. The mathematical law is not claimed as historically novel.

## CONSEQUENCE ledger

Hush now has a reusable fail-closed `verifyObservablePrefixClosure` checker. Runtime/evaluation contracts can enumerate finite private worlds and declare authorized and public events at the time each occurs; the checker returns the first pair of worlds and prefix that violate the contract. Approval prompts, receipt projections, event streams, error classes, multiplicities, lengths, and source-level work counters must be checked at emission time, not only after the operation finishes.

This generalizes the earlier bounded-`choose` work-count and semantic path-digest corrections into one enforceable trace rule. It does not make JavaScript constant-time or certify unenumerated worlds.

## Verification

- frozen exhaustive runner: PASS;
- independent standard-library audit: 10/10;
- duplicate result: byte-identical;
- focused checker tests: 4/4;
- full repository suite: 343/343.

## Smallest supported claim

For finite deterministic staged traces, Hush's checker exactly enforces prefix-wise observable-fiber closure. Exhaustive binary enumeration through three worlds and three event times establishes the sharp future-refinement boundary and finds 112,000 traces that a final-only check accepts but prefix enforcement rejects.

## Limitations

The checker requires an explicit finite world model and declared observation projection. It cannot discover omitted wall-clock, allocation, scheduler, cache, microarchitectural, network, or cross-process observables. Randomized mechanisms require distributional rather than pointwise fibers. Adaptive unbounded executions require abstraction or induction beyond this finite checker.
