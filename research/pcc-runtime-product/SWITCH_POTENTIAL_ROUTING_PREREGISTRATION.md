# Switch-potential routing for trace-bound FER-PCC — preregistration

Status: **FROZEN BEFORE OUTCOMES**

Active Hush kernel: sharp cumulative disclosure-risk budgeting under adaptive bounded-numeric interactions.

Action class: DISCRIMINATION + PRODUCT-TRANSLATION.

## Question and mechanism

The prior frozen study found that the trace-bound finite-ensemble ledger `A`
was always prefix-safe and no larger than independent-step accounting `Q`, but
material false-denial reduction occurred in only one of three prior families.
Post hoc, family-level utility gain ordered with worst-member switching.

This study prospectively tests a diagnostic computable before any user secret
or transcript is observed. For each frozen ensemble/query configuration, build
the complete deterministic query tree over every possible secret. At each edge,
record the ensemble member attaining the largest positive one-step risk
increment. Define **switch potential** as the number of adjacent edge pairs on
root-to-leaf paths whose maximizer changes, divided by the number of eligible
adjacent edge pairs. Family switch potential is the unweighted mean across
domain sizes and query plans.

Frozen router:

* enable trace-bound accounting `A` iff family switch potential is at least
  `0.30`;
* otherwise retain the simpler independent-step ledger `Q`.

The threshold was fixed from the opened prior families (0.028, 0.468, 0.783)
before evaluating any family below. It is not tuned in this study.

## Frozen untouched families and query plans

Domains: `n in {24,48,96}`. Five strictly positive normalized members per
ensemble. Floors are `1e-12`.

Prior families, not used in the previous trace-bound experiment:

1. `student_location`: Student-t-like location shifts, centers
   `{0.15,0.325,0.5,0.675,0.85}(n-1)`, scale `0.10n`, 3 degrees of freedom.
2. `two_peak_weight`: two fixed Gaussian peaks at `0.25(n-1)` and
   `0.75(n-1)`, sigma `0.08n`, mixture weights `{0.1,0.3,0.5,0.7,0.9}`.
3. `geometric_ratio`: weights proportional to `r^i`, with
   `r in {0.90,0.95,1.0,1.05,1.10}`.
4. `cosine_phase`: weights proportional to
   `exp(1.2 cos(2 pi i/n - phi))`, with five evenly spaced phases.

Query plans, also new to this experiment:

1. `golden_alternating`: alternate 0.382 and 0.618 interval cuts.
2. `posterior_tertile`: alternate nominal-posterior 1/3 and 2/3 mass cuts.
3. `center_out`: alternate cuts at the first and third quartile of the
   surviving interval.

Budgets: `[0.25,0.5,1,2,3,4]` bits. All `n` secrets are exhaustively evaluated.

## Frozen predictions and gates

For each family, let gain be `(FD_Q-FD_A)/FD_Q`, aggregated over all frozen
budgets, members, sizes and query plans.

Diagnostic PASS requires all of:

1. at least one routed-high and one routed-low family;
2. every routed-high family has gain at least 20%;
3. every routed-low family has gain at most 10%;
4. balanced classification accuracy is at least 0.75 when material gain is
   defined as gain at least 20%;
5. Spearman rank correlation between switch potential and gain is at least
   0.8;
6. zero prefix-safety, dominance, normalization or determinism violations;
7. an independently written audit exactly agrees on family potentials, false
   denials, gains, routing decisions and gates.

If gates 1–5 fail, the prospective switch-potential router is killed rather
than retuned. If safety fails, the trace-bound mechanism itself is downgraded.

## Strongest alternative explanations

Budget placement, ensemble spread, nominal-policy alignment, or merely having
different modal locations may explain both switching and utility. The four
families deliberately separate location, mixture weight, monotone tilt and
periodic phase geometry, but this remains a finite synthetic test.

## Project consequence

A pass licenses a deterministic Hush preflight rule selecting the trace-bound
ledger only where its additional state is prospectively justified. A failure
kills automatic conditional routing on switch potential; trace-bound FER-PCC
remains an opt-in safe primitive, not a default policy.

## Claim boundary

This is finite-ensemble, discrete-secret, deterministic-query accounting for
realized min-entropy risk. It does not establish semantic privacy, stochastic
channel guarantees, out-of-ensemble safety, historical novelty, or live-user
utility.
