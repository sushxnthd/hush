# PCC value-identity authorization oracle — correction result

> Historical correction: its record-derived default identity was subsequently
> superseded by lifecycle-stable logical path/field identity after the frozen
> record-recreation counterexample.

## Verdict: PASS for the frozen differential

PCC composition identity is now structural and result-independent:

- by default, contracts share a ledger only when they address the same stable
  encrypted record and private field;
- intentional aliases across fields or records must declare the same trusted
  public `privacyGroup`;
- recovered private values are never used as ledger identity.

| Private values | Before correction | Corrected |
|---|---|---|
| `(500,500)` | second preparation `deny` | `ask` |
| `(500,501)` | second preparation `ask` | `ask` |

Both worlds still release the same first result, and the second public decision
is now relation-independent. Explicitly grouped duplicate-field aliases still
share accounting and deny the identifying second query.

## Migration safety

The new keys use a `pcc:v2:` namespace. If persisted legacy value-derived PCC
state is present, comparison releases fail closed with an explicit migration
error rather than silently resetting the accumulated privacy budget.

## Evidence

- Frozen failure: `value_identity_authorization_failure.json`
  (`d8613654bf267efbffe88cf30811222a7cca3e21323fc01c2e1cfdd2b397ec34`)
- Corrected result: `value_identity_authorization_correction.json`
  (`3418a9cdadc96cfd64faed0ce8de35a7db6635242cbbb7404275f8e5295a7656`)
- Corrected extractor-alias and explicitly grouped field-alias probes: PASS
- Focused compiler/kernel tests: 29/29
- Complete repository suite: 310/310

Reproduce:

```bash
node research/pcc-runtime-product/run_value_identity_authorization_probe.mjs \
  --output /tmp/value_identity_authorization_replay.json
node research/pcc-runtime-product/run_extractor_alias_probe.mjs \
  --output /tmp/extractor_alias_replay.json
node research/pcc-runtime-product/run_field_alias_probe.mjs \
  --output /tmp/field_alias_replay.json
node --test test/private-constraint-compiler.test.js \
  test/private-constraint-kernel.test.js
npm test
```

## Smallest supported claim

Public structural grouping closes the tested private-equality authorization
oracle while preserving composition for same-field extractor aliases and
explicitly declared duplicate-field aliases.

## Boundary

`privacyGroup` is trusted policy metadata. Incorrect or malicious grouping can
cause over-composition or under-composition; this correction does not solve
semantic alias discovery. External validation, arbitrary program privacy and
compromised-runtime attacks remain open.
