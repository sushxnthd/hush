# HUSH-PCC-048 frozen failure-injection protocol (2026-10-23)

## Kernel
Preserve draft PR #45 and the existing transaction-scope recovery branch. Test a distinct **external-effect/receipt persistence boundary**: encrypted durable transaction authorization does not imply exactly-once external actions when the process crashes after the effect but before the client receives a result. This is a classical distributed-systems limitation, not a claim of novelty.

## Frozen adversarial witness
Use a real Node HTTP loopback receiver as the external side-effect oracle. Start a child process with an encrypted transaction store, fixed transaction ID and global authorization. Request and approve an action with fixed semantic operation ID and arguments. The trusted test adapter POSTs to the receiver and, after the receiver has returned HTTP 204, terminates the child with exit code 66 *before* the broker can return a receipt to the caller. Start a fresh second child using the **same encrypted state file and key**, same semantic operation ID and same authorized transaction. Retry with a newly issued ticket; do not reuse a ticket from memory. Observe whether the receiver records two effects. Use no external network, secrets or provider credentials.

## Predictions and release consequence
P1: both child processes load/verify the same transaction authorization.
P2: first child exits 66 only after one real HTTP effect.
P3: fresh-process retry exits zero and the receiver records **two** effects with the same semantic operation ID.
P4: both effects are outside a broker-owned durable idempotency mechanism; no claim of exactly-once is made.

A passing negative test **confirms an unclosed safety gap**, not a secure release. A production release must require provider-side idempotency keys with persistent deduplication, or a transactional outbox plus reconciliation and independent failure-injection tests across crash points. A local broker-only one-use ticket is insufficient. Keep runtime-egress and external security review blockers in force. Do not force-push, merge or rewrite prior evidence.
