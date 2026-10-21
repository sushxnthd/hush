# Cumulative Authorization-Join Result

## Smallest supported claim

For a finite private-world set, separately approved calls are universally safe under a transaction-wide authorization `G` exactly when every local authorization `A_i` factors through `G`:

`ker(G) subset intersection_i ker(A_i)`.

This partition result is classical in substance, not claimed as a new information-flow theorem. The Hush system result is narrower and operational: a broker can reject a locally valid approval *before release* when that approval can refine a protected global fiber, even if the particular response happens to be constant. Existing outcome-only cumulative checks cannot make that prospective decision.

## Proof

Local safety says `ker(A_i) subset ker(O_i)`. If `ker(G) subset ker(A_i)` for every `i`, transitivity gives `ker(G) subset ker(O_i)` for every locally safe observation. The kernel of the joint observation is `intersection_i ker(O_i)`, so the joint observation factors through `G`.

Conversely, if some globally indistinguishable pair is split by `A_j`, choose the allowed local observation `O_j = A_j` and constant observations for every other call. The joint observation splits that global fiber. Thus universal safety fails.

## Exact and prospective evidence

- Enumerated all 16 binary maps on four worlds and all 4,096 triples `(G,A_1,A_2)`.
- Enumerated 57,600 pairs of locally safe binary observations.
- Structural criterion vs direct universal oracle: **0 disagreements**.
- Universally composable authorization systems: **232 / 4,096**.
- Independent Python reimplementation reproduced all six substantive counts exactly without importing the JavaScript checker.
- Frozen eight-world/three-call fixtures: **4 / 4 passed**, including parity-vs-coordinate split approval, scoped parity calls, a latent overbroad approval with a constant release, and identity-global authorization.
- Full repository test suite: pass (including five new contract tests).

The first wrapper-level gate failed because it diffed two summaries with different metadata fields. That failure is preserved in `raw/cumulative-authorization-failed-gate.txt`; it did not change either checker or any frozen prediction.

## Adversarial consequence

With global authorization `x XOR y`, separately approving `x` and `y` makes each response locally valid while their tuple reconstructs `(x,y)` and distinguishes same-parity worlds. The checker returns the first call and world pair that refine the global fiber. A constant response under the same overbroad approval is outcome-safe but still rejected by the prospective universal gate.

## Priority audit

- Denning's 1976 lattice model established lattice-structured secure information flow: <https://doi.org/10.1145/360051.360056>.
- Clarkson and Schneider formalized noninterference-style security policies as hyperproperties: <https://www.cs.cornell.edu/fbs/publications/Hyperproperties.pdf>.
- Myers and Liskov's decentralized label model addressed separately owned policies and relabeling: <https://doi.org/10.1145/269005.266669>.

These sources make the factorization/partition core non-novel. This run did not find a primary source stating Hush's exact receipt-scope API rule, but absence from this bounded audit is not evidence of novelty.

## Project consequence

Approval receipts need a transaction-scope identifier and a canonical authorization-partition commitment. Before disclosing a call result, the broker should run the universal scope check; after disclosure, it should retain the existing cumulative observation audit. The two gates intentionally differ: the first controls capability, the second records realized leakage.

## Limits

- Finite, deterministic world maps only; no probabilistic leakage metric.
- A fixed transaction-wide authorization is assumed; policy changes need a prefix-indexed extension.
- The theorem does not solve authorization elicitation or decide which global distinctions a user intended to permit.
- The exact counts are validation evidence, not a novelty claim.
