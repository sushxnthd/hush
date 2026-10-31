# HUSH-069 RESULT | Cross-process stale commit-point guard resurrects revoked authorization

Date: 2026-10-31. Frozen first at commit 6d6d802. Evidence tier: two real OS-process loopback HTTP provider replicas and local fixture-only broker stub; repository ActionBroker verification is pending hosted CI. No external provider, credential, deployment or independent security review.

## Falsification
Two provider replicas share the same file-backed authorization state. The commit replica reads revoked=false and waits after its check. The independent revoker replica successfully writes revoked=true and epoch=1. The commit replica then resumes, increments the irreversible-effect counter and renames its stale snapshot over the revocation. The final state contains effects=1, revoked=false, epoch=0. Thus even a provider-side commit-point check is insufficient unless revocation and commit linearize atomically across **all** provider replicas. This is an expected stale-write/lost-update counterexample, not a new information-flow theorem.

| Frozen interleaving | Effect count | Final revoked | Final epoch |
| --- | ---: | --- | ---: |
| Stale check, revoke, resume (two synthetic worlds) | 1 | false | 0 |
| Shared-lock guard, revoke, resume (two worlds) | 0 | true | 1 |
| Shared-lock guard, commit, then revoke | 1 | true | 1 |
| Guarded commit waiting, revoke, kill process, restart | 0 | true | 1 |
| Orphan provider lock | 0 | false (revocation denied) | 0 |

These are deterministic controlled interleavings of a deliberately vulnerable provider fixture. The final orphan-lock row is an availability failure, not successful revocation; it must not be represented as CLOSED. Shared exclusive-create locking is a research control and does not establish crash-durable distributed transactions or safe lock recovery.

## Reproduction and evidence
- Frozen protocol: HUSH_069_FROZEN.md.
- Two-process HTTP provider: hush_069_provider_replica.mjs.
- Actual ActionBroker test: ../../test/action-broker-provider-replica-069.test.js.
- Independent sanitized-history verifier: hush_069_independent_replay.py.
- Cross-OS CI: ../../.github/workflows/hush-069-provider-replicas.yml.
- Local fixture-only execution with a minimal ActionBroker stub: **5/5 Node tests passed, 7 sanitized histories generated**. The seven histories matched the frozen expected effect and epoch counts. This does not count as real repository ActionBroker verification.
- Hosted real-ActionBroker CI run: https://github.com/sushxnthd/hush/actions/runs/41150659444. Queued at report creation; do not claim hosted success until all jobs and independent replay complete.

## Enforcement and product consequence
Every irreversible provider effect and every successful revocation must use the same **cross-process serializable authorization epoch**, not merely a pre-commit read, rename-based persistence or broker-local lock. Revocation success must not be acknowledged until its ordering is durable and cannot be overwritten by a stale commit. Retry, cancellation, crash/restart and provider replicas require a common idempotent commit protocol; otherwise Hush must narrow its promise to broker-local output suppression.

Release remains BLOCKED. The test does not implement production provider enforcement, durable fsync, network partition tolerance, authenticated clock, hostile adapter mediation or independent review. Preserve negative traces and do not merge PR #45. Lucent's primary E002-371 workstream remains separate and unchanged by this experiment.
