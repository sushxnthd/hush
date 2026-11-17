# HUSH-061 | Frozen stale-broker revocation falsification

Date: 2026-10-29. Secondary Hush workstream on existing branch and draft PR #45. Freeze before test and implementation. No Lucent branch, task or schedule changes.

## Hypothesis

HUSH-060's completion-time scope check uses each ActionBroker instance's in-memory authorizationTransactions map. When broker A dispatches an asynchronous real loopback HTTP read, broker B (initialized from the same encrypted authorization state file) can durably close the transaction while A is awaiting the provider. A's stale in-memory map may still report open and disclose the private result and its digest after B has committed closure.

## Predeclared two-world test

Use worlds 00,01,10,11 with parity global/local authorization. In each of two private worlds, a real HTTP server holds a JSON result differing by one private bit. Broker A requests and approves an authorized read and begins dispatch. Broker B independently loads the same encrypted file and closes the transaction; a fresh broker C must observe the durable closure before the provider response is released. Then release the response.

**Prepatch prediction:** A returns allow, privateBit and a private-dependent digest in both worlds, despite B's durable closure. **Postpatch prediction:** A returns deny with no private result and null resultDigest. Controls: an open transaction still releases an approved result; a corrupt or unreadable persistent state fails closed before release; a denied/unapproved ticket does not dispatch.

## Bounded enforcement

For transaction-scoped actions backed by a durable store, reload and verify the persisted transaction record at every scope check (initial, post-credential-await and post-adapter-await). Reject missing, duplicated, malformed, closed or commitment-mismatched records, or unreadable store. Do not mutate another broker's transaction state during read. Preserve same-process behavior for unpersisted broker use.

This is **not** a cross-process linearizability or revocation guarantee: closure may race after the final read, stale writers can overwrite the file, and provider effects are irreversible. Multi-worker production must remain BLOCKED until a genuinely linearizable revocation/claim service, cancellation/egress controls, independent replay and external review exist. Never claim deployment readiness from this test.
