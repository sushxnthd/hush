# Partition-aware privacy experiment

## Why this experiment exists

A private-decision runtime can bound the *number of possible outputs* of a program and still badly mischaracterize how much the answer that actually occurred reveals.

A binary predicate has only two possible outputs, yet a rare branch can collapse a very large private domain to a tiny posterior set. For a uniformly modeled integer secret in `0..999999`, the predicate `secret == 734219` has output cardinality two, but a `true` answer collapses one million feasible values to one. The realized knowledge gain of that branch is:

`log2(1,000,000 / 1) ≈ 19.93 bits`

not one bit.

This is a known distinction in privacy accounting and quantitative information flow: global/nominal privacy bounds and realized transcript information are different objects, and repeated releases must be analyzed through the geometry or partitions they induce rather than release count alone.

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

The result is denied **before release** if the posterior would exceed the configured knowledge budget or fall below a minimum candidate-set size.

The key property is semantic rather than syntactic accounting. Two differently written predicates that induce the same remaining feasible set add zero new realized knowledge. Conversely, a rare branch of a single binary predicate can be denied if it reveals too much at once.

## Experimental results

For the `0..999999` synthetic secret domain:

| Test | Result |
|---|---:|
| Cardinality-only price of exact-match query | 1 nominal bit |
| Realized knowledge of the `true` exact-match branch | **19.931569 bits** |
| Partition-aware exact-match decision | **DENY before release** |
| False equality probes released | **1,000** |
| Realized knowledge from those false probes | **0.001443 bits** |
| Balanced refinements released | **8** |
| Next balanced refinement | **DENY at query 9** |
| Candidates remaining | **3,906** |

This matters because the stronger guard is not simply more restrictive. It can permit many low-information answers while blocking a single rare high-information answer.

## Falsification tests

The current suite exercises:

1. **Rare exact-match branch** — a `true` equality result over a one-million-value domain is recognized as roughly 19.93 bits of realized knowledge and denied under an 8-bit limit.
2. **Harmless false guesses** — repeated false equality guesses consume only the tiny amount of knowledge actually gained instead of one full bit each.
3. **Equivalent-query attack** — semantically identical partitions expressed with different operators do not reset or double-charge the posterior state.
4. **Adaptive balanced search** — binary refinement consumes the measured posterior shrinkage and hits the cumulative knowledge limit.
5. **Membership-set attack** — a `true` result for a tiny membership set is priced according to the tiny posterior set, not merely as a boolean output.
6. **Encrypted persistence** — feasible-state accounting and finite-domain metadata survive a Context Kernel restart without appearing as readable metadata in the persisted bundle.
7. **Native MCP release boundary** — a result that violates the partition limit is denied before the result is returned to the AI client.
8. **Adjacent fail-closed checks** — prototype-like private paths are rejected and malformed task TTLs cannot become non-expiring trajectories.

## Integration status

The experiment is integrated into the v0.7 private-decision path for declared finite integer domains:

- domain metadata is stored inside encrypted Context Kernel records;
- posterior partition state is stored in encrypted kernel state;
- state survives local-process restart;
- predicate and bucket results are evaluated locally before release;
- allowed results are charged by realized posterior shrinkage;
- forbidden results are not included in the returned private-decision/MCP result;
- local API callers can declare the finite domain when adding context;
- exposure endpoints return partition summaries without returning the private value or full private domain metadata.

Fields without a declared finite domain retain the existing output-cardinality and persistent reconstruction accounting behavior.

## What this does not prove

This is a finite-domain explicit-output experiment, not a universal privacy proof.

It currently does not solve:

- arbitrary continuous or high-dimensional private state;
- **joint leakage from multi-field `choose` programs**;
- priors other than the declared feasible-set model;
- timing, crash, network or side-effect channels;
- traffic that bypasses Supakeep;
- compromised local hosts;
- inference from external public data that was never represented in the declared domain.

## Next research target

The most important next attack is **joint posterior leakage from `choose`**.

A selected public candidate can simultaneously reveal constraints on several private fields. For example, returning one flight from a public list may jointly narrow budget, airline preference, departure-time preference and calendar constraints even though the explicit output is only a candidate ID.

The next experiment should construct an adversarial candidate-set generator that chooses candidate tables specifically to maximize posterior shrinkage over a multi-field private profile. The defense should then estimate or bound the joint posterior induced by the selected candidate before release, rather than treating `choose` only as `log2(number of candidates + 1)`.

That is the next falsification target; it is not yet solved by v0.7.
