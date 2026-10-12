# Skewed-prior cardinality/min-entropy regime law — preregistration

## Classification

**DISCRIMINATION / SURPRISE.** The preceding exact result showed that PCC
cardinality charge and realized posterior min-entropy reduction coincide for
uniform finite states. This study derives and exhaustively tests the exact
condition under which they diverge for non-uniform priors, without opening the
frozen AgentDAM cohort.

## Hypothesis and mechanism

Let `S` contain `n` feasible secrets with prior probabilities `p(s)`. Let a
deterministic release reveal that the secret lies in nonempty proper branch
`B`, with `k = |B|`, branch mass `q = sum_{s in B} p(s)`, global maximum
`m = max_{s in S} p(s)`, and branch maximum `r = max_{s in B} p(s)`.

PCC cardinality charge is

`C = log2(n / k)`.

Realized statewise min-entropy reduction is

`L = log2(r / (m q))`.

Define global concentration `alpha = n m` and within-branch concentration
`beta = k r / q`. The preregistered regime law is

`C - L = log2(alpha / beta)`.

Therefore:

- `alpha > beta` implies PCC cardinality overcharges this risk measure;
- `alpha = beta` implies exact equality; and
- `alpha < beta` implies PCC cardinality undercharges it.

For singleton branches, `beta = 1`, so the gap must be exactly `log2(n m)`,
the prior's min-entropy deficit from uniform.

## Frozen exhaustive domain

Enumerate every ordered strictly-positive rational prior with denominator
`d = n..12` for `n = 2..7`, using every integer composition of `d` into `n`
positive weights. For each prior enumerate every nonempty proper subset `B`.

The verifier will use exact integer/rational comparisons for regime signs and
floating-point logarithms only for the numerical identity. It will separately
count overcharge, equality and undercharge cases and record the smallest
lexicographic example of each observed regime.

## Predictions and gates

1. The decomposition error is at most `1e-12` in every enumerated case.
2. Exact rational comparison of `alpha` and `beta` predicts the sign of
   `C - L` in every case, with `1e-12` as the numerical zero tolerance.
3. Every uniform prior case is equality.
4. Every singleton branch satisfies the corollary to `1e-12`.
5. The exhaustive domain contains at least one overcharge, equality and
   undercharge case.
6. Two complete executions are byte-identical.

The study passes only if all six gates pass.

## Interpretation frozen before execution

This is a mechanism/boundary result, not a claim that either charge is
universally correct. A positive gap may mean conservative privacy protection or
unnecessary utility loss. A negative gap may mean greater utility or inadequate
accounting relative to this risk definition. OCELOT's calibrated operator upper
bounds and MNC's semantic candidate/scope monitor are not reproduced.

## Claim boundary

Finite strictly-positive rational priors, deterministic set-valued releases,
realized statewise conditional min-entropy, and PCC cardinality charge only.
The result will not establish semantic privacy, calibrated real-world priors,
external utility, named-system superiority, novelty, or a breakthrough-gate
pass.
