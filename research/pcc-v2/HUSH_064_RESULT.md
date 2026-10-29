# HUSH-064 | Narrow local-filesystem checked-save serialization

Date: 2026-10-29. Secondary Hush workstream, established branch and draft PR #45. [Frozen predictions](HUSH_064_FROZEN.md) committed at `0844f8dce6ce27cc75d91fca881760a0dcaf9ca5` before the patch and regression changes.

**Evidence tier:** source-level enforcement patch and committed real separate-process adversarial tests; hosted test results are **pending** at this report's creation. No external review, deployed protection, general compositional theorem, or claim of complete noninterference.

## Mechanism

HUSH-063 demonstrated a checked-save interleaving in which a second OS process could close a transaction between another broker's durable read/check and subsequent whole-map save. The HUSH-064 patch wraps the entire `_persistAuthorizationTransactions` load/check/save in `EncryptedAuthorizationStateStore.withExclusiveLock`. The lock is a sibling file acquired using atomic exclusive creation (`openSync('wx',0600)`). Collision throws `AUTHORIZATION_STATE_LOCKED` before any durable mutation; stores without the exclusive-lock contract throw `AUTHORIZATION_STATE_ATOMICITY_UNSUPPORTED`. The lock is released only by the acquiring process in `finally`.

A crash leaving the lock file blocks future mutations until deliberate operator investigation and recovery. The code intentionally does not delete locks based on age or PID. This sacrifices availability rather than guessing that a possibly live writer has disappeared.

## Prespecified adversarial tests

The updated HUSH-063 regression now tests HUSH-064's expected denial while retaining HUSH-063's original frozen exploit protocol and report as historical evidence. It uses an actual second Node OS process inside the checked-save interposition, a real encrypted filesystem store, and two artificial private-bit worlds with a loopback HTTP adapter. Expected outcomes: child closure during the lock returns `AUTHORIZATION_STATE_LOCKED`; after lock release the child closes durably; a fresh broker denies the closed transaction; **zero HTTP effects**. Additional regressions test an orphan lock that must not be auto-cleared and a stale broker after a committed closure.

[Dedicated CI](../../.github/workflows/hush-064-atomic-persistence.yml) runs the separate-process regression and HUSH-062 baseline on Node 22. CI success must be independently checked; committing tests is not a pass.

## Precise security boundary

This patch only serializes **durable authorization map mutations** among cooperative processes sharing one trustworthy local filesystem and the same lock convention. It does not serialize `request`, `approve`, `execute`, or already-dispatched provider side effects against revocation. It cannot prevent a stale in-memory broker from releasing a private result during a revocation/execute race. It does not secure network filesystems, hostile local processes capable of removing locks, compromised keys, filesystem rollback, backups, timing channels, or crashes in downstream adapters. Lock release failure may leave the store unavailable; this must not be silently bypassed. The lock file is not a durable consensus or fencing-token protocol.

**Release blocker:** do not enable multi-process broker execution or claim end-to-end authorization noninterference. Next: adversarial revocation-versus-`execute` race with real provider effects, crash/restart recovery under a controlled operator procedure, cancellation/expiry boundaries, independent replay and external security review. The next enforcement design needs a linearizable authorization check at the effect boundary, not merely atomic persistence.

No Lucent files, branch, PR or schedule were changed. No merge or force push.