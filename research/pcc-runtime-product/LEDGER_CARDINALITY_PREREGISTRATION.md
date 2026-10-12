# PCC ledger-cardinality equality oracle — frozen protocol

## Hypothesis

Hiding scalar digests is insufficient if public diagnostics preserve the number
of internal PCC ledgers. Because current PCC identity is derived from the
recovered scalar value, two equal-valued private fields share one ledger while
two unequal fields create two. Diagnostic row count may therefore reveal
private equality.

## Mechanism and frozen differential

- World A stores two distinct trusted fields with values `(500, 500)`.
- World B stores the same fields with values `(500, 501)`.
- Both use the same declared domain `0..1023` and the same balanced comparison
  `value <= 511`.
- Prepare one registered comparison for each field.
- Observe only the public `partitionExposure()` interface; do not inspect the
  encrypted store, raw scalar digest, or internal firewall snapshot.

The public contracts, query sequence, domains, consent state, and starting
diagnostic state are identical between worlds.

## Preregistered prediction

Current scalar-value identity will yield one public `pcc:derived` row in World
A and two in World B. If so, an observer learns whether the two private values
are equal without approval or release.

The gate is **FAIL** if public diagnostic cardinality distinguishes the worlds.
Otherwise it is **PASS**.

## Prospective correction prediction

Collapsing all internal PCC ledger diagnostics into one conservative public
summary should make both worlds observationally identical while leaving
internal per-scalar composition accounting unchanged. Existing posterior
enforcement and the 306-test repository suite must continue to pass.

## Boundary

This tests an authenticated local diagnostic surface and two trusted bounded
integer fields. It is not evidence of remote model/provider disclosure, and it
does not establish semantic privacy or protection from a compromised runtime.
