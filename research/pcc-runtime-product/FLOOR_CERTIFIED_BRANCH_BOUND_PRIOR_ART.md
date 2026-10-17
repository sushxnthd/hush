# Floor-certified branch bound and HUSH cumulative-budget priority audit

**Audit date:** 2026-10-16  
**Status:** exact formula not located verbatim; HUSH's broad cumulative-budget system kernel has a decisive prior-art collision  
**Decision:** narrow the theorem claim and make OCELOT a mandatory strongest-system baseline

## Search targets

1. The exact per-realized-branch law

[
log_2!left(rac{n-k+1}{1+(k-1)(n-k)lambda}ight)
]

for the identity-guessing realized min-entropy charge

[
L(p,B)=max!left(0,log_2rac{max_{iin B}p_i}
{max_i p_i,P(B)}ight)
]

over priors satisfying (p_igelambda).

2. The broader HUSH kernel: cumulative inference-risk budgeting for adaptive LLM/tool trajectories, semantic disclosure control, deterministic authorization, and auditable accounting.

## Decisive system-level collision

**Xie and Li, “OCELOT: Inference-Leakage Budgets for Privacy-Preserving LLM Agents,” arXiv:2606.12341, 10 June 2026** directly targets the broader kernel.

Primary source: https://arxiv.org/abs/2606.12341  
Full text: https://arxiv.org/html/2606.12341v1

OCELOT:

- frames LLM-agent privacy as a trajectory-level rather than per-release property;
- budgets cumulative posterior/min-entropy risk across adaptive interactions and colluding sinks;
- selects semantic-granularity declassification variants rather than only allowing or denying;
- separates an untrusted semantic proposer from a deterministic verifier;
- records decisions in a tamper-evident ledger;
- evaluates injection, jailbreak, cumulative inference, and sink collusion;
- explicitly states that its deductive guarantee is budget arithmetic while semantic cost soundness remains model-relative.

This is not an adjacent analogy. It absorbs a broad novelty claim that HUSH is the first runtime system to combine cumulative inference budgets, semantic release variants, deterministic verification, and auditable trajectory accounting.

OCELOT is currently a preprint, not evidence that every empirical claim is correct. It is nevertheless prior art for system concept and claimed mechanism as of 10 June 2026.

## Measure-level relation

### Established pointwise leakage

Saeidian et al., **“Pointwise Maximal Leakage,” IEEE Transactions on Information Theory 69(12), 2023**, introduced a per-observed-output leakage random variable and proved

[
ell(X	o y)=
logmax_xrac{P_{Xmid Y=y}(x)}{P_X(x)}.
]

DOI: https://doi.org/10.1109/TIT.2023.3304378  
Primary manuscript: https://arxiv.org/abs/2205.04935

For a deterministic branch (B), pointwise maximal leakage reduces to (log(1/P(B))). It protects arbitrary randomized attributes/gain functions and is therefore broader than HUSH's identity-guessing charge.

### HUSH's scoped metric

HUSH's charge instead measures the realized increase in the best probability of guessing the exact secret:

[
lograc{max_{iin B}p_i/P(B)}{max_i p_i}.
]

This can be strictly smaller than pointwise maximal leakage when the prior mode lies outside (B). The floor-certified extremal formula is therefore **not** the same theorem as the PML formula.

OCELOT uses the same realized exact-secret MAP/min-entropy advantage at system level (its per-instance Eq. 4), although its costs are empirically calibrated by operator rather than derived from HUSH's deterministic finite-branch floor constraint.

## Closest foundational literature

- Geoffrey Smith, *On the Foundations of Quantitative Information Flow*, FoSSaCS 2009: https://doi.org/10.1007/978-3-642-00596-1_21
- Alvim et al., *Measuring Information Leakage Using Generalized Gain Functions*, IEEE CSF 2012: https://www.dcc.ufmg.br/~msalvim/publications/2012-CSF.pdf
- Chatzikokolakis et al., *A Precise Information Flow Measure from Imprecise Probabilities* (2012): https://arxiv.org/abs/1206.5487
- Alvim et al., *The Science of Quantitative Information Flow* (2020): https://doi.org/10.1007/978-3-319-96131-6
- Saeidian et al., *Pointwise Maximal Leakage* (2023): https://doi.org/10.1109/TIT.2023.3304378
- Xie and Li, *OCELOT* (2026): https://arxiv.org/abs/2606.12341

These absorb broad novelty for Bayes vulnerability, min-entropy leakage, gain-based leakage, imprecise/credal priors, per-outcome leakage, and trajectory-level LLM-agent inference budgeting.

## Collision matrix

