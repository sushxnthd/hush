# PCC inference-firewall differential probe: preregistration

Frozen before executing the probe.

## Hypothesis

The PCC release path is not connected to Hush's realized-posterior partition firewall. Consequently, two boolean comparisons whose joint output identifies one value in a declared 1,024-value private domain will be released by PCC even though the native private-decision path denies the logically equivalent exact-identification result.

## Mechanism

For secret `s` and public target `g`, the pair `(s >= g, s <= g)` has joint output `(true, true)` exactly when `s = g`. Although the channel has at most two output bits, observing `(true, true)` collapses a uniform 1,024-value support to one candidate: 10 bits of realized knowledge. Output-cardinality accounting and realized-posterior accounting therefore diverge.

## Frozen case

- Private field: `finance.balance`
- Declared integer domain: 0..1023
- Secret and public target: 500
- Native control: predicate `balance == 500`
- PCC bundle: comparisons `balance >= 500` and `balance <= 500`, declared `maxBits=2`
- Agent/sink bindings are fixed and both releases require explicit local approval.

## Predictions and gates

The security-consistency gate passes only if both routes deny identifying output or both routes account for the same posterior before release.

The hypothesized failure is:

1. Native control returns `deny`, no result, after-candidate count 1, and approximately 10 realized knowledge bits.
2. PCC bundle returns `(true,true)` after approval.
3. An independent enumerator reduces the domain to exactly `[500]`.
4. The kernel partition footprint remains at 1,024 candidates after PCC consumption.

Any discrepancy is preserved. This is a deterministic minimal counterexample on an opened synthetic domain, not a universal semantic-privacy measurement.
