# HUSH-068 FROZEN | Provider commit-point revocation gate (2026-10-31)

Secondary Hush workstream. Preserve branch `breakthrough-engine/transaction-scope-recovery-20261021`, draft PR #45. Frozen before executable. Evidence tier: synthetic loopback HTTP provider enforcement prototype, **not** a real provider integration, deployment guarantee or new information-flow theorem.

## Hypothesis
HUSH-066/067 show local broker fences and client abort cannot stop provider-accepted queued work. Test the complementary **commit-point** enforcement: a provider that serializes revocation and irreversible commit through the same trusted authorization state must not commit after a successful revocation. The check must be made at commit, not merely at enqueue.

## Frozen interleavings (two synthetic private worlds)
1. Approved real ActionBroker HTTP POST enqueues; provider revocation commits; then queued work attempts commit. **0 effects** under commit-point gate.
2. Approved POST enqueues; provider commit linearizes before revocation. **1 effect** allowed; revocation subsequently succeeds.
3. Provider authorization already revoked before enqueue; provider rejects. **0 effects**.
4. Negative control: provider checks only on enqueue, then revocation commits before delayed effect. **1 post-revocation effect**, demonstrating the check placement matters.
5. Missing/corrupt durable provider state at commit must deny rather than default open.
6. Use a loopback HTTP provider and two different synthetic credential strings; never emit them in result/trace. Public traces only contain event order and effect counts.

## Scope and stop
The prototype may serialize in a single Node event loop with a file-backed authorization epoch, but it does **not** prove crash-durable atomic transactions, hostile provider behavior, real external APIs, network partitions or idempotency. Do not claim a provider capability exists unless it is verified. The product release blocker requires provider-enforced revocation at the irreversible commit point (or a narrowed claim), authenticated restart/reconciliation, cancellation and independent review. Hush release stays BLOCKED. Lucent primary branch/PR must not be touched by this experiment.