| HUSH component | Priority result | Status |
|---|---|---|
| Per-outcome privacy/leakage rather than only channel average | Pointwise maximal leakage | **ABSORBED** |
| Exact-secret realized MAP/min-entropy advantage | Standard Bayes-vulnerability specialization; used by OCELOT | **ABSORBED AS A MEASURE** |
| Cumulative inference budget for adaptive LLM-agent trajectories | OCELOT | **ABSORBED** |
| Semantic-granularity disclosure variants plus deterministic verifier and ledger | OCELOT WVD | **ABSORBED** |
| Exact trace-envelope minimality for a declared finite prior ensemble | No exact collision located in this audit | **SCOPED CANDIDATE; PRIORITY UNRESOLVED** |
| Prior-free deterministic-branch bound (log_2(n-k+1)) | No exact collision located | **SCOPED CANDIDATE; PRIORITY UNRESOLVED** |
| Floor-certified deterministic-branch formula | No exact collision located | **SCOPED CANDIDATE; PRIORITY UNRESOLVED** |
| Compute-before-disclose PCC workflows visible at provider boundary | Mechanistically different from semantic declassification | **REMAINS PRODUCT FOOTHOLD** |

Absence of an exact-formula collision is not proof of novelty. The closed form may be an elementary robust-optimization consequence inside established pointwise Bayes leakage.

## SCIENCE ledger update

### KNOWN

- The floor-certified formula is exact for HUSH's stated metric and constraints.
- It is not equivalent to PML; PML is a stronger arbitrary-gain pointwise measure.
- OCELOT independently establishes the same broad problem framing and a closely matching cumulative-budgeted runtime architecture.

### FALSIFIED

- **Falsified positioning:** cumulative inference-risk budgeting for LLM-agent trajectories is, by itself, a new HUSH system mechanism.
- **Falsified positioning:** semantic declassification plus deterministic verification and an auditable leakage ledger can serve as HUSH's novelty claim without comparison to OCELOT.

### BELIEVED

- HUSH's exact finite-branch accountants may provide more deductive, assumption-explicit costs than OCELOT's empirically calibrated per-operator costs.
- PCC's compute-before-disclose path may offer a qualitatively different advantage: complete useful tasks without transmitting underlying context rather than choosing a less-disclosing semantic variant.

### CONFLICTING / UNTESTED

- Whether the three exact extremal laws are historically new.
- Whether their tighter deductive accounting improves end-to-end utility against a faithful OCELOT/WVD baseline.
- Whether externally certified floors or ensembles exist for real HUSH workflows.
- Whether exact branch accounting remains safe under semantic equivalence, paraphrase, repeated queries, and prior shift.

## CONSEQUENCE ledger update

1. **Do not claim** that HUSH originated trajectory-level inference budgeting, posterior-risk mediation, semantic declassification, or deterministic verified leakage ledgers.
2. **Require OCELOT/WVD as the strongest system baseline** in all future cumulative-budget evaluations.
3. **Demote the floor formula from standalone flagship status.** It remains a theorem and runtime feature, but cannot carry HUSH's broad novelty claim without a demonstrated consequence.
4. **Reformulate the active HUSH kernel**:

   > Can compiler-derived compute-before-disclose plus exact, provenance-conditional branch accounting give a deductive safety/utility advantage over OCELOT-style empirically calibrated semantic declassification under adaptive repeated queries and prior shift?

5. The cheapest decisive experiment is a frozen end-to-end comparison on a fresh task/prior family:
   - raw-context release;
   - static permission denial;
   - OCELOT-style least-disclosing semantic variants with calibrated costs;
   - PCC compute-before-disclose with exact ensemble/floor/prior-free fallback;
   - adaptive repeated-query and semantic-inference adversaries;
   - metrics at the actual model/tool/provider boundary: task success, disclosed information, realized MAP/PML, budget exceedance, latency, and abstention.

## Smallest supported claim

> HUSH has exact, independently verified extremal accountants for a particular realized exact-secret guessing metric under explicit finite-prior contracts. The broad runtime concept of cumulative inference budgeting and verified semantic declassification for LLM agents is prior art. HUSH's unresolved contribution is whether compiler-derived compute-before-disclose and exact provenance-conditional costs yield a reproducible advantage over that prior art.

## Gate

- **Broad HUSH cumulative-budget mechanism novelty:** **FAIL**
- **Exact floor-certified formula correctness:** **PASS**
- **Historical priority of the exact formula:** **INCONCLUSIVE**
- **Distinct end-to-end PCC advantage over OCELOT:** **UNTESTED**

This is a claim reduction and control upgrade, not a finding that HUSH lacks product value.
