# Distribution-free branch bound and coverage impossibility — preregistration

**Classification:** EXACT THEOREM / CAPABILITY-BUILDING  
**Active HUSH kernel:** finite-ensemble applicability under prior shift

## Precise question

When Hush cannot externally certify that the true prior belongs to a declared
finite ensemble, what is the least distribution-free charge that remains safe
for a deterministic observed branch? Can the released transcript itself ever
certify ensemble coverage?

## Candidate theorem

Let a secret have `n` states, let `B` be a nonempty observed branch of size
`k`, and let `p` be any prior. Write

```
m = max_i p_i
q = sum_{i in B} p_i
r = max_{i in B} p_i
L(p,B) = max(0, log2(r/(m q))).
```

Preregistered claim:

```
sup_p L(p,B) = log2(n-k+1).
```

For priors allowing zero mass the bound is attained. For strictly positive
priors it is the sharp supremum approached by assigning equal heavy mass to
one state in `B` and all `n-k` states outside `B`, then sending the other
`k-1` branch masses to zero.

The companion impossibility claim is that deterministic transcript data alone
cannot certify membership in a finite prior ensemble: if a secret state is
consistent with a transcript, any covered or uncovered prior assigning it
positive mass produces the same transcript for that state.

## Exact proof target

Put `a=q/r >= 1` and `b=m/r >= 1`. For `n-k>0`, total mass obeys

```
1 <= q + (n-k)m = r(a+(n-k)b).
```

Consequently

```
r/(m q) = 1/(a b r)
          <= (a+(n-k)b)/(a b)
          = 1/b + (n-k)/a
          <= n-k+1.
```

The full-domain case has charge zero. The verifier must independently test the
inequality directly, not assume this sketch.

## Frozen falsification protocol

1. Enumerate every positive integer-composition prior for `n=2..7` and total
   denominator `n..16`.
2. Enumerate every nonempty branch (including the full domain).
3. Compare the exact rational ratio `r/(m q)` with `n-k+1`; logs are used only
   for reported examples.
4. Check the zero-mass extremizer for every `(n,k)` through `n=64`.
5. Check a strictly-positive convergence family at predetermined
   `delta=2^-j`, `j in {8,12,16,20}`, for every `(n,k)` through `n=32`.
6. Construct a minimal transcript-indistinguishability counterexample showing
   an ensemble-safe charge can understate an uncovered prior's charge.
7. Reimplement the bound/audit independently and require exact aggregate
   agreement plus byte-identical rerun.

## Gates

All must pass:

1. zero exact upper-bound violations;
2. every zero-mass extremizer attains `n-k+1` exactly;
3. every positive convergence sequence is monotone toward the bound and its
   final gap is below `1e-4` bits;
4. the frozen transcript counterexample is observationally identical while
   the uncovered charge exceeds the ensemble charge;
5. `log2(n-k+1) >= log2(n/k)` for every enumerated `(n,k)`, with equality only
   at `k=1` or `k=n`;
6. independent audit and deterministic rerun pass.

## Strongest alternative explanation

The law may be an elementary restatement of a known min-entropy leakage bound
and therefore not historically novel. Even if exact, it can be too
conservative for product utility. Transcript indistinguishability does not
rule out coverage certificates based on trusted provenance, held-out samples,
or external monitoring.

## Project consequence / kill condition

- **PASS:** Hush must never infer finite-ensemble coverage from the disclosure
  transcript. Add `log2(n-k+1)` as the exact prior-free fail-closed branch
  fallback and require external provenance for the tighter ensemble ledger.
- **FAIL:** do not add the fallback; retain the existing universal certificate
  or denial and preserve the minimal counterexample.

