# PCC structural-identity lifecycle differential — correction result

## Verdict: PASS for the frozen differential

The default PCC identity is now derived from stable logical context path plus
private field, rather than the replaceable storage record identifier.

| Lifecycle path | Before correction | Corrected |
|---|---:|---:|
| Unchanged + restart | second query `deny` | `deny` |
| In-place update + restart | second query `deny` | `deny` |
| Remove/recreate + restart | second query `ask`, exact recovery | `deny` |

Ordinary structurally independent paths remain separate. Intentional aliases
across paths or fields still require an explicit trusted public `privacyGroup`.

## Migration safety

The corrected logical identities use namespace `pcc:v3:`. Any persisted PCC
ledger from the value-derived or record-derived identity eras fails closed with
an explicit migration error rather than silently starting a fresh ledger.

## Evidence

- Frozen failure SHA-256:
  `9231993abaf0580804406d10a1542f143d0dfccddf337f6eb4f452c58a1782a3`
- Corrected artifact SHA-256:
  `f9e9a1e67ac0aa887ab54d40bb0f243b8276da43189e0dedea82aaae637b3497`
- Corrected rerun: byte-identical
- Focused compiler/kernel tests: 30/30
- Complete repository suite: 311/311

Reproduce:

```bash
node research/pcc-runtime-product/run_record_recreation_probe.mjs \
  --output /tmp/record_recreation_replay.json
node --test test/private-constraint-compiler.test.js \
  test/private-constraint-kernel.test.js
npm test
```

## Smallest supported claim

Logical-path/field identity closes the tested storage-lifecycle composition
reset while preserving same-path composition and distinct-path independence.

## Boundary

Path reuse for a genuinely different logical secret is conservative and may
retain obsolete accounting; path renames still require explicit trusted
grouping to preserve composition. Semantic alias discovery, hostile local
lifecycle control, arbitrary programs and external validation remain open.
