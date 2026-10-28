# HUSH-060 | Post-dispatch authorization closure and private-result release

Frozen 2026-10-29 before executing the adversarial real-HTTP test or changing ActionBroker. Secondary Hush workstream, existing branch and draft PR #45. This is a lifecycle disclosure falsification, not a new general noninterference theorem. HUSH-049 already proved a **provider-side effect** can occur after transaction closure; HUSH-060 asks a distinct question: can the broker itself **return a newly obtained private result** to the caller after durable closure?

## Frozen two-world test

1. Register an encrypted, durable authorization transaction with the established four-world parity fixture. Register an action whose scope is permitted and whose adapter fetches JSON from a real loopback HTTP server. The server accepts the request but holds its response.
2. Explicitly approve and execute a one-use ticket. Wait for the provider to receive the request; verify the broker has not returned a result.
3. Close the transaction in the same broker, then instantiate a fresh broker with the same encrypted state and independently verify that the transaction is durably closed. Only then release the HTTP response. The provider worlds differ in one low-entropy `privateBit` (0 vs 1).
4. **Prepatch predicted violation:** both worlds return `decision=allow`, expose the corresponding `privateBit` in the broker response and yield distinct receipt result digests, even though closure preceded provider response.
5. **Postpatch expected:** both worlds produce the same public, content-free denial/suppression projection, no `privateBit` and `receipt.resultDigest=null`; the provider request may still have happened. A control with no closure must return the explicitly approved result. An unapproved ticket must never contact the provider.
6. Preserve the existing HUSH-049 post-dispatch external-effect counterexample. The correction must not claim to revoke provider-side effects or implement cross-process synchronization.

## Enforcement and falsification

After `await adapter.execute(...)`, re-evaluate the transaction and ticket scope **before cloning, redacting, hashing or returning** any private adapter result. If the scope has closed/expired/changed, consume the ticket, issue a content-free receipt with a public status and return a denial that explicitly says post-dispatch effects cannot be undone. No raw-result hash, length, exception text or result projection is allowed in that denial. Do not call the pre-dispatch denial helper, which misleadingly implies no provider effect.

This protects the in-process broker-to-agent result boundary only. It cannot stop the adapter's outbound request, a side channel, a malicious trusted adapter, process crash, a second broker with stale state, or provider-side effects. Durable cross-process revocation and independent egress enforcement remain release blockers. Test with actual Node.js HTTP, encrypted state restart and independent two-world replay; preserve prepatch and postpatch hosted runs.

**Lucent E002-371 remains primary and unchanged. Hush production remains BLOCKED; PR stays draft and unmerged.**
