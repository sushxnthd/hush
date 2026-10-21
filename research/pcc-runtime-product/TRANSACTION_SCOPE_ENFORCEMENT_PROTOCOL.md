# Frozen protocol: transaction-scope enforcement

## Active kernel

- **Precise question.** Can the missing transaction-wide authorization input be
  converted into a fail-closed production-broker mechanism that rejects the
  frozen parity attack before adapter execution while preserving ordinary and
  identity-authorized action utility?
- **Best-known frontier.** The exact finite-map theorem and checker establish
  that local scope `A` composes under global scope `G` iff every `G`-fiber is
  contained in an `A`-fiber. The preceding paired attack proved that the current
  `ActionBroker` cannot enforce this law because it receives neither scope.
- **Exact objective.** Add trusted transaction registration, bind immutable
  global and local scope commitments into each ticket and receipt, and rerun an
  exact factorization check immediately before side effects.
- **Strongest alternative explanation.** Adding metadata only decorates traces;
  it does not prevent adapter execution, or it breaks legitimate unscoped and
  identity-authorized actions.
- **Cheapest decisive falsification.** Any parity-protected coordinate call
  reaches the adapter, any identity-authorized coordinate call is rejected, or
  a changed/replayed transaction or local commitment executes.
- **Mechanism-derived unseen prediction.** Reversing coordinate order changes
  the first rejected action but not the pre-dispatch rejection rate; replacing
  the protected parity scope with identity permits both actions without changing
  their ordinary results.
- **Publishable threshold.** End-to-end paired production tests, commitment
  mismatch and replay adversaries, unchanged ordinary broker behavior, exact
  artifacts reproduced twice, independent checker, full regression and CI,
  priority/non-novelty boundary, and explicit limitations.
- **Project-consequence threshold.** A usable broker contract that closes the
  demonstrated gap and becomes the mandatory path for cumulatively authorized
  transactions.
- **Kill condition.** The gate is post-dispatch, can be bypassed by mutation or
  replay, requires exposing raw authorization maps to AI callers, or causes
  ordinary unscoped broker regressions.

## Frozen mechanism

1. Trusted local code registers a transaction id, finite world ids, and global
   authorization map. The broker stores a private clone and publishes only a
   canonical commitment.
2. Trusted adapter registration may bind each supported action to a local
   authorization map.
3. A scoped request names the transaction id. The broker snapshots the local
   scope and binds transaction id plus both commitments into the request hash.
4. Immediately before credential resolution or adapter execution, the broker
   verifies the transaction and commitments and runs the exact factorization
   check. Failure is denied and receipted without dispatch.
5. Transaction closure invalidates every outstanding scoped ticket.

Unscoped calls remain backward-compatible. This mechanism protects only calls
explicitly placed in a registered transaction and relies on trusted local scope
declarations; those boundaries must remain visible in the final claim.

## Frozen gates

| Case | Expected result |
|---|---|
| Identity-global `read_x`, `read_y` | 2 allows, 2 dispatches |
| Parity-global `read_x`, `read_y` | first call denied, 0 dispatches |
| Parity-global reversed order | first call denied, 0 dispatches |
| Transaction closed after approval | denied before dispatch |
| Adapter scope changed after approval | commitment mismatch, denied |
| Ordinary unscoped action | unchanged allow behavior |

No thresholds may be changed after observing results.
