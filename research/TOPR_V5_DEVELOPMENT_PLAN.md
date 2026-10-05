# Hush × TOP-R v5 Development Plan

Status: **data split frozen before opening TOP-R example files**.

## External source

- Repository: `1Ponder/TOP-R`
- Commit: `a4842a9ba3e515dff69c24ca7c5f87248a0bd807`

## Development-only files

These files are deliberately spent for mechanism development and must never be used as v5 confirmation:

- `TOP-Bench-v2/Trajectories.json`
  - Git blob SHA: `8674939f3988dc78744ca819279ba9102801e026`
  - 300 positive TOP-R examples per the upstream README.
- `TOP-Bench-v2/Negative_control.json`
  - Git blob SHA: `b67ea792c247847aba26f286a6a9ee3a84ad7230`
  - 300 negative-control examples per the upstream README.
- `TOP-Bench-v2/Social_Context_Trajectories.json`
  - Git blob SHA: `79e53853cc04a18dba9cd3390007e2fd51fc71a8`
  - optional diagnostics only; if opened it is development-only.

Development may inspect these records, tune mechanisms, and build deterministic adapters.

## Untouched confirmatory holdout

The following files are reserved and **must not be opened before a complete v5 protocol, exact mechanism, evaluator, thresholds, utility metric, and abort rules are committed and preflighted**:

- `TOP-Bench-v3/TOP-Bench-Eva_1000_part1.jsonl`
  - Git blob SHA: `b0ad7012a074bb017d03c063e93f8f291b70a039`
- `TOP-Bench-v3/TOP-Bench-Eva_1000_part2.jsonl`
  - Git blob SHA: `0384082e6b691aa934c95c26f00302cb01e6da7c`

Together these are the upstream 1,000-example TOP-Bench-v3 evaluation set. Tree metadata and README/schema documentation may be inspected; record content may not.

`TOP-Align-v1/TOP-Align-Eva_500.jsonl` is also left unopened and is not part of v5 unless a later preregistration explicitly uses it.

## Research question

Can a Hush runtime defense suppress **cross-tool composition leakage** while retaining task-relevant content, when no individual tool result alone is sufficient to reveal the private conclusion?

This is stricter than the previous PrivacyLens tests because TOP-R targets conclusions that emerge only when multiple tool outputs are combined.

## Development constraints

1. The runtime mechanism must not use `sensitive_conclusion`, `explicit_disclosure_criteria`, benchmark labels, privacy domain labels, or any other evaluator-only ground truth as an input to the Hush defense.
2. The runtime defense may use only information naturally available at execution time: the benign task/purpose, tool metadata, tool outputs already observed, channel/source identity, and the candidate outbound value.
3. Ground-truth fields may be used only by the offline evaluator to score privacy leakage.
4. Positive and negative-control v2 data must both influence development. A defense that suppresses positive examples by suppressing ordinary negative-control task content is not acceptable.
5. No TOP-Bench-v3 example content may be read during tuning.
6. If v5 later fails, the v3 holdout is spent and the failure stands.

## Comparator strategy

TOP-R's primary published baselines are prompt-level mitigations (TNM and CBD) and model-generation pipelines. Hush is a runtime egress layer, so development should first establish a deterministic intervention test that isolates the egress mechanism. If a faithful model-generation comparison can be run without paid APIs, it may be added as a secondary experiment, but it must not replace the preregistered deterministic test after the v3 holdout is opened.

## Immediate development objective

Use v2 positive + negative-control records to design a **purpose-bounded multi-source disclosure guard** that:

- identifies when an outbound proposition is jointly grounded in multiple protected tool results;
- distinguishes task-required synthesis from unrelated sensitive inference using the current user purpose;
- masks or withholds only the minimum high-information evidence needed to break the private inference;
- preserves ordinary negative-control/task-relevant output;
- remains deterministic, local, auditable, and benchmark-label blind at runtime.
