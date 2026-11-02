# HUSH-065 FROZEN | Cross-process revocation between final authorization read and provider dispatch

2026-10-30. Secondary Hush kernel on established branch `breakthrough-engine/transaction-scope-recovery-20261021`, draft PR #45. Freeze before implementing the attack. Evidence tier: deterministic real-process / loopback-HTTP adversarial runtime test, not external deployment or a new information-flow theorem. Lucent primary is not modified.

## Scientific question

HUSH-064 serializes durable authorization *writes* and HUSH-060/061 recheck authorization before dispatch and after adapter completion. Does the final check actually ensure no private credential is transmitted to a provider after another OS process has durably closed the transaction? The source says it cannot: `_scopeVerdict` reads a durable snapshot without holding a lock across adapter dispatch.

## Frozen two-world interleaving

- Create an encrypted authorization store in a temporary local directory, a transaction `tx` with worlds `00,01,10,11` and global authorization equal to parity, and a trusted local adapter with matching local scope.
- Register a ticket for the same transaction with one opaque credential reference; explicitly approve it. A trusted resolver returns either `HUSH065_PRIVATE_ZERO` or `HUSH065_PRIVATE_ONE` depending on the private world. No raw credential is included in action arguments.
- Use a real loopback HTTP server as the external provider; the adapter POSTs the resolved credential in the HTTP body. The server records only in-process effects and payload for assertions; no network outside loopback.
- Interpose the durable store's `load()` *after* broker setup. Let the first execute-time `_scopeVerdict` read the open state normally. On the second execute-time `_scopeVerdict` (the final pre-dispatch check), first read and retain the still-open snapshot, then synchronously spawn a **separate Node OS process** to close `tx` durably using the same encrypted store, then return the stale snapshot to the broker. The child must exit successfully and a fresh independent store load must confirm closure before the adapter starts.
- This schedules a legal race *inside the final authorization read*, after its snapshot but before adapter dispatch. The child must not encounter an HUSH-064 lock because no write lock is held by the reader. Do not monkeypatch `_scopeVerdict`, adapter authorization, or the HTTP provider.
- Repeat independently for both private worlds, using fresh stores and fresh servers.

## Predeclared predictions and kill criteria

1. The final check returns allow from the stale open snapshot even though a separate process has already committed closure; the adapter performs exactly one loopback HTTP POST **after** durable revocation, containing the private credential for that world.
2. The completion-time recheck suppresses the private result and produces a deny receipt without a private-result digest. Thus broker-output nonrelease does **not** imply provider-effect nonrelease.
3. Both worlds have identical public broker decisions/receipts up to fresh random IDs and hashes, but the external provider can distinguish worlds from the credential payload after revocation. Never publish private payloads or identity-bearing material as CI artifacts.
4. Reject the counterexample if the child does not close durably before dispatch, if the POST is not observed, if the broker returns the private result, or if the experiment relies on changing the adapter or authorization scope after approval.
5. Report this as a **specific TOCTOU / effect-boundary counterexample**, not a novel universal theorem. A fix must define a linearization point for revocation versus irreversible provider effects and require adapter/provider cooperation or a scoped effect lease; a broker-side post-result check cannot undo HTTP side effects. An async lock without crash/cancellation/fencing semantics is not a sufficient release proof.

## Reproduction and release gate

Run the Node 22 test `node --test test/action-broker-revocation-dispatch-race.test.js` and a dedicated hosted CI workflow. Preserve a passing attack test as a *security failure demonstrated*, not a successful security guarantee. No real credentials, user content or external API calls. Do not merge or deploy. Hush release stays BLOCKED pending transactional effect-boundary design, restart/cancellation testing and external review. Lucent remains ABSTAIN_UNCALIBRATED and BLOCKED.
