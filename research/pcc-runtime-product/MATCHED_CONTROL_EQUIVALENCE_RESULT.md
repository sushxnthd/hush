# Finite-domain matched-control accounting equivalence — result

## Exact supported claim

**PASS.** For a uniform finite feasible state and a deterministic binary
release, PCC's realized cardinality charge, realized posterior min-entropy
reduction, and a history-aware semantic-declassification specialization are the
same quantity: `log2(|S| / |B|)`. Consequently, when feasible branches, weights
and budgets are identical, the three specializations make identical budget
decisions.

This is a scoped mathematical equivalence and high-value negative result:
PCC's charge formula alone cannot distinguish Hush from a matched posterior-risk
control in this regime.

## Decisive result

| Frozen check | Cases | Disagreements | Status |
|---|---:|---:|---|
| Uniform charge identity, domain sizes 2–12 | 1,561,584 | 0 | PASS |
| Weighted budget decisions, 3 weights × 8 budgets | 37,478,016 | 0 | PASS |
| Repeated disclosure after posterior restriction | 1,561,584 | 0 | PASS |
| Maximum floating-point error | — | 3.89e-16 | PASS |

All five preregistered gates passed. Two complete executions were byte-identical.
The committed result file SHA-256 is
`cb9ff86d13a8d3fa53b078f099660b45662e22099c9dcba2c5732abc31ad1a06`;
its canonical payload digest is
`2a18589d806943f63616ea51e147fe3c42be946127e9ea5e62af8204cabf8328`.

## Minimal boundary

The smallest tested non-uniform prior breaks the identity. For prior
`(0.9, 0.1)` and an exact deterministic reveal, cardinality reduction charges
`1.0` bit while statewise min-entropy reduction charges
`log2(1 / 0.9) = 0.15200309344505006` bits, a difference of
`0.84799690655495` bits.

This gives a new discriminating direction: if Hush keeps uniform cardinality
accounting, its behavior should diverge from calibrated posterior-risk controls
under skewed priors. That divergence can be conservative or utility-damaging;
it is not automatically an advantage.

## Prior-art interpretation

OCELOT defines a realized conditional-min-entropy security goal but deploys
calibrated per-operator upper bounds, not this exact cardinality implementation.
MNC defines typed task-sufficient disclosure, scope enforcement and a
history-aware extension, not this cardinality formula as its full mechanism.
Therefore this result is conditional on a matched finite-uniform specialization;
it is not an author-code reproduction or an end-to-end competitor comparison.

## Consequence

Do not claim PCC has a distinctive privacy advantage merely because it performs
exact finite-domain accounting. The next matched evaluation must target the
remaining mechanisms: non-uniform calibration, witness/candidate quality,
recipient and lifetime scope enforcement, lifecycle-stable composition,
feasible-branch refusal behavior, utility, latency and approval burden.

## Reproduce

```bash
python3 research/pcc-runtime-product/verify_matched_control_equivalence.py \
  --max-domain 12 \
  --output /tmp/matched-control-equivalence.json
sha256sum /tmp/matched-control-equivalence.json
```

Expected file SHA-256:
`cb9ff86d13a8d3fa53b078f099660b45662e22099c9dcba2c5732abc31ad1a06`.

## Gate status

The Hush breakthrough gate remains **INCONCLUSIVE**. This strengthens claim
discipline and identifies a precise boundary, but does not establish novelty,
external utility, named-system superiority or third-party reproduction.
