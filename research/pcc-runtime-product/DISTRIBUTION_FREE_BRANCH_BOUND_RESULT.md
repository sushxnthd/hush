# Sharp distribution-free branch accounting and transcript coverage boundary

**Primary preregistered protocol:** FAIL (auxiliary finite-rate gate)  
**Exact theorem:** PASS  
**Breakthrough gate:** INCONCLUSIVE

## Smallest supported theorem

For an `n`-state secret, a nonempty deterministic observed branch `B` of size
`k`, and arbitrary prior `p`, define realized statewise min-entropy charge

```
L(p,B) = max(0, log2(max_B(p) / (max(p) P(B)))).
```

Then the exact distribution-free bound is

```
sup_p L(p,B) = log2(n-k+1).
```

The maximum is attained when zero-mass states are allowed. Over strictly
positive priors it is a sharp supremum.

## Proof

Let `m=max(p)`, `q=P(B)`, `r=max_B(p)`, `a=q/r>=1`, and `b=m/r>=1`.
There are `n-k` states outside `B`, so

```
1 <= q + (n-k)m = r(a+(n-k)b).
```

Therefore

```
r/(m q) = 1/(a b r)
          <= 1/b + (n-k)/a
          <= n-k+1.
```

For sharpness, assign equal mass `1/(n-k+1)` to one state in `B` and every
state outside `B`, with zero on the other branch states. The ratio is exactly
`n-k+1`. Replacing those zeros by `delta` gives exact convergence gap

```
log2(1 + (k-1)(n-k) delta),
```

which tends to zero.

## Frozen evidence and preserved failure

| Check | Result |
|---|---:|
| Positive rational priors | 26,040 |
| Exact prior/branch cases | 2,118,108 |
| Upper-bound violations | **0** |
| Zero-mass extremizers through n=64 | **2,079/2,079** |
| Cardinality-order checks | **2,079/2,079** |
| Independent audit | **PASS** |

The original protocol nevertheless has status **FAIL** because it required the
strictly-positive construction at fixed `delta=2^-20` to be within `1e-4`
bits uniformly through `n=32`. It missed that the convergence rate scales as
`(k-1)(n-k)`: 237 configurations failed, with maximum gap
`0.000330168906265` bits. The independent audit reproduced all 237 failures
and the exact gap law. No threshold was changed and the failed raw result is
preserved.

## Coverage impossibility

A deterministic transcript only identifies its feasible branch. For any
secret in that branch, covered and uncovered priors assigning the secret
positive mass generate the same transcript. Thus the transcript cannot by
itself certify membership in a finite prior ensemble.

Minimal frozen witness: for `n=3`, branch `{0,1}`, and secret `0`, the uniform
declared prior charges `0.584962501` bits. The uncovered prior `(1/2,0,1/2)`
produces the same transcript but charges `1` bit.

## Two ledgers

### SCIENCE

- **KNOWN:** `log2(n-k+1)` is the sharp prior-free branch charge.
- **KNOWN:** transcript-only finite-ensemble coverage certification is
  impossible without external information.
- **FALSIFIED:** cardinality `log2(n/k)` is distribution-free conservative for
  non-singleton proper branches.
- **FALSIFIED:** a fixed delta gives a domain-uniform approximation rate.
- **UNTESTED:** whether this exact operation-specific formulation is
  historically new; expert prior-art review is required.

### CONSEQUENCE

Hush now has a three-level accounting contract:

1. use the tighter trace-envelope FER-PCC charge only with external,
   provenance-backed ensemble coverage;
2. otherwise use the exact prior-free fallback `log2(n-k+1)` when a bounded
   deterministic branch is available;
3. deny when neither contract applies.

`src/distribution-free-branch-charge.js` implements the fallback and fails
closed on invalid domains. It does not infer coverage from private outputs.

## Prior-art boundary

Smith's 2009 min-entropy QIF foundation formalizes the one-guess vulnerability
threat model, and later maximal-leakage/channel-capacity work maximizes guessing
gain over input distributions. Zero-error source-coding work likewise studies
source-distribution-maximized leakage. These absorb any broad claim to inventing
min-entropy leakage or prior maximization. The present defensible contribution
is narrower: the sharp **per-realized-branch** factor `n-k+1`, its transcript
coverage-impossibility consequence, and the Hush fail-closed runtime contract.
The initial primary-source search did not establish historical priority for
that exact formula, so novelty remains explicitly unverified.

- Geoffrey Smith, *On the Foundations of Quantitative Information Flow*,
  FoSSaCS 2009, https://doi.org/10.1007/978-3-642-00596-1_21
- Alvim et al., *Measuring Information Leakage Using Generalized Gain
  Functions*, CSF 2012, https://doi.org/10.1109/CSF.2012.26
- Liu et al., *Information Leakage in Zero-Error Source Coding: A
  Graph-Theoretic Perspective*, 2021, https://arxiv.org/abs/2102.01908

## Reproduce

```bash
python3 research/pcc-runtime-product/verify_distribution_free_branch_bound.py \
  --max-domain 7 --max-denominator 16 \
  --output /tmp/distribution-free.json
python3 research/pcc-runtime-product/audit_distribution_free_branch_bound.py \
  /tmp/distribution-free.json --output /tmp/distribution-free-audit.json
node --test test/distribution-free-branch-charge.test.js
```

Primary result SHA-256:
`2cc96c8326b0eec58cd4b7cb51a421aab8c85c29aa22cffded2047deecca0ec6`.

## Limitations

This result concerns deterministic finite branches and one realized
min-entropy measure. The fallback may be conservative, gives no semantic,
timing, covert-channel, or differential-privacy guarantee, and does not
validate any live prior or ensemble. The formula's historical novelty has not
been established.

