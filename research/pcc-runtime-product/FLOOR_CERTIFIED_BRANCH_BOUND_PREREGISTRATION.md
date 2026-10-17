# Floor-certified branch bound: preregistration

**Status:** FROZEN BEFORE ENUMERATION  
**Program:** HUSH  
**Kernel:** robust cumulative disclosure accounting under externally certified prior shift

## Precise question

For an (n)-state secret, an observed deterministic branch (B) of size (k), and a prior (p) satisfying the externally certified floor (p_i \ge \lambda) for every state, is the exact worst-case realized statewise min-entropy charge

[
\sup_p L(p,B)=
\log_2\!\left(
\frac{n-k+1}
{1+(k-1)(n-k)\lambda}
\right),
\qquad 0\le\lambda\le 1/n,
]

where

[
L(p,B)=\max\left(0,
\log_2\frac{\max_{i\in B}p_i}
{\max_i p_i\,P_p(B)}
\right)\right)?
]

## Mechanism

A certified floor prevents the (k-1) nonmaximal branch states from being
driven to zero. The conjectured extremizer assigns mass (lambda) to those
states and equal heavy mass

[
m=\frac{1-(k-1)\lambda}{n-k+1}
]

to one state inside the branch and every state outside it. The claimed factor
is (1/[m+(k-1)\lambda]).

## Preregistered predictions

1. The displayed bound is never violated.
2. The displayed construction attains equality for every valid (n,k,\lambda).
3. The factor is nonincreasing in (k) and (lambda).
4. It equals (n-k+1) at (lambda=0).
5. It equals one at (lambda=1/n).
6. A separately written checker exactly agrees on all aggregates.
7. Two complete runs are byte-identical.
8. A production function fails closed for invalid (n,k,\lambda) and returns
   the exact endpoint values.

## Frozen search

- Exhaust all rational priors for (2\le n\le7) with common denominator
  (D\le18).
- For every nonempty branch and every floor on the same rational grid, compare
  the exact rational factor against the formula.
- Verify the closed-form extremizer through (n=128).
- Record all violations, equality misses, monotonicity failures, and maximum
  numerical residual. No failing case may be removed.

## Strongest alternative explanation

The floor may not determine a sharp bound; a configuration with a larger
outside maximum than branch maximum, or asymmetric outside masses, may exceed
the proposed equal-heavy construction.

## Publishable success condition

An exact proof plus zero counterexamples in the frozen exhaustive domain,
independent recomputation, deterministic artifacts, and a runtime
implementation whose contract is explicitly conditional on an externally
certified floor.

## Project-relevance threshold

The result must strictly improve the existing prior-free fallback for every
(1<k<n) and (0<\lambda<1/n), and must change HUSH's accounting contract to
support a floor-certified intermediate mode.

## Kill condition

Any valid counterexample to the displayed formula, failure of equality
construction, independent-check disagreement, nondeterministic artifact, or
runtime endpoint failure kills the claimed sharp law. A proof alone does not
establish historical novelty.

## Claim boundary

This concerns deterministic finite branches and realized statewise
min-entropy. It is not differential privacy, semantic-leakage protection,
prior-floor validation, or a guarantee against malicious provenance, timing,
or covert channels. The floor must be certified independently of the private
transcript.
