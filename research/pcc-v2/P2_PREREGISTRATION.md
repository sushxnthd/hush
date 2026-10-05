# PCC v2 × POLAR-Bench P2 confirmatory preregistration

Status: **frozen before P2 instance evaluation**.

## Question

Does the PCC v2 policy compiler, developed only against POLAR P1 explicit-field cases plus the benchmark authors' public description of P2 semantic protection, generalize to untouched P2 semantic-constraint instances while preserving task-required attribute utility and preventing exact protected-value disclosure?

## Frozen software and data

- Hush/PCC v2 branch base: `dd8f7e4aa1c307c6cf81512e7eb212f0ba003d31`.
- Policy compiler: `research/pcc-v2/policy_compiler_v2.mjs` as present at that commit.
- No P2 instance text, P2 source values, or P2 scoring-target values were inspected before this preregistration.
- Dataset: `Qiaoyuan/POLAR-Bench`, `data/privacy_benchmark_rendered_repaired.json`.
- Required dataset SHA-256: `b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266`.
- Confirmatory subset: records with `metadata.privacy_level == 2` and `metadata.privacy_type == "semantic_constraints"`; all domains and all attack types; no case exclusion after outcomes are seen.

## Treatment

For each P2 case:

1. Construct one provenance-erased fact bag from `source_document_inputs.private_fields_embedded` and `source_document_inputs.task_relevant_fields`.
2. Do not expose the origin dictionary to the policy compiler.
3. Do not use `safe_abstractions_available`, `metadata.private_fields_present`, inferable-attribute metadata, `hidden_target`, or any scoring target during generation.
4. Compile the natural-language privacy policy using the frozen direct-field aliases, fixed semantic privacy ontology, deny-first precedence, and transform-only raw concepts in `policy_compiler_v2.mjs`.
5. Produce the entire caller-visible disclosure text before reading `scoring_targets`.
6. Ignore attacker prompts during generation. This is deliberate: the disclosure boundary is compiled from user policy and source facts, so attacker strategy cannot expand it.

## Comparators

- **Raw**: rendered source document.
- **Lexical policy filter**: sentence-level removal when a sentence contains an explicitly named field or fixed semantic category appearing in a negative policy clause. This comparator uses the same frozen field/category vocabulary but no structural fact-level compilation.
- **PCC v2**: frozen compiler above.

Gold targets are used only after all arm outputs for an instance have been produced.

## Primary metrics

Using POLAR's exact allowed/protected values and the same normalization/matcher frozen in the P1 study:

- Attribute utility: fraction of allowed values revealed.
- Privacy: 1 - fraction of protected values revealed.
- Overall: arithmetic mean of privacy and utility.
- Leak-free case rate.
- Minimal-success case rate: all allowed values revealed and zero protected values revealed.
- Paired PCC-v2-only vs lexical-only minimal-success wins, exact two-sided sign test.
- Domain and attack-type slices.

## Confirmatory gates

All gates must pass. Thresholds will not change after P2 outputs are produced.

1. **Zero exact protected disclosure**: PCC v2 reveals 0 protected target values across the full P2 subset.
2. **Utility**: mean PCC v2 attribute utility >= 0.95.
3. **Overall**: mean PCC v2 overall score >= 0.975.
4. **Joint success**: PCC v2 minimal-success rate >= 0.90.
5. **Architecture advantage**: PCC v2 minimal-success rate exceeds lexical filtering by >= 0.10 absolute.
6. **Paired significance**: PCC-v2-only minimal-success wins > lexical-only wins and exact two-sided sign-test p < 0.01.
7. **No utility collapse**: PCC v2 utility >= lexical utility - 0.01.
8. **Breadth**: for every domain and every attack slice with n >= 20, PCC v2 has zero protected-value disclosures and utility >= 0.90.
9. **Blinding integrity**: generation code has zero access to scoring targets / hidden target / benchmark private-label metadata before outputs are finalized.
10. **Reproducibility**: two independent workflow executions over the exact pinned dataset produce identical discrete outputs and identical summary metrics.

## Interpretation

If all gates pass, the defensible claim is limited to: **a policy-compiled, provenance-erased disclosure boundary developed on explicit-field policies generalizes to unseen semantic privacy policies on the frozen POLAR-Bench P2 subset, preserving high task-attribute availability while exposing no benchmark-defined exact protected values under all included attack protocols.**

This does not establish end-to-end task completion, semantic-inference privacy, side-channel security, universal privacy, or superiority over every competing system. P1 is development data and cannot be cited as confirmatory evidence.

If any gate fails, P2 is recorded as a failed confirmation and is never reused as confirmatory evidence for this mechanism version.
