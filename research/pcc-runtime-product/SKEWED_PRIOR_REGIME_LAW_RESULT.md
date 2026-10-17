# Skewed-prior cardinality/min-entropy regime law — result

## Exact supported claim

**PASS.** For a finite prior `p` on feasible state `S` and deterministic
observed branch `B`, let:

- `n = |S|`, `k = |B|`;
- `m = max_S p(s)`, `q = P(B)`, `r = max_B p(s)`;
- `alpha = n m`, the prior's global concentration relative to uniform; and
- `beta = k r / q`, the branch's internal concentration relative to uniform.

Then the exact gap between PCC cardinality charge `C` and realized statewise
min-entropy reduction `L` is

`C - L = log2(alpha / beta)`.

This gives three sharp regimes:

| Exact condition | PCC versus statewise min-entropy | Interpretation |
|---|---|---|
| `alpha > beta` | `C > L` | cardinality overcharges |
| `alpha = beta` | `C = L` | exact equivalence |
| `alpha < beta` | `C < L` | cardinality undercharges |

The previous uniform-prior identity is the special case `alpha = beta = 1`.
The important surprise is that cardinality accounting is **not always
conservative** under skewed priors: both overcharge and undercharge regimes
exist.

## Proof

Cardinality charge is `C = log2(n/k)`. Prior statewise min-entropy is
`-log2(m)`. After observing `B`, the largest posterior probability is `r/q`, so
the realized reduction is `L = log2(r/(m q))`. Therefore

`C - L = log2(n m q / (k r)) = log2(alpha / beta)`.

The regime classification follows from monotonicity of `log2`.

## Exhaustive verification

The frozen verifier enumerated every ordered positive rational prior with
denominator `d = n..12`, for `n = 2..7`, and every nonempty proper branch.

| Check | Result |
|---|---:|
| Rational priors | 3,289 |
| Prior/branch cases | 189,222 |
| Decomposition disagreements | 0 |
| Exact-sign disagreements | 0 |
| Uniform-case disagreements | 0 / 388 |
| Singleton-corollary disagreements | 0 / 17,820 |
| Maximum numerical error | 4.44e-16 |

All three regimes appeared: 161,635 overcharge, 7,246 equality and 20,341
undercharge cases. These counts describe only the frozen enumeration and are
not population frequencies.

## Minimal enumerated examples

| Regime | Prior | Observed branch | `C` bits | `L` bits | `C-L` bits |
|---|---|---|---:|---:|---:|
| Equality | `(1/2, 1/2)` | `{0}` | 1.000000 | 1.000000 | 0.000000 |
| Overcharge | `(1/3, 2/3)` | `{0}` | 1.000000 | 0.584963 | +0.415037 |
| Undercharge | `(1/5, 2/5, 2/5)` | `{0,1}` | 0.584963 | 0.736966 | -0.152003 |

For every singleton branch, `beta = 1`; hence the exact gap is
`log2(n m)`, the prior's min-entropy deficit from uniform. This corollary passed
all 17,820 enumerated singleton cases.

## Evidence integrity

All preregistered mathematical and exhaustive gates passed. Two complete runs
were byte-identical. Result file SHA-256:
`f42b8bd8284ee50be1d5926c38386a6dc149653f9bd57466ebe3e7786ba724f3`.
Canonical payload digest:
`99986328104dbd0186195fb8695fbcdd912327dfd7406fd5b89415d5a817c170`.

## Product and HAA implication

Uniform cardinality is a defensible distribution-free policy choice, but it
must not be described as equivalent to calibrated posterior risk outside the
uniform regime. When `alpha > beta`, it may deny useful low-risk disclosures;
when `alpha < beta`, it may permit disclosures whose statewise min-entropy
reduction is larger than the charged cardinality amount.

The next product-level discriminator is therefore a prior contract: either
retain explicitly conservative distribution-free cardinality semantics, or
introduce calibrated priors with provenance, shift detection and fail-closed
fallback. The law gives an exact oracle for testing that choice.

## Reproduce

```bash
python3 research/pcc-runtime-product/verify_skewed_prior_regime_law.py \
  --max-domain 7 \
  --max-denominator 12 \
  --output /tmp/skewed-prior-regime-law.json
sha256sum /tmp/skewed-prior-regime-law.json
```

## Limitations and gate status

This is an elementary exact decomposition plus finite exhaustive verification,
not a claim of historical mathematical novelty. It covers strictly positive
rational priors, deterministic set-valued releases and one realized
min-entropy definition. It does not validate learned priors, semantic candidate
quality, stochastic channels, OCELOT's calibrated operator bounds, MNC's scope
monitor, external task utility or named-system superiority.

The Hush breakthrough gate remains **INCONCLUSIVE**. The result is a precise
mechanism/regime law and a new product-design oracle, not a field-level
breakthrough.
