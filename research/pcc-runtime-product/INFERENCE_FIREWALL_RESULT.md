# PCC inference-firewall differential: result

## Verdict

**Security-consistency gate: FAIL.**

PCC's nominal output-cardinality ceiling is not a semantic non-identification guarantee. The current PCC release path bypasses Hush's realized-posterior firewall.

## Minimal counterexample

| Route over secret 500 in domain 0..1023 | Outcome | Posterior accounted |
|---|---|---:|
| Native predicate `balance == 500` | **DENY**, no result | 1024 → 1; 10 bits |
| PCC bundle `balance >= 500`, `balance <= 500` | **ALLOW**, `(true,true)` | 1024 → 1024; 0 bits |
| Independent enumeration of PCC output | Exact reconstruction `[500]` | 1024 → 1 logically |

All five preregistered diagnostic predictions held. Evidence SHA-256: `3bcda0efb686863d6e5d0f9f393cfade8c0db4076f078f42af2df175be0660ee`.

## Mechanism

Two boolean outputs have at most two bits of output cardinality, but realized knowledge depends on the size of the observed output's preimage. The vector `(s >= g, s <= g)` equals `(true,true)` only for `s = g`. With 1,024 initially possible values, that observation conveys 10 realized bits. PCC recorded only its two nominal output bits and did not update the shared finite-domain posterior.

This also shows why explicit local approval does not itself establish privacy: the approval authorizes a channel, but the UI's “two bits” description understates the identifying power of a rare result.

## Claim update

The earlier bounded-bundle result remains valid for its measured endpoint: exact source values were not literally present in model/provider/receipt payloads, utility was preserved, and approvals fell by one-third. It does **not** establish semantic or inference privacy, and “two-bit capacity ceiling” must not be presented as a realized-knowledge guarantee.

## Cheapest discriminating correction

Route every analyzable PCC comparison through the same persistent partition firewall before release. Evaluate bundle predicates sequentially on a transactional posterior copy; deny the entire bundle if any step exceeds the realized-knowledge limit; commit the final posterior only when the approved one-shot bundle is consumed; invalidate concurrent preparations if posterior state changed. Then prospectively test both the identifying counterexample and a non-identifying scheduling cohort.

## Reproduce

```bash
node research/pcc-runtime-product/run_inference_firewall_probe.mjs \
  --output research/pcc-runtime-product/inference_firewall_probe.json
```
