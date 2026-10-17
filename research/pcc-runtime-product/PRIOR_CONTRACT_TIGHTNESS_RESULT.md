# Tightness of the multiplicative prior-contract certificate — result

## Exact supported claim

**PASS.** The coefficient 3 in

`|L(p,B)-L(h,B)| <= 3 log2(rho)`

is universally optimal for the stated model. No smaller constant can replace it
for all strictly-positive finite priors and deterministic observed branches.

This resolves the anomaly from the earlier small rational grid: its failure to
find a counterexample to `2 log2(rho)` was a finite-domain artifact.

## Construction and proof

Fix integers `R>=2` and `N>R`. Partition a declared prior `h` into:

- a low class with total mass `R/(R+1)` and likelihood ratio
  `p_i/h_i=1/R`;
- a high class with total mass `1/(R+1)` and likelihood ratio
  `p_i/h_i=R`.

These class totals make `p` normalize exactly. Let a low-class atom of mass
`M` be the global maximum. The observed branch contains `N` low-class
atoms and one high-class atom, all of declared mass `x`. Split the remaining
mass finely enough that no other atom changes the intended maxima.

Then the pointwise mismatch is `rho=R` and:

- `r_p/r_h=R`;
- `m_h/m_p=R`;
- `q_h/q_p=R(N+1)/(N+R^2)`.

Consequently,

`L(p,B)-L(h,B)=log2(R^3 (N+1)/(N+R^2))`,

and the normalized coefficient is

`gamma = 3 + log_R((N+1)/(N+R^2))`.

Therefore `gamma>2` exactly when `N>R`, while `gamma -> 3` as
`N -> infinity`. Every constant below 3 is eventually violated.

## Explicit rational counterexample to the two-log bound

The frozen `R=2,N=3` construction has 16 states and exact gap ratio
`32/7`.

| Quantity | Value |
|---|---:|
| Declared charge | 0.584962501 bits |
| True charge | 2.777607579 bits |
| Charge gap | **2.192645078 bits** |
| Proposed `2 log2(rho)` bound | **2.000000000 bits** |
| Valid `3 log2(rho)` bound | 3.000000000 bits |

Thus the two-log candidate fails by 0.192645078 bits.

## Frozen verification

Exact rational priors were constructed for every `R=2..10` and
`N in {R+1,2R,10R,100R,1000R}`.

| Check | Result |
|---|---:|
| Constructed cases | 45 |
| Normalization violations | 0 |
| Pointwise-rho violations | 0 |
| Intended-extrema violations | 0 |
| Closed-form disagreements | 0 |
| `N>R` threshold disagreements | 0 |
| Three-log violations | 0 |
| Monotonicity violations | 0 |
| Independent audit failures | 0 |
| Largest tested gamma | **2.997838659** |
| Byte-identical primary rerun | PASS |

## Evidence integrity

- Result SHA-256:
  `d97d2c852a44fa73dffb70095bf5791d223b425227d634bd68c7cd2a8b6ffd3f`
- Canonical payload SHA-256:
  `5d677c5063869a0008a65a35086f35c7b04e3db6020d84dd6e09efe6c56b6f27`
- Independent rows SHA-256:
  `4dd3c49e24ef0018077ad41a78c6fcbb4023e8edd0c3d767cd8eeb3e1d2809c0`
- Independent audit artifact SHA-256:
  `acf57f3ffd88e64438bafeaf7297e45eeee199120766313725df03628da8bd95`

## Reproduce

```bash
python3 research/pcc-runtime-product/verify_prior_contract_tightness.py \
  --output /tmp/prior-contract-tightness-1.json
python3 research/pcc-runtime-product/verify_prior_contract_tightness.py \
  --output /tmp/prior-contract-tightness-2.json
cmp /tmp/prior-contract-tightness-1.json \
    /tmp/prior-contract-tightness-2.json
python3 research/pcc-runtime-product/audit_prior_contract_tightness.py \
  /tmp/prior-contract-tightness-1.json
```

## Belief-state update

- KNOWN: the three-log certificate is safe and its universal coefficient is
  sharp.
- FALSIFIED: the candidate universal two-log improvement.
- EXPLAINED ANOMALY: small prior grids cannot express the many-atom
  mass-splitting mechanism that makes all three multiplicative factors approach
  their worst directions simultaneously.
- UNTESTED: whether realistic structured prior families permit a smaller
  domain-specific coefficient or exact uncertainty-set charge.

The cheapest next discriminating experiment is a structured-prior study:
freeze product-relevant prior families and compare exact uncertainty-set
optimization with the universally sharp three-log fallback.

## Product and HAA implication

There is no universally tighter constant available to rescue the loose
certificate's false-denial problem. Any utility improvement must use additional
structure: narrower provenance-backed uncertainty sets, restricted prior
families, or exact robust optimization. Quietly changing 3 to 2 would create a
real undercharge vulnerability.

This creates a clean HAA proof-of-work chain: empirical anomaly, adversarial
construction, exact counterexample, general theorem, independent checker, and
product consequence.

## Limitations and gate status

The theorem concerns deterministic branches, positive finite priors,
pointwise multiplicative mismatch, and realized statewise min-entropy. It does
not establish historical novelty, certify deployed rho values, cover semantic
or stochastic leakage, or demonstrate external task utility.

The overall Hush breakthrough gate remains **INCONCLUSIVE**. This is an exact
mechanism law with clear security value, not a field-level breakthrough claim.
