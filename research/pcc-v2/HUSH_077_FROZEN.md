# HUSH-PCC-077 | Prospective crash-after-effect / before-receipt experiment

Date: 2026-11-02. Secondary workstream. Frozen before test implementation. Canonical branch `breakthrough-engine/transaction-scope-recovery-20261021`, draft PR #45.

## Question and predicted result
Does a durable, still-open authorization transaction plus a broker-local one-use ticket prevent a **duplicate provider effect** if the broker process is terminated after an actual HTTP receiver accepts an effect but before the broker records or returns a receipt?

**Prediction:** NO. On restart, the authorization transaction remains open, while ticket/receipt state is process-local. A fresh request and fresh explicit local approval for the *same logical operation* can cause a second HTTP effect. This is not an approval bypass or a claim that the current broker promises exactly-once delivery. It is a falsifiable, end-to-end crash-recovery limit that prevents an unqualified exactly-once or revocation-safety product claim.

## Frozen procedure
1. Create a temporary encrypted durable authorization state store and register a parity-scoped transaction. Register an adapter with trusted `transactionRequired:true`. Use a real loopback HTTP receiver that counts completed POST bodies.
2. In a separate Node child process, reopen the state store, register the same adapter, request and locally approve one action, then dispatch it. The receiver records the first POST but deliberately withholds its response.
3. Terminate the child process only after the receiver has confirmed the first POST body. Assert child exit and absence of an obtainable broker receipt.
4. Restart the broker against the same durable authorization state; independently check the transaction is still open. Register the same adapter, request and explicitly approve a second ticket for the same logical operation; allow the receiver to answer. Assert **two** completed POST bodies and a successful receipt for only the second attempt.
5. Negative control: close the durable transaction before the retry. Restart and assert retry is denied before HTTP dispatch, leaving exactly one effect.
6. Use independent nonce-free identical request bodies so the test is about broker recovery, not provider idempotency. Require actual HTTP, process kill and restart; mocked effects or in-process exceptions do not count. Bound all waits and destroy the temporary state.

## Interpretation / release blocker
If prediction holds, the broker cannot infer from its durable state whether an external effect happened before a crash. The external provider must offer durable idempotency keyed to a stable logical-operation ID, or a trusted transactional/outbox mediator must reconcile provider status before retries. Until verified, the product must say **outcome unknown after crash** and fail closed on automatic retry; never claim exactly-once external effects. The test cannot establish hostile-process or provider-level guarantees. No Lucent files or branches may be modified.
