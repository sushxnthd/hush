# AgentCIBench context-boundary development v1e → v1f

**Status:** development result only. No new confirmatory claim is made from this experiment.

## Why this line exists

The first frozen AgentCIBench confirmatory result showed a statistically significant privacy improvement, but mean protected-context violation remained high. This development line tests whether the retrieval boundary can improve by retaining local-only source lineage while releasing only minimal values.

The original 50-case confirmatory set is never used for tuning here; its scenario IDs are excluded from development selection.

## v1e — useful failure

v1e introduced four ideas at once:

- local-only lineage metadata for candidate ranking;
- recipient-mismatch penalties/gating;
- purpose/domain-mismatch penalties/gating;
- an adaptive relevance frontier that pruned the low-score tail.

The privacy effect was large, but utility collapsed. Representative v1e configuration `ctx24_r50_g55_c45_f22` produced approximately:

- Hush mean completeness: **0.625**;
- Hush fully-useful rate: **0.567**;
- Hush leak-free rate: **0.433**;
- Hush mean violation: **0.374**.

The matched semantic-only arm had approximately 0.913 completeness and 0.859 mean violation. The result is preserved as a branch kill rather than presented as a success: the frontier removed too much required context.

## v1f — ablation

v1f separated lineage representation, context penalties, hard context gating, and frontier pruning.

The main finding was unexpectedly simple: **lineage-aware representation without the aggressive frontier was sufficient to recover utility and retain a significant privacy advantage.** Extra recipient/purpose penalties did not improve the selected development output relative to lineage representation alone on this pool.

Selected development variant: `lineage_generic`.

Across **67 development scenarios**:

| Metric | Hush lineage-aware | Semantic-only |
| --- | ---: | ---: |
| mean completeness | **0.9701** | 0.9754 |
| fully-useful rate | **0.8955** | 0.9254 |
| leak-free rate | **0.1045** | 0.0000 |
| mean protected-context violation | **0.7712** | 0.9226 |
| minimal-success rate | **0.1045** | 0.0000 |

Paired leak-free outcomes: **7 Hush-only vs 0 semantic-only-only**, two-sided exact p = **0.015625**.

Subgroup completeness stayed within the existing 0.05 preservation margin for every subgroup with at least 10 cases. Recipient-misalignment cases showed mean violation 0.6248 for Hush vs 0.9067 semantic-only; task-ambiguity/overshare showed 0.8113 vs 0.9417. The visual-co-location subgroup had only 7 development cases and is retained descriptively rather than treated as a powered subgroup gate.

## Interpretation

This result identifies a mechanism worth freezing: **context lineage should influence representation/retrieval before disclosure, without forcing the model-facing value to carry that lineage.** In this development pool, the improvement came from giving the local selector better provenance context rather than from increasingly aggressive output pruning.

It does **not** establish a new external breakthrough because the mechanism was selected on development data. A fresh external/untouched benchmark or holdout must be frozen before final scoring.

## Next external validation

1. Freeze the lineage-aware mechanism before a new final evaluation.
2. Do not reuse the already-consumed AgentCIBench 50-case confirmatory set as a new confirmation.
3. Add semantic/paraphrase leakage scoring, not exact-value overlap alone.
4. Validate on an independent privacy benchmark where possible, with AgentDAM and AgentLeak as current candidates for data-minimization and multi-agent/internal-channel claims.
5. Preserve all negative and technically aborted runs.
