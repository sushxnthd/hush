# Trace-bound adaptive FER-PCC: frozen result

Status: **FAIL (project-relevance gate)**. The accounting theorem and all safety gates passed; the preregistered cross-family utility threshold did not.

## Smallest supported claim

For a finite prior ensemble \(\mathcal P\), a nested transcript \(S_0 \supseteq \cdots \supseteq S_t\), and member risk

\[
R_p(s)=\max\{0,H_\infty(p)-H_\infty(p\mid S_s)\},
\]

the trace-bound ledger

\[
A_t=\max_{p\in\mathcal P}\max_{0\le s\le t}R_p(s)
\]

is prefix-safe and nondecreasing, and its increments telescope exactly. The independent-step control

\[
Q_t=\sum_{j=1}^{t}\max_{p\in\mathcal P}\max\{0,R_p(j)-R_p(j-1)\}
\]

satisfies \(Q_t\ge A_t\). This can make \(A_t\) strictly less conservative, but the utility improvement is not broad across the three frozen unseen prior families.

Proof sketch: monotonicity and telescoping follow from the running maximum definition. For any \(p,s\), \(R_p(0)=0\), so \(R_p(s)\) is at most the sum of its positive prefix increments, which is at most \(Q_s\le Q_t\). Taking the maximum over \(p,s\le t\) gives \(A_t\le Q_t\).

## Frozen evaluation

The preregistration fixed three previously untested prior families (Laplace location shifts, power tilts, centered variance shifts), domain sizes 16/32/64, three adaptive query strategies, five observations, and six budgets. The study covered 27 configurations and 1,008 secret traces. All comparisons count decisions over every ensemble member and budget.

| Prior family | Traces | Worst-member switch rate | Strict \(A<Q\) traces | False denials: \(Q\) | False denials: \(A\) | Reduction | False-safe: \(A\) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Laplace location | 336 | 78.34% | 100.00% | 2,005 | 695 | 65.34% | 0 |
| Power tilt | 336 | 2.85% | 0.00% | 2,903 | 2,903 | 0.00% | 0 |
| Variance family | 336 | 46.79% | 74.11% | 1,238 | 1,058 | 14.54% | 0 |

Safety gates all passed: positive normalized priors, trace-prefix safety, independent-prefix safety, \(Q\ge A\), and telescoping. The preregistered structural gate (strict gap on at least 10% of traces in at least two families) passed. The project-relevance gate (at least 20% false-denial reduction in at least two families) failed: only Laplace passed.

## Failure mining and boundary

The broad hypothesis that trace binding gives material utility across varied prior families is **falsified for this frozen study**. The descriptive ordering is sharp: high worst-member switching coincided with large gain (Laplace), near-invariance with zero gain (power tilt), and an intermediate regime with a sub-threshold gain (variance). This is a post-hoc mechanism clue, not a confirmed law. Negative member-level risk increments alone do not explain the pattern: power tilt had the highest negative-step rate yet no gain.

Strongest alternative explanations are ensemble geometry, budget placement, and query/nominal-prior alignment. They remain unresolved.

## Two ledgers

### SCIENCE

- **KNOWN:** \(A_t\) is prefix-safe, monotone, telescoping, and never exceeds \(Q_t\); verified independently on all 27 frozen configurations.
- **FALSIFIED:** broad, cross-family material utility under the preregistered threshold.
- **ANOMALOUS:** utility gain tracks worst-member switching across the three tested families.
- **UNTESTED:** a prospective switch-potential diagnostic predicts whether trace binding materially improves decisions on new prior/query families.

### CONSEQUENCE

- Do not enable trace-bound accounting as a universal Hush runtime policy on this evidence.
- Preserve it as a safe conditional accounting primitive.
- The cheapest decisive next experiment is to freeze a pre-execution switch-potential diagnostic from only the ensemble and query plan, then test whether it separates high-gain from no-gain regimes on unseen families. Failure should kill conditional product routing; success would justify an automatic runtime choice between \(A_t\) and simpler accounting.

## Reproduction and provenance

```bash
python3 verify_trace_bound_adaptive_fer_pcc.py --output trace_fer.json
python3 audit_trace_bound_adaptive_fer_pcc.py trace_fer.json
sha256sum trace_fer.json
```

- Preregistration commit: `83da6aab9bca39f64e1f24c2440e93de2ceba547`
- Frozen result SHA-256: `1db36e900dfb7345bc6027d512e6d95f625d664ce093e1c2de48310a0955574b`
- Canonical payload SHA-256: `563ab04d89913098e9a14198186bbadb40f36c459ea94cff064b50900ddbbe0d`
- Independent audit: PASS, 27/27 configurations, zero disagreements
- Audit rows SHA-256: `9025e5841ceae61eac70380af76bc9782db6c206a7f1e926e6146ba1fe87b110`
- Python: 3.11.8 (recorded in the frozen JSON)

## Limitations

This is a finite-ensemble, synthetic, discrete-secret study with at most five observations. Safety is relative to the specified ensemble and realized min-entropy-risk metric; it is not a universal privacy guarantee. The study is not external validation, and the post-hoc switching pattern requires prospective testing.
