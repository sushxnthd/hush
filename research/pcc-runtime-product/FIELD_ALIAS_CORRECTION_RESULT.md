# PCC field-alias composition correction

## Verdict

The unchanged frozen probe now **PASSES**. PCC posterior identity follows the
opaque extracted bounded scalar rather than extractor or schema-path syntax.

| Arm | First `s >= 500` | Second `s <= 500` | PCC ledgers | Independent posterior |
|---|---:|---:|---:|---:|
| Same field control | allowed | denied | 1 | 524 candidates |
| Field-alias intervention | allowed | **denied** | **1** | **524 candidates** |

All preregistered correction gates passed:

- the control still blocks identification;
- the alias arm no longer releases both observations;
- the alias transcript no longer reconstructs the scalar;
- aliases no longer split PCC posterior state; and
- the security-consistency verdict is PASS.

## Correction

For bounded numeric PCC comparisons, the internal posterior key is now the
opaque `privateScalarDigest`. Contract ID, extractor syntax, storage path, and
`privateField` are excluded. Equal recovered scalars therefore share one
composition ledger. If such releases declare different integer domains, Hush
fails closed rather than assigning a second budget.

This deliberately prefers conservative co-accounting: unrelated private
fields with equal current values can share a ledger and reduce utility. The
digest remains internal to the encrypted local runtime and the raw scalar is
not added to model, provider, or receipt boundaries.

## Verification

- Frozen failure SHA-256:
  `10191028ecb0f066008889cc4d2b604ee54a6bb542bb29ffd4f65d93c8b0d2db`
- Corrected replay SHA-256:
  `27466d87f549f7149f8eae10e6f8e0f60a78137f7488b623f0c5b4447534a523`
- Second corrected replay: byte-identical
- Focused PCC kernel tests: 14/14 passed
- Full repository suite: 303/303 passed

## Smallest supported claim

In the tested bounded-integer runtime, scalar-based posterior identity closes
both extractor-syntax and duplicate-field alias composition bypasses. This is
a security mechanism and product-hardening result, not proof of universal
semantic equivalence, resistance to malicious trusted extractors, arbitrary
unstructured-text privacy, side-channel safety, or a scientific breakthrough.
