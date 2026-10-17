# PCC structural-identity lifecycle differential — result

## Verdict: FAIL

The frozen prediction was confirmed. Removing and recreating an unchanged
logical private-context path allocated a new storage record identifier and,
therefore, a fresh PCC posterior ledger.

| Lifecycle path | Storage identity preserved | Second preparation | Joint inference |
|---|---:|---:|---:|
| Unchanged + restart | yes | `deny` | blocked |
| In-place update + restart | yes | `deny` | blocked |
| Remove/recreate + restart | no | `ask`, then allowed | exactly `[500]` |

The first release was `s >= 500 -> true` in every condition. After
remove/recreate, the second release `s <= 500 -> true` was evaluated against a
fresh 1,024-candidate ledger. Their public intersection uniquely recovered the
synthetic secret `500`.

## Mechanism

Result-independent identity fixed the private-equality oracle, but tying the
default identity to a storage object made composition depend on object
lifecycle. The old posterior remained persisted under the old identity while
the recreated record received a new one. Logical path continuity and privacy
identity continuity were therefore different.

## Evidence

- Frozen preregistration commit: `fbd23fd7165892ab34446bb0e534033b448d19a8`
- Failure artifact: `record_recreation_failure.json`
- Artifact SHA-256:
  `9231993abaf0580804406d10a1542f143d0dfccddf337f6eb4f452c58a1782a3`
- Independent deterministic rerun: byte-identical

Reproduce:

```bash
node research/pcc-runtime-product/run_record_recreation_probe.mjs \
  --output /tmp/record_recreation_replay.json
sha256sum /tmp/record_recreation_replay.json
```

## Smallest supported claim

Storage-record identity is not a lifecycle-stable privacy identity: deletion
and recreation of unchanged bounded private evidence resets PCC composition in
the tested runtime and permits exact reconstruction across the reset.

## Boundary and cheapest correction

This is a trusted local lifecycle operation; the experiment does not show that
a remote model can delete context. The cheapest correction is to key the
default ledger to stable logical path plus private field, while retaining
explicit trusted `privacyGroup` for genuine cross-path aliases. A prospective
correction must also show that ordinary distinct paths remain independent and
that restart, in-place update, and remove/recreate all preserve composition.
