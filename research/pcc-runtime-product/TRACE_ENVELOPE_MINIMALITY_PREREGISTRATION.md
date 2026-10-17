# Trace-envelope minimality — preregistration

**Frozen before execution:** 2026-10-14  
**Active HUSH kernel:** cumulative disclosure accounting under adaptive finite-ensemble risk

## Precise question

Is the trace-bound ledger `A_t = max_{p,s<=t} R_p(s)` merely sometimes more useful than
the independent-step ledger, or is it the pointwise least possible prefix-safe ledger for the
realized finite-ensemble risk matrix—making utility routing unnecessary inside this model?

## Hypothesis and mechanism

Call a scalar ledger `L_t` prefix-safe when it is nondecreasing and upper-bounds every realized
member risk `R_p(s)` for `s<=t`. Then `A_t` is the pointwise minimum of this entire class because
every safe ledger must upper-bound the maximum it contains.

For `Q_t = sum_{j<=t} max_p (R_p(j)-R_p(j-1))_+`, with `R_p(0)=0`, the prior proof gives
`A_t<=Q_t`. The new prediction is an exact decision law. For any member oracle
`O_p=max_s R_p(s)` and budget `b`,

`FD_Q(p,b)-FD_A(p,b) = 1[A_t <= b < Q_t]`,

where `FD_L(p,b)=1[L_t>b and O_p<=b]`. Thus all utility separation is determined by the
tie-invariant scalar gap interval `[A_t,Q_t)`, not by the identity of an argmax member.

## Preregistered tests

1. Exhaust every risk matrix with 1–3 members, 1–3 disclosed steps, initial zero, and risk values
   in `{0,1,2,3}`.
2. Test every prefix and budgets `{0,0.5,...,3.5}` for safety, `A<=Q`, minimality against all
   integer-valued safe monotone ledgers, and the exact false-denial identity.
3. Independently implement the algebra without importing the primary verifier.
4. Add an online HUSH ledger that keeps one scalar state for `A`; compare it with a reference
   batch calculation and with an independent-step implementation that retains the prior risk vector.
5. Re-evaluate the previously opened trace families only as development evidence. No opened family
   is presented as fresh confirmation.

## Gates

**PASS** requires zero exhaustive counterexamples, independent agreement, online/batch equality on
every enumerated prefix, zero unsafe allows relative to the specified ensemble, and explicit
abstention on invalid/nonfinite inputs. Any counterexample kills the minimality claim.

## Strongest alternative explanation

`A<=Q` may hold while the claimed decision difference fails for member-specific oracle risks, or an
online implementation may require hidden history/state that removes the product advantage.

## Claim boundary

Safety is conditional on the supplied finite ensemble and risk definition. This study cannot prove
ensemble coverage, semantic privacy, robustness to a malicious risk model, or protection against
timing/covert channels. It does not make the trace ledger universally applicable outside that scope.

## Project consequence threshold

On PASS, retire switch-potential routing. HUSH should use the minimal trace envelope whenever a
versioned finite ensemble is certified, and route/abstain only on ensemble validity or unsupported
data—not on predicted utility. On FAIL, retain the simpler independent-step ledger.
