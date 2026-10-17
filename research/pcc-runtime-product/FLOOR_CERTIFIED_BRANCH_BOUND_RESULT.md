# Floor-certified branch accounting

**Frozen protocol:** FAIL  
**Exact theorem:** PASS  
**Breakthrough gate:** INCONCLUSIVE

## Smallest supported theorem

Let an `n`-state secret have prior `p`, let `B` be a nonempty deterministic observed branch of size `k`, and suppose an external provenance contract certifies `p_i >= lambda` for every state, where `0 <= lambda <= 1/n`. For

```
L(p,B) = max(0, log2(max_B(p) / (max(p) P(B)))),
```

the exact worst-case charge is

```
sup_p L(p,B)
  = log2((n-k+1) / (1+(k-1)(n-k)lambda)).
```

The supremum is attained: put mass `lambda` on `k-1` branch states and equal heavy mass

```
m = (1-(k-1)lambda)/(n-k+1)
```

on the remaining branch state and every state outside the branch.

## Proof

Write `d=n-k`, `c=(k-1)lambda`, `q=P(B)`, `r=max_B(p)`, and `m=max(p)`. The floor and outside-state capacity imply

```
r <= q-c,   m >= r,   m >= (1-q)/d  (d>0).
```

Thus, at fixed `q`,

```
r/(m q) <= (q-c) / (q max(q-c,(1-q)/d)).
```

The maximum's arguments cross at `q0=(1+d c)/(d+1)`. Below `q0`, the bound is `d(q-c)/(q(1-q))`; its derivative has nonnegative numerator `(q-c)^2+c(1-c)`, so it increases. Above `q0`, the bound is `1/q`, so it decreases. Its maximum is therefore `1/q0=(d+1)/(1+d c)`. The construction meets all inequalities with equality. For `d=0`, the branch is the whole domain and both factors equal one.

## Preserved preregistration failure

The frozen protocol incorrectly predicted factor one at `lambda=1/n`. A uniform prior does not make observation free: a `k`-state branch has factor `n/k` and charge `log2(n/k)`. This caused 557 frozen endpoint failures. No gate was changed. The sharp formula itself gives `n/k` exactly and had zero violations.

## Decisive evidence

| Check | Result |
|---|---:|
| Exact rational prior/floor/branch cases | 4,558,671 |
| Bound violations | **0** |
| Equality constructions | 51,540 |
| Equality failures | **0** |
| Corrected endpoint failures | **0** |
| Monotonicity checks | 48,196 |
| Monotonicity failures | **0** |
| Independent sufficient-statistic checks | 23,020,360 |
| Independent failures | **0** |
| Byte-identical rerun | **PASS** |
| Full HUSH suite | **333/333 PASS** |

Primary canonical digest: `48fa015e78eeabccdb9f111cba3f220085b28b24457661f869317444d0fe6533`.

## SCIENCE ledger

- **KNOWN:** the displayed floor-certified bound is exact.
- **KNOWN:** it strictly improves the prior-free fallback for `1<k<n` and `0<lambda<=1/n`; singleton observations cannot benefit from a floor.
- **FALSIFIED:** a uniform prior makes deterministic branch observation free.
- **BELIEVED:** a provenance-backed floor can be easier to certify than complete finite-ensemble membership.
- **UNTESTED:** historical priority and the availability of trustworthy floors for real Hush contexts.

## CONSEQUENCE ledger

Hush can expose a fourth accounting contract:

1. exact trace-envelope FER-PCC under a certified finite ensemble;
2. the new sharp floor-certified charge under an externally certified floor;
3. `log2(n-k+1)` when only finite support is certified;
4. deny when none applies.

`src/floor-certified-branch-charge.js` implements the law and rejects invalid contracts. The runtime must never estimate `lambda` from the private transcript.

## Reproduce

```bash
python3 research/pcc-runtime-product/verify_floor_certified_branch_bound.py --max-n 7 --max-denominator 18 --output /tmp/result.json
python3 research/pcc-runtime-product/audit_floor_certified_branch_bound.py /tmp/result.json --output /tmp/audit.json
node --test test/floor-certified-branch-charge.test.js
npm test
```

## Limitations

This is not differential privacy, semantic-leakage protection, or validation of a real prior. A false floor certificate can make the charge unsafe. It covers deterministic finite branches and one realized min-entropy measure, not timing or covert channels. Historical novelty requires expert primary-literature review.
