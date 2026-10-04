# Partition-aware privacy experiment

## Why this experiment exists

The current private-decision runtime bounds the *number of possible outputs* of a program. That is useful, but it is not enough to characterize the knowledge gained from the answer that actually occurred.

A binary predicate has only two possible outputs, yet a rare branch can collapse a very large private domain to a tiny posterior set. For a uniformly modeled integer secret in `0..999999`, the predicate `secret == 734219` has output cardinality two, but a `true` answer collapses one million feasible values to one. The realized knowledge gain of that branch is `log2(1,000,000) ≈ 19.93` bits, not one bit.

This is a known distinction in privacy accounting and quantitative information flow: global/nominal privacy bounds can overestimate or underestimate the information associated with a realized transcript, and repeated releases must be analyzed through the geometry/partitions they induce rather than transcript length alone.

Relevant background includes:

- Ming-Chuan Pan, *Actual Knowledge Gain as Privacy Loss in Local Privacy Accounting*, IEEE CSF 2025. The paper develops realized privacy loss and a Bayesian privacy filter for adaptive composition.
- Chen-Yu Zhang, Andrew Campbell, Anna Scaglione, Sean Peisert, *Reconstruction Limits for Repeated Differentially Private Aggregates: A Cramer-Rao Perspective on Query Geometry*, 2026. The paper emphasizes that repeated-query reconstruction depends on the identifiable directions introduced by release geometry, not just release count.
- Irit Dinur and Kobbi Nissim, *Revealing Information while Preserving Privacy*, PODS 2003, and subsequent reconstruction-attack literature.

Supakeep does **not** claim these information-theoretic ideas as novel. The research question is whether a provider-neutral personal-AI runtime can use a tractable form of realized, partition-aware accounting to safely expose useful private decisions.

## Mechanism

`PartitionAwareReconstructionFirewall` accepts a declared finite integer domain for a private field. It maintains the set of values still consistent with every answer Supakeep has released.

Before a predicate or bucket result is returned, the firewall computes the posterior feasible set induced by the actual result and measures:

`realized gain = log2(|feasible before| / |feasible after|)`

and cumulative knowledge from the original declared domain:

`total gain = log2(|domain| / |feasible after|)`

The result is denied before release if the posterior would exceed the configured knowledge budget or fall below a minimum candidate-set size.

The key property is semantic rather than syntactic accounting. Two differently written predicates that induce the same remaining feasible set add zero new realized knowledge. Conversely, a rare branch of a single binary predicate can be denied if it reveals too much at once.

## Falsification tests

The current experiment includes:

1. **Rare exact-match branch** — a `true` equality result over a one-million-value domain must be recognized as roughly 19.93 bits of realized knowledge and denied under an 8-bit limit.
2. **Harmless false guesses** — repeated false equality guesses should consume only the tiny amount of knowledge actually gained instead of one full bit each.
3. **Equivalent-query attack** — semantically identical partitions expressed with different operators should not reset or double-charge the posterior state.
4. **Adaptive balanced search** — a binary search should consume roughly one realized bit per balanced refinement and hit the same cumulative knowledge limit.
5. **Membership-set attack** — a `true` result for a tiny membership set must be priced according to the tiny posterior set, not merely as a boolean output.
6. **Persistence primitive** — feasible-set state can be snapshotted/restored so a restart need not reset reconstruction knowledge.

## What this does not prove

This is a finite-domain explicit-output experiment, not a universal privacy proof.

It currently does not solve:

- arbitrary continuous/high-dimensional private state
- multi-field `choose` programs
- priors other than the declared feasible-set model
- timing, crash, network or side-effect channels
- traffic that bypasses Supakeep
- compromised local hosts
- inference from external public data that was never represented in the declared domain

The next integration step, if the benchmark holds, is to attach encrypted domain metadata and partition state to Context Kernel records so the guard survives normal restarts and can enforce the rule before native MCP results leave the local runtime.
