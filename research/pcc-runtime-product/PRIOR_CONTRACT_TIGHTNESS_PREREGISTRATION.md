# Tightness of the multiplicative prior-contract certificate — preregistration

Status: **FROZEN BEFORE COMPUTATIONAL VERIFICATION**

Action class: SURPRISE + DISCRIMINATION.

## Provenance

The prior-contract study found no counterexample to the exploratory
`2 log2(rho)` candidate on its frozen small rational grid. Subsequent
adversarial continuous search motivated an analytic construction. This
document freezes that derived construction before its exact checker is run; it
is not represented as a prospectively invented theorem.

## Hypothesis

The universal coefficient 3 in

`|L(p,B)-L(h,B)| <= 3 log2(rho)`

cannot be replaced by any smaller universal coefficient.

For every integer `R>=2` and integer `N>R`, construct declared prior `h`
with two pointwise likelihood-ratio classes:

- low class: `p_i/h_i=1/R`, total declared mass `R/(R+1)`;
- high class: `p_i/h_i=R`, total declared mass `1/(R+1)`.

Choose a low-class global atom of mass `M=1/(2(R+1))`. The observed branch
contains `N` low-class atoms and one high-class atom, each of declared mass

`x=M/(2 R^2 N)`.

Split all remaining low-class mass into positive atoms no larger than `M`,
and all remaining high-class mass into positive atoms no larger than
`M/R^2`.

The construction predicts:

- the actual pointwise mismatch is exactly `rho=R`;
- `m_h/m_p=R`;
- `r_p/r_h=R`;
- `q_h/q_p=R(N+1)/(N+R^2)`;
- therefore
  `L(p,B)-L(h,B)=log2(R^3 (N+1)/(N+R^2))`;
- its normalized coefficient is
  `gamma=3+log_R((N+1)/(N+R^2))`;
- `gamma>2` iff `N>R`;
- `gamma -> 3` as `N -> infinity`.

Thus the earlier absence of a two-log counterexample is predicted to be a
finite-small-domain artifact.

## Frozen checks

1. Build the explicit smallest witness `R=2,N=3` using exact rational
   arithmetic.
2. Independently compute its true and declared branch charges from the full
   probability vectors.
3. Confirm `gamma>2`, the two-log bound fails, and the three-log bound holds.
4. For every `R=2..10` and
   `N in {R+1,2R,10R,100R,1000R}`, construct full rational priors and compare
   direct vector calculations with the closed form exactly where rational and
   within `1e-12` for logarithms.
5. Confirm monotonic approach toward 3 for each R.
6. Run an independently structured checker over the saved cases.
7. Require byte-identical primary reruns.

Any disagreement with the construction, threshold, monotonicity, or
independent checker is FAIL.

## Claim boundary

The result would establish mathematical tightness for deterministic branches,
strictly positive finite priors, pointwise multiplicative mismatch, and
realized statewise min-entropy. It would not establish historical novelty,
show that rho can be certified in practice, validate learned priors, cover
semantic or stochastic channels, or demonstrate external task utility.
