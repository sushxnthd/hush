# PCC clean-room replication and product-boundary protocol

Status: **frozen before execution**.

## Question

Can the compute-before-disclose mechanism described in
`research/PRIVATE_CONSTRAINT_COMPILATION.md` be rebuilt without importing the
Hush JavaScript compiler, and does the rebuilt mechanism preserve task utility
while exposing less private source material at a simulated model/provider
boundary?

This is an internal clean-room replication by a second implementation, not an
independent third-party reproduction and not a fresh external holdout.

## Implementation isolation

`pcc_cleanroom.py` is a standard-library-only Python implementation written
from the public mechanism specification. It does not import, invoke, or copy
`src/private-constraint-compiler.js`, the POLAR policy compilers, or their
evaluators. It supports bounded numeric extraction and fixed-schema predicate
release, rejects ambiguous sources, and never renders source prose.

## Frozen experiments

1. **Exhaustive mechanism test.** Enumerate private integers `0..4095`, four
   source templates, and seven thresholds. Verify the released predicate
   against a separately written oracle. Add a unique canary to every source and
   require that neither canary nor source text appears in the release.
2. **Equivalence-class test.** For each value and threshold, vary irrelevant
   private prose while holding the extracted value fixed. Releases must be
   byte-identical.
3. **Ambiguity test.** Sources containing two distinct candidate values must
   fail closed.
4. **Product-boundary test.** Across 512 deterministic meeting-booking cases,
   compare raw context, coarse redaction, and PCC. The model/provider must
   choose between two public slots. The private calendar source contains the
   availability cutoff and a unique sensitive canary. PCC locally releases
   only `slot_allowed: true|false` for each slot; an auditable receipt records
   the contract and hashes, not the source.
5. **Adaptive-composition test.** Binary-search queries over a 4096-value
   domain are run both without accounting and with a five-bit cumulative
   release budget. This tests a known boundary, not a claim that one-bit
   predicates are composition-safe.

## Preregistered predictions and gates

All gates are required for a scoped replication pass:

1. exhaustive oracle agreement is 100%;
2. protected canary disclosures are zero for PCC;
3. equivalence-class violations are zero;
4. all ambiguous sources fail closed;
5. PCC and raw-context product task success are both 100%;
6. PCC exposes zero exact protected canaries at the model/provider boundary;
7. raw context exposes every protected canary;
8. PCC receipts contain no source or canary;
9. unbudgeted adaptive predicates exactly recover every tested secret;
10. the five-bit guard prevents exact recovery and leaves at least 128
    candidates in every tested case.

Coarse redaction is expected to protect canaries but lose task utility; its
score is descriptive rather than a pass gate.

## Claim boundary

A pass supports only: a clean-room implementation reproduced the bounded PCC
mechanism on exhaustive finite numeric domains and a production-faithful local
prototype completed the tested scheduling decisions without sending the source
value or canary to the simulated model/provider boundary.

It does not establish semantic privacy, arbitrary-text extraction, side-channel
security, resistance to malicious local code, external validity, third-party
reproduction, or superiority over a named product.

