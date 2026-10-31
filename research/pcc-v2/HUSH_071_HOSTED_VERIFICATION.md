# HUSH-071 | Independently hosted real-broker provider lifecycle verification

Date: 2026-10-31. Secondary Hush workstream on the established `breakthrough-engine/transaction-scope-recovery-20261021` branch, draft PR #45. This is **verification of already frozen HUSH-069/070 experiments**, not a newly invented information-flow theorem, production patch or external provider assessment. The primary Lucent E002-371 experiment was not modified by this work.

## Evidence newly checked on the exact hosted jobs

1. [HUSH-069 CI 41150659444](https://github.com/sushxnthd/hush/actions/runs/41150659444), head `c0236d9`, **completed success** on Ubuntu, macOS and Windows. Each job ran **5/5 actual repository ActionBroker / separate-process HTTP provider tests**: stale authorization resurrection; shared-lock revoke-before-commit prevention; commit-before-revoke ordering; crashed waiting replica; and orphan-lock fail-closed availability. Each OS additionally completed the independent Python event-order replay of **7 sanitized histories** (not seven independent human/provider samples). Three OS repetitions are reproducibility checks, not independent security review.
2. [HUSH-070 CI 41164411945](https://github.com/sushxnthd/hush/actions/runs/41164411945), head `0dbe434`, **completed success** on Ubuntu, macOS and Windows. Each job ran **4/4 actual repository ActionBroker / real loopback provider process tests**: post-effect lost acknowledgement with naive retry (2 effects), provider-side idempotent retry (1 effect), normal guarded repeat (1 effect), and invalid operation key rejection (0 effects). The Linux job log explicitly records `# tests 4`, `# pass 4`, `# fail 0`.

**Verified scope:** 6 successful OS jobs, 27 Node test executions (9 distinct test scenarios repeated on three operating systems), and 3 successful HUSH-069 independent replay invocations. No live third-party API, real user credentials, production provider, OS egress sandbox, network partition, adversarial provider or external security reviewer was tested. The local fixture's single-file idempotency ledger is not a proof of atomic external effects or fsync durability.

## Scientific / enforcement interpretation

The hosted tests independently reproduce two classical distributed-system failure boundaries: (a) revocation can be lost between stale provider authorization read and irreversible effect, and (b) effect commit can succeed while its acknowledgement is lost, making blind retry unsafe. Their conjunction requires a *provider-enforced*, serializable authorization epoch and a durable operation identity whose scope and commit semantics survive crash/restart. These are necessary conditions for a narrow real-effect guarantee, **not sufficient conditions for full runtime observable noninterference**.

The broker must return `UNKNOWN_COMMIT_STATE` or require reconciliation when it cannot verify provider idempotency/commit ordering; never claim no effect solely from a missing receipt. Release remains `BLOCKED`. Next experiment: cancellation racing with a provider effect after adapter dispatch, across actual broker and separate OS processes, with independent replay and two private worlds. Do not repeat the same local idempotency tests as novelty.

## Release blockers retained

Provider replica linearizability; durable crash semantics; cancellation/revocation at effect commit; idempotency key scope and retention; unknown-outcome reconciliation; complete adapter/OS observable closure (including errors, timing, file, DNS and subprocess); and external security review. Hush PR #45 remains draft and unmerged.
