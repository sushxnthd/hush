# MCP stream runtime-lock closure result

## Decision

**Production deployment closure survives.** The receipt primitive is unsafe
under uncoordinated multi-process access, but Hush's existing startup lease
excludes that execution before `Store` loads.

## Frozen result

- 50/50 live second processes failed closed with `HUSH_ALREADY_RUNNING`.
- 50/50 leases left by SIGKILL were recovered by a new process after the owner
  PID was proven dead.
- Independent result/source-order audit: 9/9.
- Production source acquires `runtime.lock` before `new Store(dataDir)`.
- Two complete executions were byte-identical.
- Full repository regression: 339/339 before this follow-up; no runtime source
  was changed by the experiment.

## Sharp system law

For the current snapshot-backed receipt store, append completeness composes with
stream-terminal uniqueness only under an exclusive live-writer lease acquired
before the receipt snapshot is loaded. Atomic replacement alone is insufficient.

The production server meets that condition for local processes using exclusive
lock-file creation plus live-PID rejection and dead-PID recovery.

## SCIENCE ledger

The paired experiments distinguish two claims exactly:

1. `Store.addReceipt` is **not** a multi-process atomic append: 100/100 direct
   two-process trials lost one receipt.
2. the production startup path **does** enforce the required single-writer
   precondition: 50/50 live contenders were excluded and 50/50 dead-owner
   leases recovered.

This is a scoped mechanism validation, not a novel locking theorem.

## CONSEQUENCE ledger

PR #37's exactly-once terminal claim may remain for the enforced single-runtime
deployment partition. Documentation and future server entry points must retain
the lock-before-store invariant. Any multi-process or clustered Hush mode must
replace snapshot persistence with a transactional append/consensus mechanism;
reusing `Store` directly is prohibited.

## Limitations

PID reuse between crash and recovery, network filesystems, containers with
separate PID namespaces, and distributed deployments are not covered. The
lease is a local single-host mechanism, not a distributed lock.
