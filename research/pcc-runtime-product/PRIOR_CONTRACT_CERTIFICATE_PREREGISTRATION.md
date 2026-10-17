# Multiplicative prior-contract certificate — preregistration

Status: **FROZEN BEFORE OUTCOMES**

Action class: DISCRIMINATION + PRODUCT-TRANSLATION.

## Question

Can Hush safely use a calibrated non-uniform prior without silently undercharging
statewise min-entropy leakage when the deployed prior differs from the declared
prior?

## Hypothesis and mechanism

For strictly positive priors `p` (true) and `h` (declared) on the same finite
state space, define the pointwise multiplicative mismatch certificate

`rho = max_i max(p_i / h_i, h_i / p_i) >= 1`.

For a nonempty proper deterministic branch `B`, define

`L(x,B) = log2(max_{i in B} x_i / (max_i x_i * sum_{i in B} x_i))`.

The preregistered theorem is

`|L(p,B) - L(h,B)| <= 3 log2(rho)`.

Mechanism: branch-maximum, global-maximum, and branch-mass ratios are each
bounded within `[1/rho, rho]`; their product therefore changes by at most
`rho^3`.

The product policy is the fail-closed charge

`R(h,B,rho) = max(0, L(h,B) + 3 log2(rho))`.

Prediction: `R >= max(0, L(p,B))` for every enumerated certified pair and
branch. Thus a release allowed by `R <= budget` must never be a false-safe
decision relative to the true statewise charge.

## Frozen evaluation

Enumerate every ordered strictly-positive rational prior with:

- domain size `n = 2..5`;
- denominator `d = n..10`;
- ordered positive integer numerators summing to `d`.

For every ordered pair `(p,h)` at equal `n`, enumerate all nonempty proper
branches. No sampling or case deletion is permitted.

Decision budgets, in bits, are frozen as:
`[0, 0.25, 0.5, 1, 2, 4]`.

Compare:

1. true oracle `T=max(0,L(p,B))`;
2. cardinality `C=log2(n/|B|)`;
3. nominal calibrated `N=max(0,L(h,B))`;
4. certified robust `R=max(0,L(h,B)+3log2(rho))`.

For each comparator record false-safe decisions (allows while `T>budget`) and
false denials (denies while `T<=budget`). These counts characterize only the
frozen grid, not any population frequency.

## Preregistered gates

PASS requires all of:

1. zero theorem-bound violations;
2. zero robust-charge upper-bound violations;
3. zero robust false-safe decisions at every frozen budget;
4. exact agreement when `rho=1`, within `1e-12`;
5. two full runs produce byte-identical canonical JSON;
6. an independent implementation recomputes the headline aggregate digest and
   agrees.

Any theorem or robust-safety violation is FAIL. Infrastructure failure is
INCONCLUSIVE.

## Frozen surprise searches

The verifier will report, without affecting PASS:

- the largest observed normalized mismatch
  `|L(p,B)-L(h,B)|/log2(rho)` for `rho>1`;
- whether the stronger candidate `2 log2(rho)` has a counterexample;
- minimal false-safe examples for nominal and cardinality accounting;
- utility cost of the robust certificate as false denials.

These outputs may generate a narrower follow-up law, but may not be used to
alter the gates above.

## Evidence and limitations

The output must include Python version, UTC creation time, exact CLI, grid
definition, canonical payload digest, and SHA-256. Raw results are immutable
after completion.

This study covers strictly positive finite rational priors, deterministic
set-valued releases, a supplied valid `rho`, and realized statewise
min-entropy. It does not establish that a learned prior is correct, that an
adapter can honestly certify `rho`, semantic privacy, stochastic-channel
security, universal privacy, historical novelty, or external task advantage.
