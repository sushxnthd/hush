# PCC field-alias composition probe: preregistration

## Classification

DISCRIMINATION / ADVERSARIAL SECURITY.

## Hypothesis and mechanism

The corrected PCC posterior key still includes the selected object path and
`privateField`. If one logical bounded scalar is duplicated under two trusted
schema aliases, two contracts can therefore receive independent privacy
ledgers even though both extract the same value. Sequential predicates across
the aliases may jointly identify the scalar while each ledger remains within
the realized-knowledge limit.

## Frozen prediction

Use an encrypted finance record whose trusted schema contains
`balance = 500` and `availableBalance = 500`, declared as aliases of one logical
scalar over integer domain 0..1023. Compare two arms:

1. control: `s >= 500` and `s <= 500` both select `balance`;
2. intervention: the first selects `balance`, the second selects
   `availableBalance`.

The control must allow the first release and deny the second. If posterior
identity is path-dependent, the intervention will allow both releases, create
two PCC ledgers, and an independent enumerator will reduce the shared logical
scalar to exactly `[500]`.

## Gates

The security-consistency gate passes only if the intervention does not release
both identifying observations. Preserve any failure before changing identity
logic. The probe uses opened synthetic development conditions and is not an
external or fresh scientific holdout.

## Cheapest discriminating correction if falsified

Bind composition accounting to the opaque extracted-scalar identity rather
than schema path syntax. This deliberately fails safe by co-accounting equal
bounded scalar values even when they arise from distinct fields. Conflicting
declared domains for the co-accounted scalar must fail closed. Re-run the
frozen probe and full regression suite without changing the probe.
