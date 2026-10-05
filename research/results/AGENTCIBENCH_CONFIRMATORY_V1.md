# AgentCIBench confirmatory v1 — PASS

**Status:** **ALL 8 FROZEN SCIENTIFIC GATES PASSED**  
**Confirmatory cases:** 50  
**Frozen Hush evaluator:** `565e07e4ddfd2dd9f51ca69f0bcae2920d63878f`  
**Workflow commit:** `c12eefbf9534fd73cb20bf38391580ecfbc73478`  
**Pinned independent benchmark:** `UKPLab/emnlp2026-agentcibench@7b3fad424d0c5a450ac3bc3dc4050c38094c6dc6`  
**GitHub Actions run:** `37293495728`  
**Artifact ID:** `11337572386`  
**Artifact ZIP SHA-256:** `f722db10dc44c8ca167badd699a938d522f2086d87bd20e4207bf0f015a5e2dd`  
**Result JSON SHA-256:** `2152ed4584edbea67dd07e339dd5c7f380a1b8776e256b0f69a80d0f50948762`

## Result

The one-shot external holdout completed without a technical error. Hush passed every criterion frozen before confirmatory scoring.

| Arm | Mean completeness | Fully useful | Leak-free | Mean violation | Minimal success |
| --- | ---: | ---: | ---: | ---: | ---: |
| raw context | 0.9667 | 0.9400 | 0.0000 | 0.9510 | 0.0000 |
| semantic only | 0.9667 | 0.9400 | 0.0000 | 0.9410 | 0.0000 |
| lexical minimization | 0.9617 | 0.9200 | 0.0000 | 0.9410 | 0.0000 |
| **Hush CI** | **0.9507** | **0.9000** | **0.1200** | **0.7960** | **0.1000** |

Relative to the matched semantic-only retriever, Hush reduced mean exact protected-context violation from `0.9410` to `0.7960` (absolute reduction `0.1450`, relative reduction about `15.4%`) while mean must-share completeness changed from `0.9667` to `0.9507` (absolute decrease about `0.0160`).

The paired leak-free comparison contained **6 Hush-only wins and 0 semantic-only wins**, with a frozen two-sided exact sign/McNemar p-value of **0.03125**.

## Holdout composition

```text
task_ambiguity_overshare  25
recipient_misalignment    14
visual_co_location        11
```

Hush completeness by subgroup remained inside the preregistered 0.05 preservation margin:

| Failure mode | n | Hush completeness | Semantic completeness | Pass |
| --- | ---: | ---: | ---: | --- |
| recipient misalignment | 14 | 0.9571 | 1.0000 | yes |
| task ambiguity / overshare | 25 | 0.9320 | 0.9400 | yes |
| visual co-location | 11 | 0.9848 | 0.9848 | yes |

## Frozen gates

| Gate | Result |
| --- | --- |
| Hush mean completeness >= 0.90 | **PASS** |
| Hush fully-useful rate >= 0.75 | **PASS** |
| Hush leak-free rate > semantic-only | **PASS** |
| Hush mean violation < semantic-only | **PASS** |
| Hush minimal-success > semantic-only and lexical minimization | **PASS** |
| paired Hush-only > semantic-only-only and two-sided p < 0.05 | **PASS** |
| subgroup completeness preservation | **PASS** |
| gold-isolation integrity | **PASS** |

## Integrity / provenance

The workflow checked out the exact frozen evaluator SHA rather than the later workflow commit. Runtime provenance recorded:

```text
frozen_hush_sha=565e07e4ddfd2dd9f51ca69f0bcae2920d63878f
checked_out_hush_sha=565e07e4ddfd2dd9f51ca69f0bcae2920d63878f
agentcibench_sha=7b3fad424d0c5a450ac3bc3dc4050c38094c6dc6
Python 3.11.16
torch 2.5.1+cpu
transformers 4.46.3
safetensors 0.4.5
numpy 2.1.3
```

The evaluator removed `ground_truth` from a strict public projection before retrieval/ranking. Gold `must_share` and `must_not_share` values were retained separately and passed only to scoring after each arm had selected its context. The workflow recorded exit code `0` and emitted a checksummed machine-readable artifact.

## Scientific interpretation

This result supports the following narrow claim:

> **On the frozen AgentCIBench v1 contextual-integrity holdout, Hush's context boundary achieved a statistically significant reduction in exact protected-context exposure relative to the same semantic retriever without Hush's contextual-integrity guard while preserving preregistered task-context completeness.**

This is stronger evidence than the earlier synthetic-only results because the scenarios and privacy ground truth come from an independent public benchmark and the final 50-case evaluation was frozen before scoring.

It is **not** evidence that Hush has solved contextual privacy completely. Mean violation remains `0.7960`, so substantial protected-context exposure remains in this early local classifier. It is also not a direct head-to-head test against Charlie or every commercial competitor, and it is not independent reproduction of Hush by a third party.

## Research record

The earlier CultureBank holdout remains a positive but non-significant result (`9` Hush-only vs `2` baseline-only, `p=0.0654`). CIMemories v1 remains a technical abort because its public raw release contained no usable gold contextual-integrity labels. Neither result was rewritten or discarded after the fact.

The next scientific milestone is independent reproduction and/or a direct named-system comparison under the same frozen tasks, threat model, and utility/privacy metrics.
