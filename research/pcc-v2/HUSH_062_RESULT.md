# HUSH-062 | Stale-writer persistence can resurrect revoked authorization

Date: 2026-10-29. Secondary Hush kernel on existing `breakthrough-engine/transaction-scope-recovery-20261021`, draft PR #45. [Frozen before implementation](HUSH_062_FROZEN.md) at `492e2d40377182f6ee811714193124832d3b8203`. Lucent primary branch/PR/workflow were not changed by this Hush work.

**Evidence tier:** source-grounded deterministic stale-snapshot attack, real ActionBroker + encrypted state + loopback HTTP adversarial regression, narrow rollback guard. Hosted prepatch/postpatch results must be verified separately; do not claim a hosted pass while queued. This is not a general information-flow theorem or production security certification.

## New counterexample and information-flow consequence

HUSH-061 added a durable re-read immediately before private result release, but `_persistAuthorizationTransactions` still persisted the *entire in-memory map* with an atomic rename. An independent broker could close transaction `tx`, while a stale broker subsequently registered an unrelated `tx2` and overwrote the closed `tx` with its old open snapshot. A fresh broker would then read a validly encrypted, apparently open transaction and allow private data to cross the broker-to-agent observable cut.

This is a concrete **authorization resurrection** path: a revocation can be durable and observable, then silently undone by an unrelated writer. Encryption, integrity commitments and atomic file replacement alone do not imply monotonic revocation.

[Real-broker regression](../../test/action-broker-stale-writer-resurrection.test.js) constructs two distinct private-bit worlds, a loopback HTTP result adapter and an encrypted durable state file. It now closes the transaction in a **separate OS process** while a second broker retains a stale snapshot. The prepatch code path predicts that the stale writer can resurrect the authorization and the fresh broker can return a private-dependent HTTP result and receipt. The test does not publish the private bits. The preregistered expected-counterexample workflow was committed before the patch; its hosted outcome must be checked rather than inferred from code inspection.

## Narrow enforcement patch

[Patch `7b12911`](https://github.com/sushxnthd/hush/commit/7b12911be56f7b75d7198d487a08506a90429935) adds a durable-state consistency check before every whole-map authorization save. It rejects:

- A durable transaction absent from the proposed snapshot, or one whose immutable commitment differs.
- Any attempt to replace a durably closed transaction with an open local copy.
- Missing previously known durable transaction IDs, duplicate IDs, malformed closure fields or an unreadable/corrupt store.

A failed stale registration rolls back the new local transaction; a fresh broker loaded after closure may still create an unrelated `tx2` without reopening `tx`. The [expanded regression](../../test/action-broker-stale-writer-resurrection.test.js) also checks a missing-state-file rollback attempt. [Postpatch workflow](../../.github/workflows/hush-062-stale-writer.yml) runs these tests on Node 22.

**Important limit:** this read/check/save is **not atomic across processes**. Two writers can still interleave after the check, and the last rename can overwrite newer state. A new process starting after complete loss of the state file also lacks a trusted persistent history unless the store has a separately anchored initialization epoch. The patch does not establish global revocation linearizability or prevent provider effects already dispatched.

## Release-blocker consequence

Do not deploy this multi-process authorization store until a durable linearizable revocation/claim mechanism (or equivalent single-writer enforcement) is tested under adversarial process scheduling, crash/restart, cancellation, stale writes and clock faults. Verify that the broker result, digest, error text, timing and provider-visible side effects do not reveal preapproval/private data under the explicit threat model. Independently replay the exact failing schedule and obtain external security review. A passing local test does not certify any of these broader properties.

**Hush production remains BLOCKED.** No merge, force-push or deployment. This is a classical distributed-state consistency failure with a direct information-flow consequence, not novel general noninterference theory.
