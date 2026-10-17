# Finite-ensemble robust PCC — preregistration

Status: **FROZEN BEFORE OUTCOMES**

Active kernel: can Hush enforce a sharp cumulative disclosure-risk budget under
prior uncertainty while permitting materially more useful numeric disclosures
than the universally sharp three-log fallback?

Action class: PRODUCT-TRANSLATION + DISCRIMINATION.

## Mechanism

A policy contract supplies a finite, provenance-backed ensemble `P` of
strictly positive priors over the same bounded numeric domain. For observed
branch `B`, define the nonnegative statewise charge

`T(p,B)=max(0, log2(max_B p / (max p * P_p(B))))`.

Finite-Ensemble Robust PCC (FER-PCC) charges

`E(P,B)=max_{p in P} T(p,B)`.

If the true prior is a member of the declared ensemble, `E` is an exact
fail-closed upper charge. This replaces a scalar mismatch envelope with a
structured uncertainty set.

## Mandatory controls

1. true oracle `T`;
2. distribution-free cardinality `C=log2(n/|B|)`;
3. nominal declared-center charge `N`;
4. universally sharp fallback
   `U=max(0,L(h,B)+3log2(rho(P,h)))`;
5. exact finite-ensemble charge `E`.

The universal coefficient remains 3; the previous tightness result prohibits
changing it.

## Frozen untouched prior families

For domain sizes `n in {8,16,32}`, construct these deterministic ensembles.
All probabilities receive floor `1e-9` and are renormalized.

1. **Translated Gaussian:** centers at
   `{0.25,0.375,0.5,0.625,0.75}*(n-1)`, sigma `0.16n`;
   declared center is the middle member.
2. **Exponential tilt:** slopes `{-1,-0.5,0,0.5,1}` over coordinates scaled
   to `[-1,1]`; declared center is slope 0.
3. **Two-mode mixture:** equal-variance Gaussian mixtures centered at
   `(0.25,0.75)*(n-1)`, sigma `0.10n`, with left-mode weights
   `{0.1,0.3,0.5,0.7,0.9}`; declared center has weight 0.5.
4. **Adversarial mass-splitting control:** explicit members derived from the
   three-log tightness construction and its declared prior, embedded without
   opening any external holdout. It is a worst-case stress control, not a
   realistic-frequency claim.

No family parameters may be changed after outcomes.

## Frozen branch tasks and budgets

Enumerate every nonempty proper contiguous interval `[a,b]` in each numeric
domain. These include threshold prefixes/suffixes and range predicates, matching
Hush's analyzable bounded-numeric contract class.

Decision budgets in bits:
`[0,0.25,0.5,1,2,4]`.

For every ensemble, possible true member, branch and budget, record false-safe
(allowed while oracle denies), false-deny (denied while oracle allows), and
correctly allowed decisions.

## Preregistered prediction and success gates

PASS requires:

1. exact normalization and positivity;
2. `E>=T` for every possible ensemble member and branch;
3. `U>=T` for every possible member and branch;
4. zero FER-PCC false-safe decisions at every budget;
5. zero universal-fallback false-safe decisions at every budget;
6. FER-PCC false denials strictly below the universal fallback for every
   structured family;
7. at least 30% aggregate false-denial reduction for FER-PCC versus universal
   fallback in at least two of the three structured families;
8. exact agreement between two independently written aggregators;
9. byte-identical complete reruns.

Cardinality and nominal failures do not fail the study; they are controls.

## Strongest alternative explanation

Safety is conditional on ensemble coverage. FER-PCC does not detect an
out-of-ensemble true prior; its advantage may simply exchange universal
robustness for a stronger contract assumption. The result must therefore report
the coverage assumption prominently and preserve the universal fallback when
provenance or ensemble membership is unavailable.

## Project-relevance threshold and kill condition

The mechanism counts as Hush progress only if it preserves zero unsafe allows
on all frozen structured families while materially reducing conservative
denials, and yields an executable deterministic charge/receipt implementation.

Kill or reformulate FER-PCC if it has any unsafe allow, fails independent
aggregation, or does not reduce false denial by 30% in at least two structured
families.

## Evidence boundary

This is a prospective synthetic structured-prior study. It is not external user
evidence, live shift certification, semantic privacy, an OCELOT reproduction,
or historical-novelty evidence.
