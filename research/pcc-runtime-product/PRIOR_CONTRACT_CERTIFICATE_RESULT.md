# Multiplicative prior-contract certificate — result

## Smallest supported claim

**PASS.** Let `p` be the true strictly-positive prior and `h` a declared
prior over the same finite state space. If

`rho = max_i max(p_i/h_i, h_i/p_i)`,

then for every nonempty deterministic observed branch `B`,

`|L(p,B)-L(h,B)| <= 3 log2(rho)`,

where `L(x,B)` is the realized statewise min-entropy reduction. Therefore

`R=max(0,L(h,B)+3log2(rho))`

is a certified fail-closed upper charge: any release allowed by `R<=budget`
is also allowed by the true nonnegative charge.

This is a safety certificate conditional on a valid multiplicative mismatch
bound. It is not evidence that such a bound is easy to obtain.

## Proof

Write `m_x=max_i x_i`, `q_x=sum_{i in B}x_i`, and
`r_x=max_{i in B}x_i`. Then

`L(x,B)=log2(r_x/(m_x q_x))`.

Pointwise multiplicative closeness implies each of
`r_p/r_h`, `m_h/m_p`, and `q_h/q_p` lies in
`[1/rho,rho]`. Hence the ratio between the two quantities inside the
logarithms lies in `[rho^-3,rho^3]`, proving the bound.

## Frozen exhaustive result

The verifier enumerated every unique ordered positive rational prior with
domain `n=2..5` and denominator up to 10, every ordered true/declared pair,
and every nonempty proper branch.

| Frozen check | Result |
|---|---:|
| Unique priors by n | 31, 109, 205, 251 |
| Ordered prior pairs | 117,868 |
| Prior-pair/branch cases | 2,551,588 |
| Theorem violations | **0** |
| Robust upper-bound violations | **0** |
| Robust false-safe decisions | **0 at all 6 budgets** |
| rho=1 disagreements | **0** |
| Counterexamples to exploratory 2-log bound | 0 on this grid |
| Largest observed normalized mismatch | 1.806567 |

Two full primary runs were byte-identical. An independently structured
integer-composition implementation agreed on every headline aggregate.

## Decisive decision table

Counts below are over the frozen grid and are not population frequencies.

| Budget (bits) | Cardinality false-safe / false-deny | Nominal false-safe / false-deny | Certified robust false-safe / false-deny |
|---:|---:|---:|---:|
| 0.00 | 0 / 198,419 | 177,586 / 177,586 | **0** / 197,366 |
| 0.25 | 0 / 489,007 | 295,976 / 295,976 | **0** / 486,457 |
| 0.50 | 52,160 / 528,940 | 367,464 / 367,464 | **0** / 954,931 |
| 1.00 | 9,840 / 626,443 | 202,756 / 202,756 | **0** / 2,006,013 |
| 2.00 | 0 / 307,475 | 7,350 / 7,350 | **0** / 2,490,734 |
| 4.00 | 0 / 0 | 0 / 0 | **0** / 2,011,567 |

The robust certificate closes the observed unsafe-allow channel, but a loose
`rho` can make it operationally unusable. At a four-bit budget, where the
other policies make no errors on this grid, the robust certificate falsely
denies 2,011,567 cases. The mechanism therefore requires a tight,
provenance-backed mismatch bound or must fail closed; merely supplying a
non-uniform prior is unsafe, while accepting an arbitrarily loose certificate
destroys utility.

Minimal frozen nominal false-safe example: true prior `(1/2,1/2)`, declared
prior `(1/10,9/10)`, singleton branch `{0}`, and budget 0.25. The declared
charge is 0.152003 bits while the true charge is 1 bit.

Minimal frozen cardinality false-safe example: true prior
`(1/10,1/10,1/2,3/10)`, branch `{0,1,2}`, and budget 0.5. Cardinality
charges 0.415037 bits while the true charge is 0.514573 bits.

## Evidence integrity

- Result file SHA-256:
  `c52bc9356876e267e3a1c3eef6b89663588572b52c2f0a8c554f8e930be5ddcc`
- Canonical payload SHA-256:
  `b38c3a57fe7a4ba8e85b6b7445e01e1c42838c45f4d51a03652acb9a226b1b36`
- Independent aggregate SHA-256:
  `efb39c22f79a028a15618f71051c04292c6e6bbbea4b4a0fbfe597b95a6babb9`
- Independent audit artifact SHA-256:
  `60770f9f2208614f7f3c52826a9d301e34b86c56e8e4dcfcec9fa424a75641ea`

## Reproduce

```bash
python3 research/pcc-runtime-product/verify_prior_contract_certificate.py \
  --max-domain 5 --max-denominator 10 \
  --output /tmp/prior-contract-1.json
python3 research/pcc-runtime-product/verify_prior_contract_certificate.py \
  --max-domain 5 --max-denominator 10 \
  --output /tmp/prior-contract-2.json
cmp /tmp/prior-contract-1.json /tmp/prior-contract-2.json
python3 research/pcc-runtime-product/audit_prior_contract_certificate.py \
  /tmp/prior-contract-1.json
```

## Belief update and next experiment

- KNOWN: a valid multiplicative prior contract yields a deterministic
  fail-closed charge with zero unsafe allows in the searched domain.
- FALSIFIED: “a declared calibrated prior is sufficient without quantified
  shift” and “a generic worst-case certificate preserves useful decisions.”
- ANOMALOUS: no `2log2(rho)` counterexample appeared on the frozen grid; this
  is finite evidence only, not a theorem.
- UNTESTED: whether a tighter exact uncertainty-set optimizer or a provably
  sharper constant preserves safety with materially less false denial.

Cheapest next discriminating experiment: preregister an exact worst-case
optimizer over a declared finite prior uncertainty polytope, compare its charge
against the analytic three-log certificate, and test whether it retains zero
false-safe decisions while reducing false denials.

## Limitations and gate status

The result covers positive finite priors, deterministic branches, supplied
valid `rho`, and one realized min-entropy measure. It does not validate a
learned prior, certify live distribution shift, cover stochastic or semantic
channels, establish historical novelty, reproduce OCELOT, or demonstrate
external task advantage.

The Hush breakthrough gate remains **INCONCLUSIVE**. This is a reproducible
safety mechanism plus a sharp product limitation, not a field-level
breakthrough.
