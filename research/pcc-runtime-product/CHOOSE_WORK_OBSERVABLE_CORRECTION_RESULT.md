# Choose work-observable correction result

## Status

**PASS — exact high-level work-channel closure on the frozen correction cohort.**

The production `choose` executor now visits every public candidate, evaluates every declared constraint, evaluates every declared preference, and only then uses the private feasibility bit to update the winning feasible item.

## Frozen result

| Measure | Before correction | After correction |
|---|---:|---:|
| Hidden budgets enumerated | 100 | 100 |
| Authorized winner | `c0` in 100/100 | `c0` in 100/100 |
| Distinct constraint-evaluation counts | 1 | 1 |
| Constraint evaluations per run | 100 | 100 |
| Distinct preference-evaluation counts | 100 | 1 |
| Preference evaluations per run | 1–100 | 100 |
| Independent checks | 12/12 | 15/15 |
| Duplicate artifact | byte-identical | byte-identical |
| Focused tests | n/a | pass |
| Full repository tests | n/a | pass |

Correction canonical SHA-256: `a4bfb8db6188869e3062799b531875372146fcc53cad261cf0fdc47a7b54d79d`

Correction result-file SHA-256: `0ddfff958130caac702607d14ec9e028de0be4557b884f804914b7845e0bb695`

Preserved counterexample canonical SHA-256: `fba6712ed601aaa7ee3fd20f13eda9d188d40ca9e50d695af30c4e855816764c`

Passing correction workflow: https://github.com/sushxnthd/hush/actions/runs/39154101317

The former counterexample workflow fails on the corrected source by design, preserving a visible record that its old source witness no longer holds.

## SCIENCE ledger

The exact counterexample's mechanism survived intervention. Removing `filter(private constraints) -> score feasible only` and replacing it with a public-cardinality full pass eliminated the feasible-set-amplified preference-evaluation multiplicity on every one of the 100 enumerated hidden budgets, while preserving every authorized output.

This is stronger than a timing correlation: the prediction was derived from the source mechanism before the correction and the specified count changed from 100 secret-indexed values to one public-cardinality value after the intervention.

## CONSEQUENCE ledger

Hush's bounded native `choose` runtime no longer exposes hidden feasible-set cardinality through the number of high-level constraint or preference clause evaluations. The runtime design rule is now:

> For bounded private selection, execute each declared clause once per public candidate and make private feasibility affect only internal state selection.

The disclosure-budget claim still excludes lower-level observables.

## Smallest supported claim

Across the frozen 100-budget synthetic cohort, the corrected bounded `choose` executor preserves the authorized result `c0` while source-derived constraint and preference evaluation multiplicities are fixed by public program cardinalities (100 each), not by the hidden feasible-set size.

## Limitations

- This is not a constant-time JavaScript claim.
- It does not close wall-clock, microarchitectural, garbage-collector, exception-shape, allocation, scheduler, process, or remote timing channels.
- The correction cohort is synthetic and already opened; it is an exact mechanism test, not an external holdout.
- Evaluating all declared preferences increases worst-case work to the public bound and can surface malformed public candidate data that an infeasible-only path previously did not touch.
- No broad novelty claim is made for padding or fixed-work execution as a generic technique.
