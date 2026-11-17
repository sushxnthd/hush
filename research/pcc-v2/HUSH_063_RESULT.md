# HUSH-063 | Deterministic cross-process check/save revocation race

Date: 2026-10-29. Secondary Hush workstream; existing draft PR #45 and `breakthrough-engine/transaction-scope-recovery-20261021` preserved. [Frozen before test](HUSH_063_FROZEN.md) at `9baaeeaa0e60ccaa0ddf5eb6910018bdff42331d`.

**Evidence tier:** source-grounded adversarial test committed, hosted replay pending. Do not claim the attack reproduced until the exact test run succeeds.

## Predicted exploit and its observable consequence

HUSH-062's persistence patch rejects a stale writer if it sees a previously closed durable transaction at its initial read/check. But its `_persistAuthorizationTransactions` performs `load()` and `save()` separately, with no atomic compare-and-swap or exclusive writer lock. A second process can close `tx` **between** those calls. The first process then overwrites the closure with a previously checked open snapshot. A third broker may read valid encrypted state that incorrectly says `tx` is open.

The [new adversarial test](../../test/action-broker-check-save-race.test.js) interposes at the actual `EncryptedAuthorizationStateStore.save` boundary of the stale writer, launches a **separate Node OS process** to durably close `tx`, verifies a fresh observer denies reopening while the closure is durable, then allows the stale writer's original save to proceed. The frozen prediction is that a new broker then reopens `tx` and releases a private-bit-dependent result from a real loopback HTTP adapter. Two artificial private worlds and a no-race denial control are included; secrets are not printed.

[Dedicated hosted workflow](../../.github/workflows/hush-063-check-save-race.yml) runs the new test on Node 22 and reruns HUSH-062's baseline regression. **Hosted completion is pending/unverified at report creation.** The attack is deterministic by instrumentation, not a measured probability of a naturally occurring race. It targets a concrete check/save interleaving, not general noninterference or timing-channel security.

## Enforcement consequence

The HUSH-062 patch is insufficient to certify revocation linearizability. Do not deploy multi-process authorization persistence on this store. A real fix requires a durable single-writer mechanism or transactional compare-and-swap with crash/restart recovery, monotonic revocation, cancellation and in-flight provider-effect handling. A local mutex is not sufficient across independent processes. Even a linearizable authorization store cannot retroactively cancel provider side effects already dispatched. Independent replay, cancellation/race tests, explicit observable threat-model coverage and external review remain release blockers.

**Production: BLOCKED.** No merge, force push or deployment. This run did not change Lucent's branch, PR or schedule.