# PCC value-identity authorization oracle — frozen protocol

## Hypothesis

Collapsing public diagnostic rows does not remove the deeper equality channel
created by value-derived privacy-ledger identity. If two distinct private fields
happen to hold the same scalar, their predicates compose in one ledger; if they
differ, the same predicates use separate ledgers. Result-independent branch
authorization may therefore return different public decisions even when every
released predicate result is identical.

## Frozen differential

- World A stores fields `(a,b)=(500,500)`.
- World B stores fields `(a,b)=(500,501)`.
- Both fields declare integer domain `0..1023`.
- First release: `a >= 500`; both worlds release `true` after one approval.
- Second preparation: `b <= 501`; the actual result is `true` in both worlds.
- Observe the second public preparation decision only.
- Consent, agents, sinks, contracts and query sequence are otherwise identical.

## Preregistered prediction

In World A, value-derived identity reuses the posterior left by the first query.
The feasible true branch of the second query leaves only `{500,501}` and exceeds
the eight-bit limit, so preparation is denied. In World B, field `b=501` gets a
fresh ledger; both branches are safe, so preparation returns `ask`.

The gate is **FAIL** if the second decision distinguishes equality despite both
actual predicate results being `true`. Otherwise it is **PASS**.

## Prospective mechanism boundary

If the prediction holds, no result-independent presentation layer can repair
value-derived coalescing: authorization itself depends on a private equality
relation. A correction must use a public structural composition identity—such
as an explicit trusted privacy group—rather than recovered scalar equality.

## Boundary

This tests two trusted local bounded-integer fields and an authenticated agent
interface. It assumes contracts may intentionally declare aliases, but it is
not a malicious-contract or remote arbitrary-query exploit.
