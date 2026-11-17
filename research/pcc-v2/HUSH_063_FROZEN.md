# HUSH-063 FROZEN | Cross-process check/save race after HUSH-062

Date: 2026-10-29. Secondary workstream, preserve branch `breakthrough-engine/transaction-scope-recovery-20261021` and draft PR #45. Do not modify Lucent's branch, schedule or PR.

## Attack
HUSH-062 checks the durable encrypted authorization map immediately before saving the entire local map. The check and save are separate operations. Predict that another OS process can close transaction `tx` **after** a stale writer's successful durable load/check but **before** its file save. A deterministic test will interpose on the stale writer's `store.save`, spawn a separate Node process that closes `tx`, and then allow the stale writer's original save to proceed. Predict that a fresh broker sees `tx` reopened and can release a private-bit-dependent loopback HTTP result. This tests an actual OS-process interleaving rather than assuming race behavior.

## Frozen outcomes
- Baseline: without interposition, HUSH-062 rejects a stale writer whose closure happened before the check.
- Adversarial schedule: closure after check but before save succeeds in overwriting closure; fresh broker reads open state; private result is disclosed in two distinct artificial private-bit worlds. No private bits or encryption keys in logs.
- Negative control: fresh broker reading durable closed state without a racing stale save denies private action.
- If adversarial schedule cannot be reproduced, report failure honestly, inspect source, do not claim vulnerability.
- No attempted patch in this run without a verified linearizable persistence primitive. Add an explicit fail-closed production blocker. The correct fix requires single-writer durable serialization or compare-and-swap/transactional state with crash-safe monotonic revocation, plus independent replay and threat-model review.

Evidence tier: real broker and encrypted filesystem + separate OS process + local loopback HTTP; deterministic test, not production deployment or a new general noninterference theorem.