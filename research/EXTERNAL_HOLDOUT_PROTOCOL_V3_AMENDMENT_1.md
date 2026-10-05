# Hush External Holdout Protocol v3 — Amendment 1

Status: **pre-holdout amendment**.

This amendment was made before the 373-record PrivacyLens confirmatory holdout was downloaded, loaded, transformed, or scored by the Hush v3 harness.

## Why an amendment was necessary

The original v3 protocol froze `(5 contiguous tokens, 18 characters)` after a post-hoc sweep summarized across all three opened v2 packs. Before accessing the v3 holdout, the development-selection code was corrected to use only the **120-record PrivacyLens development subset**, because v3's confirmatory population is the remaining PrivacyLens records and the preregistered preservation floor is comparator-relative on that population.

No holdout result informed this amendment.

On the already-opened 120-record PrivacyLens development subset, AgentLeak's placeholder sanitizer had:

- leak-free rate: **17.500%**;
- mean disclosure-content preservation: **0.9495**;
- corresponding 80% preservation floor: **0.7596**.

The six pre-existing post-hoc guard configurations produced:

| configuration | leak-free | preservation | Hush-only / AgentLeak-only leak-free | exact two-sided p |
| --- | ---: | ---: | ---: | ---: |
| 4 tokens / 18 chars | 40.833% | 0.6839 | 46 / 18 | 0.000617 |
| 5 / 18 | 34.167% | 0.7145 | 39 / 19 | 0.011928 |
| 5 / 24 | 33.333% | 0.7151 | 38 / 19 | 0.016348 |
| 6 / 18 | 24.167% | 0.7393 | 29 / 21 | 0.322236 |
| 6 / 24 | 24.167% | 0.7393 | 29 / 21 | 0.322236 |
| **7 / 24** | **21.667%** | **0.7681** | **26 / 21** | **0.560065** |

The first five configurations fail the PrivacyLens-specific preregistered preservation floor. `7 / 24` is the only swept configuration that both:

1. exceeds the AgentLeak sanitizer's PrivacyLens-development leak-free rate; and
2. satisfies the PrivacyLens-specific 80% preservation floor.

Accordingly, the v3 mechanism is amended and frozen to:

- sanitization mode: `pseudonymous`;
- minimum copied sequence: **7 contiguous tokens**;
- minimum copied sequence span: **24 characters**;
- protected source channel: `tool_response`;
- disclosure channels unchanged from the original v3 protocol.

## Superseded text

Where `EXTERNAL_HOLDOUT_PROTOCOL_V3.md` states `5 contiguous tokens / 18 characters`, this amendment supersedes it with **7 contiguous tokens / 24 characters**.

All other v3 endpoints, comparator definitions, statistical tests, subgroup rules, pass/fail gates, failure policy, and claim boundaries remain unchanged.

## Freeze rule

After this amendment, **no threshold, mechanism, comparator, endpoint, subgroup rule, or pass/fail criterion may be changed in response to the 373-record holdout result**. If v3 fails, that holdout is spent and a subsequent mechanism revision must use a different untouched external benchmark for confirmatory evaluation.
