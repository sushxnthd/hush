# Trace-bound adaptive FER-PCC — preregistration

Status: **FROZEN BEFORE OUTCOMES**

Active Hush kernel: sharp cumulative disclosure-risk budgeting under adaptive
bounded-numeric interactions.

Action class: MECHANISM + PRODUCT-TRANSLATION + DISCRIMINATION.

## Exact mechanism

Let `P` be a finite covering ensemble of initial priors. An adaptive
deterministic transcript induces nested feasible sets
`S_0 superset S_1 ... superset S_t`.

For member `p`, define realized prefix risk

`R_p(s)=max(0, H_inf(p)-H_inf(p | S_s))`.

Define the Trace-Bound Ensemble Ledger

`A_t = max_{p in P} max_{0<=s<=t} R_p(s)`.

The runtime increment at step t is `A_t-A_(t-1)`.

Preregistered theorem:

1. `A_t` is nondecreasing.
2. cumulative increments telescope exactly to `A_t`;
3. `A_t >= R_p(s)` for every covered member and every observed prefix;
4. the independent-step control
   `Q_t=sum_j max_p max(0,R_p(j)-R_p(j-1))`
   satisfies `Q_t>=A_t`.

Thus trace-bound accounting is prefix-safe while preventing the worst-case prior
from changing independently at every step.

## Strongest controls

1. true-member prefix oracle;
2. trace-bound ensemble ledger `A_t`;
3. independent-step ensemble ledger `Q_t`;
4. distribution-free cardinality ledger;
5. nominal-center posterior ledger;
6. universally sharp three-log incremental fallback;
7. static per-item permission cap.

## Frozen untouched prior families

At domains `n in {16,32,64}`:

1. **Laplace location:** centers
   `{0.2,0.35,0.5,0.65,0.8}(n-1)`, scale `0.12n`.
2. **Power tilt:** positive coordinate weights
   `(i+1)^a`, `a in {-2,-1,0,1,2}`.
3. **Variance family:** centered Gaussians with sigma
   `{0.06,0.10,0.16,0.24,0.36}n`.

Apply floor `1e-12` and normalize. Middle member is the nominal control.

## Frozen adaptive task families

For every possible secret state:

1. **Bisection:** five adaptive midpoint comparisons, or until singleton.
2. **Tercile:** at each step query the lower third boundary, then the upper
   third boundary of the surviving interval; maximum five observations.
3. **Mode-chasing:** choose the threshold nearest the nominal posterior median,
   observe the branch containing the secret, update, and repeat for five steps.

All policies depend only on the public previous transcript and frozen nominal
prior, never on an unobserved secret except through the returned branch.

Budgets: `[0.25,0.5,1,2,3,4]` bits.

## Frozen predictions and gates

PASS requires:

1. positive normalized priors and nested nonempty traces;
2. zero trace-bound prefix-safety violations;
3. zero independent-step prefix-safety violations;
4. `Q_t>=A_t` for every trace prefix;
5. exact telescoping of trace-bound increments;
6. byte-identical reruns;
7. independent complete aggregate agreement.

Project-relevance success additionally requires:

8. strict `A_t<Q_t` on at least 10% of completed traces in at least two prior
   families;
9. at least 20% fewer false denials than independent-step accounting,
   aggregated over frozen budgets, in at least two prior families;
10. an executable deterministic adaptive ledger/receipt implementation.

If safety fails, the mechanism is killed. If safety passes but gates 8–10 fail,
the mechanism remains mathematically valid but does not count as Hush progress.

## Strongest alternative explanation

Any gain may arise only because the frozen ensemble is small or because realized
min-entropy can fall after mode exclusion. Report switching and negative-step
rates explicitly. Safety remains conditional on true-prior ensemble coverage.

## Claim boundary

This covers finite covering ensembles, deterministic bounded-numeric adaptive
queries and realized min-entropy prefix risk. It does not establish semantic
privacy, out-of-ensemble detection, historical novelty, live-provider utility
or stochastic-channel guarantees.
