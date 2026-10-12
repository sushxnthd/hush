# PCC ledger-cardinality equality oracle — frozen result

## Verdict: FAIL

Public diagnostics distinguished whether two private fields held equal values,
despite hiding the scalar digest itself.

| Private world | Public `pcc:derived` rows | Inference |
|---|---:|---|
| `(500, 500)` | 1 | values are equal |
| `(500, 501)` | 2 | values are unequal |

Both worlds used identical public domains, contracts, comparisons, consent
state, agents, and sinks. There were zero approvals and zero consumptions.

## Mechanism

The earlier alias correction deliberately coalesces equal recovered scalars
into one internal posterior ledger. Unequal scalars receive distinct ledgers.
Replacing each internal digest with the fixed public label `pcc:derived` hid
ledger identity but preserved ledger multiplicity, so list cardinality became
an equality oracle.

## Evidence provenance

- Frozen protocol: `LEDGER_CARDINALITY_PREREGISTRATION.md`
- Probe: `run_ledger_cardinality_probe.mjs`
- Raw artifact: `ledger_cardinality_failure.json`
- Artifact SHA-256:
  `7f0b1209fa154946f2b1b874cdde1851a17ad7e5082fda3c74828be9d559c52d`
- Reproduction:
  `node research/pcc-runtime-product/run_ledger_cardinality_probe.mjs --output research/pcc-runtime-product/ledger_cardinality_failure.json`

## Smallest supported claim

Redacting deterministic ledger identifiers is insufficient when the number of
value-derived ledgers remains public. In the tested two-field bounded-integer
case, diagnostic cardinality reveals private equality without releasing either
value.

## Cheapest correction

Keep the internal ledgers separate but collapse every PCC diagnostic entry into
one conservative public summary. Then replay the unchanged differential and
rerun the complete suite.
