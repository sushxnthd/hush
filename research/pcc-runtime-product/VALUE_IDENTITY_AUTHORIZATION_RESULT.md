# PCC value-identity authorization oracle — frozen result

## Verdict: FAIL

Value-derived ledger identity leaked whether two private fields were equal even
though both released predicate results were identical.

| Private values | Released results | Second preparation |
|---|---|---|
| `(500,500)` | `true`, `true` | `deny` |
| `(500,501)` | `true`, `true` | `ask` |

The observer therefore learns equality from authorization behavior, not from
the intended Boolean outputs or diagnostic row count.

## Mechanism

The first query `a >= 500` leaves 524 candidates. When `b=500`, scalar-digest
identity treats `a` and `b` as the same private atom; the feasible true branch
of `b <= 501` leaves two candidates and exceeds the eight-bit limit. When
`b=501`, it receives a fresh ledger and both branches are safe. Thus authorization
depends on the private equality relation.

## Evidence

- Frozen protocol: `VALUE_IDENTITY_AUTHORIZATION_PREREGISTRATION.md`
- Probe: `run_value_identity_authorization_probe.mjs`
- Raw result: `value_identity_authorization_failure.json`
- SHA-256:
  `d8613654bf267efbffe88cf30811222a7cca3e21323fc01c2e1cfdd2b397ec34`

Reproduce:

```bash
node research/pcc-runtime-product/run_value_identity_authorization_probe.mjs \
  --output /tmp/value_identity_authorization.json
```

## Smallest supported claim

Automatic composition identity derived from current private-value equality
cannot be transcript-private: whether two fields share accounting changes the
public authorization decision. Presentation-layer redaction cannot repair this
mechanism.

## Required correction

Use a public structural composition identity. Same-field extractor aliases
should co-account by default; intentional duplicate-field aliases must declare
the same trusted `privacyGroup`. Current scalar equality must not participate
in ledger identity.
