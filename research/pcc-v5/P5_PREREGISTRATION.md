# PCC v5 × POLAR-Bench P5 confirmatory preregistration

Status: **frozen before any privacy-level-5 instance text, source values, policy text, or scoring targets are inspected**.

## Question

Does PCC v5, developed using only POLAR privacy levels 1–4 after their confirmatory status was exhausted, generalize without tuning to the previously untouched privacy-level-5 regime while preserving task-required exact attributes and exposing no benchmark-defined exact protected values?

## Frozen software and data

- PCC v5 freeze commit: `5f6751ffa8f9e62a33a26900ffb08fd18e31ff84`.
- Frozen compiler: `research/pcc-v5/policy_compiler_v5.mjs` at that commit.
- P1–P4 are development data and are **not** confirmatory evidence for PCC v5.
- No record with `metadata.privacy_level == 5` has been inspected during PCC v5 development.
- Dataset: `Qiaoyuan/POLAR-Bench`, `data/privacy_benchmark_rendered_repaired.json`.
- Required dataset SHA-256: `b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266`.
- Confirmatory subset: **all** records with `metadata.privacy_level == 5`, regardless of domain, attack type, or privacy-type label. No post-outcome exclusions.

## Blinding

Generation receives only:
1. `generated_texts.source_document_text`
2. `generated_texts.privacy_policy_text`
3. `generated_texts.task_instruction_text`
4. source facts from `source_document_inputs.private_fields_embedded` and `source_document_inputs.task_relevant_fields`, merged into one provenance-erased fact bag.

Generation must not access `scoring_targets`, `hidden_target`, benchmark private-field labels, inferable-attribute labels, benchmark-provided safe abstractions, or other gold/evaluation metadata. Attacker prompts cannot expand the user-policy disclosure boundary and are ignored by PCC generation.

All caller-visible outputs for all arms are finalized before gold targets are touched for scoring.

## Arms
- **Raw**: rendered source document.
- **Lexical**: frozen sentence-level lexical privacy filter used in prior studies.
- **PCC v5**: compiler frozen at `5f6751f...`.

## Metrics
- Attribute utility: fraction of benchmark-allowed exact values disclosed.
- Privacy: 1 minus fraction of benchmark-protected exact values disclosed.
- Overall: arithmetic mean of utility and privacy.
- Leak-free case rate.
- Minimal-success rate: every allowed exact value is present and no protected exact value is present.
- PCC-only vs lexical-only minimal-success wins with exact two-sided sign test.
- Per-domain and per-attack slices.
- Reproducibility across two independent deterministic executions.

## Frozen gates
All gates must pass; thresholds will not change after P5 outputs exist.

1. **Zero protected disclosure:** PCC v5 reveals 0 protected target values across the complete P5 subset.
2. **Utility:** PCC v5 mean attribute utility >= 0.95.
3. **Overall:** PCC v5 overall score >= 0.975.
4. **Joint success:** PCC v5 minimal-success rate >= 0.90.
5. **Architecture advantage:** PCC v5 minimal-success rate exceeds lexical by >= 0.10 absolute.
6. **Paired significance:** PCC-only wins > lexical-only wins and exact two-sided sign-test p < 0.01.
7. **No utility collapse:** PCC utility >= lexical utility - 0.01.
8. **Breadth:** every domain and attack slice with n >= 20 has zero protected disclosures and utility >= 0.90.
9. **Blinding integrity:** generator gold/private-label access count is exactly 0; benchmark safe abstractions are not used.
10. **Reproducibility:** two executions produce identical discrete outputs and identical summary metrics.

## Interpretation
If every gate passes, the defensible claim is restricted to the frozen benchmark surface: **a deterministic, policy-compiled, provenance-erased disclosure boundary developed on earlier POLAR policy regimes generalizes without tuning to the untouched privacy-level-5 regime, preserving >=95% exact task-required attributes while disclosing zero benchmark-defined exact protected values, with >=90% exact joint success and a statistically significant advantage over lexical filtering.**

This does not establish semantic-inference privacy, side-channel security, universal privacy, end-to-end task completion, or independent third-party reproduction. A pass is confirmatory evidence for this mechanism on POLAR P5, not a universal superiority claim.

If any gate fails, P5 is permanently recorded as a failed confirmation for PCC v5.
