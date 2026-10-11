# PCC field-alias composition probe: frozen failure

## Verdict

The preregistered security-consistency gate **FAILED**. The extractor-alias
correction still keyed PCC posterior accounting partly by schema path. Two
trusted fields holding the same logical bounded scalar therefore received
separate privacy ledgers.

| Arm | First `s >= 500` | Second `s <= 500` | PCC ledgers | Independent intersection |
|---|---:|---:|---:|---:|
| Same field control | allowed | denied | 1 | 524 candidates |
| Field-alias intervention | allowed | **allowed** | **2** | **`[500]`** |

After the first intervention query, its ledger retained 524/1,024 candidates
(0.966576998 realized bits). The second alias started a fresh ledger and
retained 501/1,024 candidates (1.031333207 bits). Each local assessment was
below the firewall limit, but the joint transcript identified the scalar
exactly.

## Mechanism and belief update

The opaque scalar digest added by the preceding correction was not sufficient
because the posterior key also contained `privateField`. This falsifies the
assumption that trusted schema paths are necessarily unique identities for
composition. Duplicate/legacy/normalized fields can be semantic aliases even
when their syntax differs.

This is a stronger equivalence-class boundary than the extractor-syntax
failure: privacy accounting must conservatively unify releases that recover
the same bounded scalar, or require a separately verified canonical identity.

## Provenance

- Preregistration/source freeze: `ae4b6d0ae39f83b860fd95292621be805bcf821f`
- Raw artifact: `field_alias_probe.json`
- Raw SHA-256: `10191028ecb0f066008889cc4d2b604ee54a6bb542bb29ffd4f65d93c8b0d2db`
- Secret/domain: 500 over integer 0..1023
- Actual encrypted ContextKernel, PCC approval and one-shot consumption path
- Independent finite-domain transcript enumerator

## Scope and cheapest correction

The construction assumes a trusted local schema with two declared aliases of
one logical scalar. It is not a remote arbitrary-code exploit and does not show
that unrelated coincidentally equal fields are semantically identical.

The cheapest fail-safe correction is to key bounded numeric PCC posterior
accounting by the internal scalar digest alone, not schema path. This can
conservatively co-account unrelated equal-valued fields and reduce utility, but
it prevents this tested bypass without disclosing the scalar. Conflicting
domains must continue to fail closed. Re-run this immutable probe and all tests.
