# HUSH-PCC-077 | Verified post-crash duplicate provider effect after explicit retry

**Status (2026-11-03): prospective hosted real-HTTP/process-kill experiment PASSED.** Secondary Hush workstream. Frozen protocol commit [9537d61](https://github.com/sushxnthd/hush/commit/9537d6189d900576c9fb828cd3876058111e7db7). [Hosted run #41488942333](https://github.com/sushxnthd/hush/actions/runs/41488942333), completed 2026-11-02 UTC, job `crash-retry` success.

## Confirmed observations

The hosted Node 22 test used a real loopback HTTP receiver and a separate broker OS process. After the receiver accepted a full first POST body but withheld the response, the broker was killed by `SIGKILL`. On broker restart using the same encrypted durable authorization store and still-open transaction, a **fresh explicitly approved ticket** for the same logical operation produced a **second full provider HTTP POST body**.

- **Positive arm:** `effectCount=2`, `revoked=false`, `firstReceiptRecovered=false`, `postRestartReceiptCount=1`. Event order: first provider HTTP effect, broker SIGKILL, restart, second provider HTTP effect, retry receipt. Node test **PASS**.
- **Negative arm:** durable transaction revoked before restart retry; `effectCount=1`, `revoked=true`, `firstReceiptRecovered=false`, `postRestartReceiptCount=0`. Event order: first provider effect, SIGKILL, restart, durable revoke. Node test **PASS**.
- [Independent Python sanitized-trace verifier](hush_077_independent_replay.py) confirmed `{"crash_retry_duplicate":true,"experiment":"HUSH-077","provider_independently_attested":false,"replayed":2,"revoked_retry_blocked":true}`. Two primary Node tests passed, plus **13/13** selected trusted-enforcement/scope regression tests.

The observations confirm the **predicted crash/retry duplication** within the local real-HTTP fixture. They **do not** establish that a malicious caller bypassed approval: the second operation was separately and explicitly approved. Nor do they show exactly-once was promised by the existing broker.

## Scientific and enforcement interpretation

An accepted-but-unacknowledged provider effect and an identical state with no accepted effect can be **indistinguishable to a restarted broker** when the durable state omits the provider's commit outcome. Consequently, broker-local one-use tickets, local receipts and an open authorization transaction **cannot alone certify externally exactly-once effects**. This is a standard distributed-systems ambiguity, not a novel information-flow theorem or new universal impossibility proof. HUSH-067 already established that provider work can survive broker death. RFC 9110 §9.2.2 discusses idempotent HTTP retry semantics: https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2 .

**Direct product rule:** A non-idempotent operation whose provider commit status is uncertain after a crash must transition to `UNKNOWN_EXTERNAL_OUTCOME`; automatic re-dispatch is blocked until a durable provider-side idempotency key, verified provider status reconciliation, or trusted transactional/outbox mediator proves safe continuation. Revoking the transaction prevents a *new* dispatch but cannot undo a prior provider effect. Fresh human approval alone does not make a repeated non-idempotent effect safe.

## Limits and remaining release blockers

The provider was a local test HTTP fixture, not an independent production service; no independent provider-side audit was performed. The test does not cover malicious provider behavior, real external provider deduplication, all cancellation/race windows, provider-side durable idempotency, end-to-end transactional mediation, or external security review. It demonstrates one adversarial recovery execution and one revoked control, not exhaustive lifecycle closure. The threat model must distinguish broker-visible outputs, external side effects and timing observables.

**Production BLOCKED; no deployment readiness claim.** Existing Hush branch and draft PR #45 remain unmerged. Lucent primary branch and PR #26 were not modified by this secondary update.
