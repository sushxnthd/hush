# Frozen correction protocol: public-cardinality choose evaluation

**Frozen after the exact work-channel counterexample and before modifying the executor.**

## Precise question

Can Hush eliminate the feasible-cardinality-amplified work channel in native `choose` while preserving every authorized output and all reconstruction controls?

## Mechanism

Replace the current private-dependent pipeline

`filter candidates by private constraints -> score only feasible candidates`

with a fixed public-cardinality pass:

1. visit every public candidate;
2. evaluate every declared constraint for that candidate;
3. evaluate every declared preference for that candidate;
4. retain feasibility and score internally;
5. select the best feasible identifier.

The correction targets high-level evaluation multiplicity only. It does not claim constant-time JavaScript or microarchitectural resistance.

## Frozen exact cohort

Reuse the already-opened 100-candidate synthetic program and all 100 synthetic budgets from the counterexample. This is a correction test, not a new holdout.

For each budget:

- authorized winner must remain `c0`;
- constraint evaluations must equal 100;
- preference evaluations must equal 100;
- the public program, candidate order, and disclosure budget remain unchanged.

## Strongest alternative explanation

Evaluating preferences for infeasible candidates could change error behavior for malformed candidate objects, break existing choice semantics, or interact with reconstruction accounting. Even if the exact witness passes, general regressions could fail.

## Controls

- preserved immutable counterexample artifact;
- pre-correction source hash and 1..100 work-count range;
- all 100 output-equivalence cases;
- existing context-kernel/private-decision tests;
- full repository test suite;
- independent source and arithmetic audit;
- duplicate byte-identical correction run.

## Success gate

All must pass:

1. 100/100 authorized winners remain `c0`;
2. exactly one constraint-work count exists and equals 100;
3. exactly one preference-work count exists and equals 100;
4. production source performs constraint and preference maps over every compiled candidate and no longer scores only the feasible array;
5. the preserved counterexample remains present and unchanged;
6. duplicate artifact is byte-identical;
7. independent audit, focused tests, and full suite pass.

## Kill condition

Kill the correction if any authorized output changes, any high-level clause count remains secret-dependent, or existing reconstruction/accounting tests fail. Do not weaken tests or redefine the observable.

## Project consequence

Pass: Hush may claim secret-independent high-level clause-evaluation multiplicity for this bounded `choose` executor. It must still explicitly disclaim constant-time execution and lower-level timing-channel closure.

Fail: retain the counterexample, keep timing/work outside the privacy claim, and explore process isolation or explicit padding.
