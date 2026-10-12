# Finite-domain matched-control accounting equivalence — preregistration

## Classification

**DISCRIMINATION / SURPRISE.** This tests whether PCC has any accounting-level
advantage over a posterior-min-entropy control and a history-aware semantic
declassification control when all three receive exactly the same finite uniform
state, deterministic candidate release, history and budget.

The controls are narrow mathematical specializations motivated by OCELOT's
realized conditional-min-entropy security objective and MNC's history-aware
semantic declassification. They are not author-code reproductions and do not
instantiate OCELOT's calibrated per-operator upper bounds or MNC's scope monitor.

## Hypothesis

For a uniform feasible set `S` and observed deterministic release branch
`B subset S`, all three charges reduce to:

`log2(|S| / |B|)`.

- PCC calls this realized exact-partition knowledge.
- Posterior-min-entropy control obtains it as the decrease in uniform posterior
  min-entropy.
- History-aware semantic control obtains it by composing the typed disclosure
  with the same feasible posterior.

Therefore, with identical feasible-branch preauthorization and budgets, their
allow/deny decisions must also agree. Any empirical advantage must come from a
different candidate family, witness/declassifier quality, scope enforcement,
prior model, identity persistence, refusal handling or systems integration—not
the charge formula in this regime.

## Frozen exhaustive domain

For domain sizes `n=2..12`, enumerate every nonempty current feasible subset
`S`, every nontrivial binary release partition within `S`, and both observed
branches. Test weights `0.5, 1, 2` and budgets `0, 0.25, 0.5, 1, 2, 4, 8, 16`.

## Predictions

1. PCC, posterior-min-entropy and history-aware specialization charges agree to
   `1e-12` in every case.
2. All three budget decisions agree in every weighted case.
3. Repeated disclosure is free after the posterior has already been restricted
   to one branch.
4. A non-uniform two-secret prior `(0.9, 0.1)` is a minimal boundary:
   cardinality charge is one bit, while the statewise min-entropy reduction
   under the stated risk definition is `log2(1/0.9)`; equality therefore fails.
5. Two complete runs are byte-identical.

## Claim boundary

This is an exact finite uniform deterministic-release equivalence result. It is
not an empirical comparison or a reproduction of either full prior system and
says nothing about calibrated operator bounds, learned witnesses, semantic
candidate quality, scope enforcement, probabilistic priors, stochastic
channels, side channels or end-to-end utility.
