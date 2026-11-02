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
## Hosted verification closure (2026-10-29)

The dedicated [HUSH-064 CI run 40901029244](https://github.com/sushxnthd/hush/actions/runs/40901029244) completed successfully on `5e44a855`, verifying the separate-process checked-save race, stale-broker denial and orphan-lock controls. This supersedes the initial *pending* status above without changing the frozen protocol.

The full `npm test` job on the same head failed only because Node 22 recursively discovered the deliberately argument-requiring `test/fixtures/hush056-crash-worker.mjs` as an executable test. Commit [`505aebd`](https://github.com/sushxnthd/hush/commit/505aebd64fa9d5b09b4c4bee31632b1134b79043) changed the package `test` and `check` scripts to explicitly discover `test/**/*.test.js`. The selection was independently smoke-tested on Node 22.16.0 against a deliberately throwing fixture. [Cross-platform CI run 40927988428](https://github.com/sushxnthd/hush/actions/runs/40927988428) **passed** on commit `505aebd`: Windows, Ubuntu, macOS and benchmark jobs all concluded success. This verifies test discovery and the existing suite, not end-to-end revocation-versus-provider-dispatch safety.

**Release remains BLOCKED:** already-dispatched effects, cancellation, clock rollback, hostile local writers, shared-filesystem semantics and independent external security review are not covered by HUSH-064. No general compositional information-flow law or production readiness is claimed.
