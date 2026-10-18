# Choose work-observable result: same release, different secret-dependent work

## Verdict

**The current native `choose` executor violates authorized-output closure for a high-level work observable.**

The frozen synthetic witness executed the production `PrivateDecisionRuntime` for 100 hidden budgets. Every case returned the same authorized result, `c0`, while the source-bound preference-evaluation count ranged from 1 to 100.

## Candidate compositional law

For public request (x), hidden state (s), authorized release (R(x,s)), and any additional observable (O(x,s)), confidentiality modulo authorization requires

[
R(x,s_1)=R(x,s_2) Longrightarrow O(x,s_1)=O(x,s_2).
]

For sequential execution, this condition applies at every prefix after conditioning on the complete authorized release transcript. Any remaining variation is an auxiliary channel that must be eliminated, bounded, or separately accounted.

This is established noninterference/declassification reasoning applied to Hush; no historical theorem novelty is claimed.

## Exact counterexample

The public program contained:

- 100 candidates with prices 0 through 99;
- one private constraint, `candidateLtePrivate`;
- one public `lowerPublic` preference;
- hidden synthetic budgets 0 through 99.

For every budget, candidate `c0` was feasible and uniquely optimal. Therefore the authorized transcript was identical across all 100 hidden states.

The current production source performs:

1. a private-dependent filter over candidates;
2. preference scoring only over the resulting feasible array.

Consequently:

- authorized results: one distinct value, `c0`;
- feasible-set cardinalities: 1 through 100;
- predicted constraint evaluations: 100 in every case;
- preference evaluations: 1 through 100;
- distinct unbudgeted work traces: 100.

The artifact was reproduced byte-identically. Its canonical SHA-256 is `fba6712ed601aaa7ee3fd20f13eda9d188d40ca9e50d695af30c4e855816764c`. The separate standard-library audit passed 12/12 checks and bound the exact production source SHA.

## SCIENCE ledger

- True: bounded result cardinality alone does not bound all runtime observables.
- True: in this executor, feasible-set cardinality modulates preference work even when the authorized result is unchanged.
- Mechanism: `filter(private constraint) -> map(preferences over feasible only)`.
- Not established: reliable recovery of the budget by a remote wall-clock attacker.
- Not claimed: constant-time JavaScript, microarchitectural protection, or novelty of the underlying information-flow law.

## CONSEQUENCE ledger

Hush must not describe the current private-decision budget as covering timing or work channels. Before such a claim, the `choose` executor must:

1. evaluate the same number of constraint and preference clauses for every public candidate;
2. preserve all 100 authorized winners;
3. remove feasible-cardinality-amplified work before winner selection;
4. re-run this exact witness plus existing reconstruction and regression suites;
5. retain an explicit limitation for lower-level engine and microarchitectural timing.

A correction may claim only secret-independent **high-level evaluation counts**, not constant-time execution.

## Smallest supported claim

For 100 synthetic hidden budgets that all authorize winner `c0`, Hush's current native `choose` implementation produces 100 distinct source-derived preference-evaluation counts because it scores only the secret-dependent feasible set. This is an exact auxiliary work-channel counterexample to result-only disclosure accounting.
