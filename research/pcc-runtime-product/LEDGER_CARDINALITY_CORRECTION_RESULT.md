# PCC ledger-cardinality equality oracle — correction result

## Verdict: PASS for the frozen differential

All internal PCC ledgers now collapse into one conservative public diagnostic
summary. The internal scalar-specific posterior state is unchanged, but public
row count no longer reveals whether two private values co-account.

| Private world | Before | Corrected |
|---|---:|---:|
| `(500, 500)` | 1 public row | 1 aggregate row |
| `(500, 501)` | 2 public rows | 1 aggregate row |

The corrected observations are byte-identical across the two worlds. The
summary reports conservative extrema—minimum remaining candidates, maximum
knowledge and fragment count, strictest configured limits—without reporting
how many ledgers contributed.

## Evidence

- Frozen failure: `ledger_cardinality_failure.json`
  (`7f0b1209fa154946f2b1b874cdde1851a17ad7e5082fda3c74828be9d559c52d`)
- Corrected result: `ledger_cardinality_correction.json`
  (`bd1b002dad13b318b7bfa18ecddd63889dcaed75f8b40a944a8eb77ce97ec18a`)
- Independent deterministic rerun: byte-identical
- Focused PCC tests: 18/18
- Complete repository suite: 307/307

Reproduce:

```bash
node research/pcc-runtime-product/run_ledger_cardinality_probe.mjs \
  --output /tmp/ledger_cardinality_replay.json
sha256sum /tmp/ledger_cardinality_replay.json
node --test test/private-constraint-kernel.test.js
npm test
```

## Smallest supported claim

Conservative single-row aggregation closes the tested diagnostic-cardinality
equality oracle while retaining internal bounded-integer composition accounting.

## Boundary

This covers the authenticated `partitionExposure()` surface for the frozen
two-field differential. It does not establish noninterference for every local
diagnostic, semantic privacy, malicious-contract resistance, or protection from
a compromised runtime. Aggregate posterior statistics remain intentionally
visible and require separate composition review.
