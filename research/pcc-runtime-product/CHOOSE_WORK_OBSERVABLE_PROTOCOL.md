# Frozen protocol: authorized-output closure of runtime work observables

**Frozen before executing the synthetic witness.**

## Active kernel

Can Hush state a compositional law that predicts when a runtime observable leaks information beyond an authorized private-computation result, and does the current native `choose` executor satisfy it?

## Candidate law

For public request (x), hidden state (s), authorized release (R(x,s)), and any externally measurable runtime observable (O(x,s)), the mechanism is closed modulo authorization only if

[
R(x,s_1)=R(x,s_2) Longrightarrow O(x,s_1)=O(x,s_2).
]

For sequential composition, the condition applies at every prefix after conditioning on the complete authorized release transcript. A violation gives an auxiliary channel not charged to the disclosure budget.

This is an application of established noninterference/declassification reasoning; no theorem novelty is claimed.

## Mechanism-derived attack prediction

The current `choose` implementation first filters candidates using private constraints and then evaluates preferences only on the secret-dependent feasible set. Therefore its preference-evaluation work is proportional to feasible-set cardinality.

Freeze 100 public candidates with prices 0..99, one constraint `candidateLtePrivate`, and a public `lowerPublic` preference. For every synthetic private budget 0..99, the authorized winner is candidate `c0`, but the predicted preference-evaluation count is budget+1.

Thus the authorized output transcript is identical while the high-level work trace spans 100 distinct values. Timing, shared-resource contention, or a profiler can expose this unaccounted channel.

## Exact objective

1. Execute the actual `PrivateDecisionRuntime` for all 100 synthetic budgets.
2. Verify every authorized result is `c0`.
3. Verify the production source contains the predicted secret-dependent `filter -> feasible.map` control flow.
4. Independently enumerate feasible cardinalities and confirm 100 distinct work counts.
5. Reproduce the artifact byte-identically and audit it with a separate standard-library checker.

## Strongest alternative explanation

The JavaScript engine may mask wall-clock timing differences. That does not remove the structural channel: the executed preference-work count still differs. The claim is limited to a secret-dependent work observable and does not quantify a remote timing attacker.

## Cheapest decisive falsification

Kill this attack if any budget changes the authorized winner, the source no longer maps preferences over the feasible set, or independent enumeration does not yield 100 distinct work counts.

## Success and project consequence

Success requires an exact same-release/different-work counterexample. Hush must then treat disclosure accounting as incomplete for this executor and replace the secret-dependent preference loop with a fixed-cardinality candidate pass before making any timing-resistance claim.

A later correction must preserve all 100 authorized winners while making the high-level constraint and preference evaluation counts independent of the hidden budget.

## Limits

This protocol does not claim constant-time JavaScript, protection against microarchitectural channels, or a new information-flow theorem. It tests one concrete amplified work channel in Hush's current native private-computation runtime.
