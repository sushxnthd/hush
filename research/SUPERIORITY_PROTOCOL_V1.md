# Hush Scientific Superiority Protocol v1

**Status:** preregistered internal protocol for reproducible evaluation.  
**Date:** 2026-10-05  
**Primary executable:** `bench/scientific-superiority.js`

## Claim boundary

This protocol is designed to establish a narrow, falsifiable result:

> For bounded personalization tasks expressible by Hush Private Decision Programs, Hush should preserve the decision utility of full raw-context personalization while exposing no exact private input values to the model-visible result channel, and its persistent reconstruction defenses should prevent adaptive exact recovery attacks that succeed against an otherwise identical unprotected query interface.

A passing result **does not** prove that Hush is universally private, does not prove superiority over every competitor product, and is not a direct head-to-head measurement of Charlie, OCELOT, 1Password, Permit, Arcade, or other systems unless those systems are actually instrumented under the same workloads.

## Motivation and related evaluation practice

The benchmark design follows three lessons from the privacy literature and recent agent-security work:

1. **Data minimization should be evaluated jointly with utility.** Zhou, Mireshghallah and Li's *Operationalizing Data Minimization for Privacy-Preserving LLM Prompting* (ICLR 2026) frames minimization as the least revealing transformation that maintains task utility: https://arxiv.org/abs/2510.03662
2. **Query-based privacy systems need adaptive attack discovery/evaluation rather than only nominal per-query checks.** QueryCheetah (ACM CCS 2024) demonstrates that query interfaces can contain inference attacks missed by ad-hoc defenses: https://arxiv.org/abs/2409.01992
3. **Agent privacy is cumulative across trajectories and sinks.** OCELOT (2026) explicitly evaluates cumulative inference budgets, sink collusion and privacy–utility frontiers: https://arxiv.org/abs/2606.12341

Hush differs from semantic declassification systems in one important restricted regime: a Private Decision Program has an explicit finite output space before execution. For that explicit channel, standard information theory gives `I(S;Y) <= H(Y) <= log2 |Omega|` independent of the language model. This is a standard entropy bound, not a new theorem. Hush's research question is whether exploiting that restricted contract yields a better privacy–utility point for tasks that fit the contract.

## Experiment A — privacy/utility frontier on bounded personalization

### Task families

Four task families are generated independently across 20 deterministic seeds, 50 profiles per seed per family:

- travel selection;
- shopping selection;
- scheduling selection;
- job selection.

Total: **4,000 paired tasks**.

Each task contains two private attributes and twelve public candidates. The task's exact oracle uses the same deterministic constraints and preference objective as the Hush program.

### Compared systems

**Raw context.** The decision function receives all exact private fields referenced by the task.

**Governed retrieval.** The decision function receives only the exact private fields referenced by the task. This represents a strong least-fields retrieval baseline rather than an intentionally weak all-profile baseline.

**Coarse minimization.** The categorical preference remains exact while the numeric field is quantized at a task-specific coarse granularity before decision making. This is a deterministic minimization baseline; it is not claimed to reproduce Charlie or any named system.

**Hush.** Exact private attributes remain local. The public candidate set and bounded decision program are evaluated through `PrivateDecisionRuntime`; the caller receives the bounded result and accounting metadata, not the private values or paths.

### Primary utility endpoint

Exact agreement with the raw-context oracle.

### Primary privacy endpoint

Mean number of **exact private input attributes revealed to the decision caller per task**. In addition, the Hush result wire representation is scanned for seeded private string markers and private field paths.

This endpoint is intentionally concrete. It is not equivalent to total mutual information and does not measure timing, traffic analysis or side channels.

### Statistical test

For Hush vs coarse minimization, tasks are paired. The benchmark reports discordant pairs and the exact one-sided sign/binomial probability for the case where every discordant pair favors Hush.

Utility proportions receive Wilson 95% confidence intervals.

## Experiment B — adaptive reconstruction

A uniformly generated 16-bit integer secret lies in `0..65535`. An adaptive binary-search adversary attempts exact reconstruction using predicate queries.

The attack deliberately varies:

- predicate syntax among equivalent `lte`, `lt`, `gt`, and `gte` formulations;
- agent identity;
- sink identity;
- purpose string;
- a fresh trajectory for every query.

Two protected stress conditions are evaluated:

1. **identity/sink rotation:** private state is stable while caller metadata and predicate syntax rotate;
2. **revision-reset attempt:** before each query, the same secret is rewritten as a fresh profile revision to test whether profile revision changes reset the persistent defense.

Each condition uses **512 independent secrets**.

The unprotected baseline uses the same `PrivateDecisionRuntime` program semantics with reconstruction, partition and joint firewalls disabled.

### Primary endpoint

Exact secret recovery rate.

Secondary endpoints:

- number of answers released before denial;
- candidates remaining when the protected run stops.

## Pre-specified superiority gates

The executable returns failure unless all gates pass:

1. **Utility equivalence:** lower bound of the Hush 95% Wilson interval is at least `99.5%` oracle agreement.
2. **Zero exact private inputs:** Hush exposes `0` exact private input attributes/task and `0` seeded wire/path markers.
3. **Coarse minimization utility superiority:** Hush accuracy is higher, no discordant pair favors coarse minimization, and one-sided paired `p < 0.001`.
4. **Raw-context privacy dominance:** Hush has identical utility to raw context with strictly lower exact-private-input exposure.
5. **Governed-retrieval privacy dominance:** Hush has identical utility to governed retrieval with strictly lower exact-private-input exposure.
6. **Unprotected reconstruction succeeds:** lower 95% confidence bound for exact recovery is at least `99%`.
7. **Identity/sink rotation resisted:** upper 95% confidence bound for Hush exact recovery is at most `1%`.
8. **Revision-reset attack resisted:** upper 95% confidence bound for Hush exact recovery is at most `1%`.

These thresholds are intentionally hard CI gates rather than descriptive claims.

## Threats to validity

A passing result remains limited by the following:

- the utility tasks are synthetic and exactly representable by Hush's decision language;
- utility is exact candidate-selection agreement, not open-ended answer quality;
- the coarse baseline is an abstract minimization baseline, not a specific commercial product;
- the reconstruction adversary is an adaptive threshold attacker, not an exhaustive search over all possible program encodings;
- no timing, cache, crash, process-memory or network side channels are measured;
- no compromised local Hush process is assumed;
- no independent third party has reproduced the results yet.

## What is required before using the phrase “scientifically proven superior to competitors”

The internal v1 protocol is only the first stage. A defensible direct competitor claim requires all of the following:

1. run Hush and each named comparator on the **same externally-originated benchmark** under the same threat model;
2. use at least one benchmark not designed by Hush, such as AgentLeak/AgentDojo/ConfAIde where technically applicable;
3. publish exact versions/configurations and all failures;
4. preregister endpoints and analysis before running the final comparison;
5. use paired statistical tests and confidence intervals;
6. obtain independent reproduction or external review.

Until those conditions are satisfied, repository language must say **“reproducibly superior to the implemented baselines under Protocol v1”**, not “proven better than Charlie/OCELOT/etc.”
