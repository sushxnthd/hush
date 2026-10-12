# PCC mechanism prior-art audit

**Audit date:** 12 October 2026  
**Decision:** broad mechanism novelty **FAIL**; narrower system/evidence novelty **UNTESTED**.

## Question

Can Hush claim as novel the broad idea of computing a task-sufficient result
locally, disclosing a typed/scoped derivative instead of raw private context,
and budgeting cumulative inference across an agent trajectory?

## Primary-source comparison

| Work | Established mechanism | Overlap with PCC | Important difference |
|---|---|---|---|
| OCELOT (Xie and Li, submitted 10 June 2026) | Runtime posterior-risk control; witness-verified declassification; certified min-entropy charge; sink-weighted budget; tamper-evident trajectory ledger | Directly absorbs cumulative inference-budgeting and least-disclosing runtime authorization | OCELOT uses defender-produced witnesses and probabilistic/min-entropy accounting; current PCC uses application-authored bounded contracts and exact finite-domain partitions |
| MINIM (Yu et al., ICML 2026) | Trusted local broker minimizes UI observations before they leave the device using task necessity and sensitivity | Absorbs the broad local-before-remote minimization architecture | MINIM filters/abstracts UI elements; PCC can compute predicates and bounded choices without sending the underlying field |
| MNC (Xu et al., submitted 3 August 2026) | Typed semantic declassification from an application-authored candidate family, bound to recipient, purpose, forwarding, lifetime, logging and memory scopes; reference monitor plus history-aware inference accounting | Directly absorbs typed task-sufficient disclosure and downstream scope enforcement | PCC's tested implementation emphasizes exact finite-domain feasible-branch authorization, approval-bound releases, action execution and lifecycle-stable composition identity |
| Jeeves / policy-agnostic programming (Yang et al., POPL 2012; Austin et al., PLAS 2013) | Sensitive values carry policies/facets; runtime selects the permitted view for each observer | Absorbs policy-driven computation over private values with viewer-dependent release | Not specific to LLM agents, cumulative posterior budgets or Hush's connector/action workflow |
| Adaptive quantitative information flow (Alvim et al., 2015/2016) | Formal leakage analysis under generic leakage functions and adaptive adversaries | Absorbs the general principle that repeated adaptive releases must be analyzed compositionally | PCC is an implemented finite-domain runtime policy, not a new QIF foundation |
| AgentDAM (Zharmagambetov et al., NeurIPS 2025 D&B) | End-to-end benchmark for task-conditioned data minimization in web agents | Absorbs the evaluation objective that private information should be used only when task-necessary | It is primarily a benchmark/prompting defense, not PCC's local bounded-computation mechanism |

Primary sources:

- OCELOT: https://arxiv.org/abs/2606.12341
- MINIM: https://arxiv.org/abs/2606.13949
- MNC: https://arxiv.org/abs/2608.01719
- Jeeves publications: https://projects.csail.mit.edu/jeeves/papers.php
- Adaptive QIF: https://arxiv.org/abs/1507.05766
- AgentDAM: https://arxiv.org/abs/2503.09780

## Adversarial novelty verdict

The following claims are not defensible as Hush inventions:

1. compute locally before disclosing to a remote model;
2. release a task-sufficient derivative rather than raw context;
3. bind disclosure to recipient, purpose or sink;
4. keep a cumulative inference/privacy budget across repeated agent releases;
5. use a trusted monitor and auditable ledger to authorize declassification.

OCELOT and MNC are especially close and predate this audit. They jointly cover
most of the broad PCC mechanism story. MINIM, Jeeves and adaptive-QIF work make
the remaining components older still. The prior-art auditor therefore rejects
“PCC invents compute-before-disclose” and “PCC invents cumulative inference
control for agents.”

## Smallest defensible Hush position

Hush currently provides an independently engineered system instance with a
specific combination of:

- encrypted local context and connector ingestion;
- application-authored bounded integer contracts;
- exact finite-domain feasible-branch authorization before approval;
- persistent composition across releases, restarts and tested record/source-ID
  lifecycle changes;
- consent-bound one-shot releases, downstream action execution and receipts;
- an unusually explicit falsification chain covering posterior imbalance,
  metadata/control-flow oracles, selective refusal, diagnostic cardinality and
  privacy-identity resets.

This combination may still be a useful engineering and empirical contribution,
but this audit did not establish that no prior system combines it. The correct
classification is **UNTESTED distinct system contribution**, not a novel
privacy primitive or information-theory result.

## Consequence for scientific strategy

The next external study should not ask whether PCC merely beats raw context.
It must compare against the closest implementable mechanisms, especially an
OCELOT-style cumulative leakage budget and an MNC-style scoped semantic
declassifier, under the same external tasks, model, sinks and trace evaluator.
The prospective differentiator should be measurable: exact task success,
unnecessary disclosure, adaptive reconstruction, false denial, approval burden
and end-to-end action completion.

Until that matched comparison exists, HAA materials should emphasize research
rigor, independently checkable counterexamples and product execution—not claim
field-level novelty or superiority.

## Exact accounting discrimination update

An exhaustive preregistered finite-domain test now sharpens the matched-control
requirement. For uniform feasible states and deterministic binary releases,
PCC cardinality charge and realized posterior min-entropy reduction are
algebraically identical. Enumeration over 1,561,584 release cases and
37,478,016 weighted budget decisions found zero disagreements. This does not
reproduce OCELOT's calibrated per-operator upper bounds or MNC's scope monitor,
but it falsifies the uniform exact charge formula as a useful differentiator.

The smallest tested non-uniform prior `(0.9, 0.1)` separates cardinality charge
(`1.0` bit) from statewise min-entropy reduction (`0.152003` bits). The next
comparison should therefore concentrate on prior calibration, conservative
bounds, scope/lifetime enforcement, witness/candidate quality and end-to-end
failure behavior. See `MATCHED_CONTROL_EQUIVALENCE_RESULT.md`.

