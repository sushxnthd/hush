# PCC extractor-alias composition correction

## Outcome

The frozen extractor-alias counterexample is corrected. Posterior identity now
uses the private source location plus an opaque digest of the actual extracted
scalar, rather than the extractor's syntactic specification. Equivalent
extractors therefore share one ledger; the scalar itself never crosses the
kernel boundary.

| Secret 500, domain 0..1023 | Before correction | Corrected |
|---|---:|---:|
| Shared-extractor second query | denied | denied |
| Alias-extractor second query | **released** | **denied** |
| Exact reconstruction through alias | **yes** | **no** |
| PCC ledgers for equivalent aliases | 2 | **1** |
| Candidates after denied alias query | incorrectly split | **524, unchanged** |

The first `>= 500` observation leaves 524 candidates. The subsequent `<= 500`
alias is evaluated against that same posterior and denied before approval or
output because the combined observation would leave one candidate and exceed
the eight-bit realized-knowledge limit. Contracts that resolve the same scalar
but declare different integer domains now fail closed instead of silently
selecting one domain.

## Verification

- Frozen failure preserved in `extractor_alias_probe.json`.
- Corrected replay preserved in `extractor_alias_correction.json`.
- Failure SHA-256: `131cc51c966652bce212b57dc9b0e1f076b6cc4c0da01c1571ece0d5fa7eea28`.
- Correction SHA-256: `edf27db402c0c136ec49d4fba6752300faddd03add3b227f34a747cb64208208`;
  a complete replay was byte-identical.
- Independent candidate enumeration no longer reconstructs the secret.
- Focused PCC kernel tests: 12/12 PASS.
- Full repository suite: **301/301 PASS**.
- No earlier frozen runtime result was rewritten.

## Smallest supported claim

For the tested bounded-integer PCC path, realized-posterior accounting now
composes across semantically equivalent numeric extractor aliases and rejects
conflicting domain aliases. This removes the demonstrated trusted-contract
composition bypass.

This remains a scoped implementation/security result. Contract registration is
trusted-local, the probe is synthetic and deterministic, and only one scalar
type and comparison family are covered. It does not establish alias invariance
for arbitrary prose, enums, dates, structured transformations, inaccurate
domains, external semantic priors, or covert channels. The scientific
breakthrough gate remains **INCONCLUSIVE**.

## Reproduction

```bash
node research/pcc-runtime-product/run_extractor_alias_probe.mjs \
  --output /tmp/extractor_alias_replay.json
node --test test/private-constraint-kernel.test.js
npm test
```
