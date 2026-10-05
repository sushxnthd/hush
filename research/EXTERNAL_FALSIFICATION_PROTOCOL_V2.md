# Hush External Falsification Protocol v2

Status: preregistered before the first v2 benchmark run on this branch.

## Question

Does Hush's actual outbound-context sanitization survive externally originated privacy-leak workloads better than an external published sanitizer baseline **without winning only by destroying substantially more content**?

This protocol is intentionally designed to make Hush lose if its current privacy advantage is only the trivial consequence of masking everything.

## External corpus

The corpus is loaded from the public `yagobski/agentleak` repository at the immutable commit:

`d5267c79c8a4333a2a149ffed2ec62f1864932e5`

The following AgentLeak scenario packs are evaluated exactly as shipped at that commit:

| Pack | Count | Origin |
| --- | ---: | --- |
| `agentleak_bench` | 36 | AgentLeak / IEEE Access 2026 |
| `privacylens_ci` | 120 | PrivacyLens / NeurIPS 2024 Datasets & Benchmarks |
| `agentdojo_exfil` | 100 | AgentDojo / NeurIPS 2024 Datasets & Benchmarks |
| **Total** | **256** | external to Hush |

The benchmark uses AgentLeak's own `AgentLeakRunner`, trace model, detectors, canary ground truth and privacy score. Hush does not reimplement AgentLeak's scoring.

## Threat surface

Only disclosure channels are transformed:

- `final_output`
- `inter_agent_message`
- `shared_memory`
- `tool_call`
- `log`
- `generated_file`

Source channels (`user_input`, `tool_response`) remain unchanged so the defense is not credited for deleting the input evidence.

## Arms

1. **baseline** — original external trace, unchanged.
2. **AgentLeak sanitizer** — AgentLeak's published `Sanitizer(style="placeholder")` recursively applied to the same disclosure channels.
3. **Hush pseudonymous** — Hush `sanitizeContextValue(..., mode="pseudonymous")` applied to the same disclosure channels.
4. **Hush strict** — Hush `sanitizeContextValue(..., mode="strict")` applied to the same disclosure channels.

The Hush arms call the JavaScript implementation from this repository; the Python harness does not duplicate Hush's sanitization logic.

## Ground truth

For scenarios that ship canaries, the exact upstream canary set is passed to AgentLeak's analyzer. No canary is added, removed, rewritten or selected after observing results.

## Primary endpoint

**Leak-free rate:** fraction of scenarios for which AgentLeak reports zero leaked secrets after the defense transformation.

## Secondary endpoints

- mean and median AgentLeak privacy score;
- total leaked-secret count;
- per-pack leak-free rate;
- disclosure-content preservation, measured as a byte-weighted `difflib.SequenceMatcher` similarity between the original and transformed disclosure payloads;
- paired scenario-level privacy-score wins/losses versus the AgentLeak sanitizer baseline;
- exact two-sided sign-test p-value over non-tied paired privacy-score comparisons.

The content-preservation metric is a proxy, **not task success**. This protocol therefore cannot support a broad end-to-end utility-superiority claim.

## Pre-specified gates

A v2 **external privacy-superiority** claim over the AgentLeak sanitizer baseline is allowed only if all of the following hold:

1. corpus integrity passes: exactly 36/120/100 scenarios are loaded from the pinned packs;
2. at least 95% of the unmodified external scenarios register at least one leak under canary-aware AgentLeak scoring;
3. Hush strict has a strictly higher leak-free rate than the AgentLeak sanitizer arm;
4. among non-tied scenario-level privacy scores, Hush strict has more wins than losses with two-sided exact sign-test `p < 0.01`;
5. Hush strict's mean disclosure-content preservation is at least **80% of** the AgentLeak sanitizer arm's preservation;
6. Hush strict does not reduce any pack's leak-free rate relative to the AgentLeak sanitizer arm.

If any gate fails, the correct conclusion is that v2 did **not** establish external superiority. The failure is kept and used to identify the mechanism that must improve; the corpus is not altered to rescue the claim.

## Interpretation boundary

Even a full v2 pass would establish only superiority to the **AgentLeak sanitizer arm under these fixed external traces and metrics**. It would not establish:

- direct superiority to Charlie;
- direct superiority to AgentDojo's strongest end-to-end defenses;
- direct superiority to OCELOT;
- end-to-end agent task utility superiority;
- protection against timing, side channels, compromised hosts or undisclosed data sources;
- independent reproduction.

Those require separate same-workload integrations and independent execution by a party that did not build Hush.

## Reproducibility

The v2 workflow must record:

- Hush commit SHA;
- AgentLeak pinned commit;
- Python and Node versions;
- pack counts;
- full machine-readable result JSON;
- SHA-256 of the result JSON.

Mechanical benchmark failures fail the workflow. A scientific gate failure is recorded as a result rather than hidden or converted into a CI error.
