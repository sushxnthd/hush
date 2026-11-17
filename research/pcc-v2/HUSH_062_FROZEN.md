# HUSH-062 | Frozen stale-writer authorization resurrection attack

Date: 2026-10-29. Bounded secondary workstream on existing `breakthrough-engine/transaction-scope-recovery-20261021` and draft PR #45. Preserve Lucent primary branch, PR #26 and hourly schedule. Freeze before attack test, patch or results.

## Hypothesis

HUSH-061 made broker completion reload durable authorization, but `_persistAuthorizationTransactions()` still writes each broker's entire **in-memory snapshot** using atomic rename. Two brokers can therefore overwrite a durably closed transaction with a stale open copy when the stale broker persists an unrelated transaction. Encryption, atomic rename and post-dispatch re-read do not protect against this rollback. A fresh broker can then authorize a private HTTP result against the resurrected transaction.

## Predeclared real-broker attack

1. Use a real encrypted authorization state file with 32-byte key, transaction `tx` and an authorization scope covering two synthetic private worlds.
2. Construct broker A and broker B while `tx` is open; verify B has a stale open copy.
3. Broker A durably closes `tx`. A fresh observer sees `closedAt != null`.
4. Broker B registers a different transaction `tx2`, invoking its current whole-map persistence.
5. **Prepatch prediction:** the encrypted file now contains `tx` reopened; a newly constructed broker C can request, approve and execute an authorized read through a real loopback HTTP adapter, returning a private bit and a private-dependent receipt. This is a deterministic stale-writer rollback, not a speculative nanosecond race.
6. **Postpatch prediction:** B's stale persistence is rejected before it can replace the durable state; C observes `tx` still closed and cannot request its action. A new broker that first loads the current durable state can still create `tx2` legitimately. Corrupt or missing state must fail closed.

## Narrow enforcement and remaining boundary

Before saving a durable transaction snapshot, reload current durable state and reject any attempt to remove a durable record, change an immutable commitment, or reopen a closed record. This is a deterministic rollback guard only; **not** cross-process compare-and-swap or linearizable revocation. Another writer can still change state after the read and before atomic rename. Preserve this limitation explicitly. Do not force-push, merge, claim deployment readiness or alter Lucent.

## Acceptance

Real ActionBroker + encrypted file + real local HTTP adapter, prepatch expected-counterexample and postpatch regression, distinct private bits, fresh-process durable observer where feasible. No public secrets, no external network effects. Keep production BLOCKED until a true linearizable store/lease, provider cancellation, crash/restart and external security review.
