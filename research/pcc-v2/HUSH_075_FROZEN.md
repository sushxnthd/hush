# HUSH-PCC-075 | Frozen adapter-generation substitution attack

Frozen 2026-11-02 before writing the test or patch. Bounded secondary workstream; existing `breakthrough-engine/transaction-scope-recovery-20261021` branch and draft PR #45 only. Lucent E002-371 remains primary and untouched by this experiment.

## Hypothesis
`ActionBroker.registerAdapter` overwrites an existing adapter registration with the same name. A pending ticket commits to adapter/action and local authorization scope, but not the *identity of the executable adapter implementation*. Re-registering a different `execute` function under identical name, action and authorization scopes after approval may cause an already-approved ticket to dispatch to an executable never approved at ticket issuance. Even an otherwise valid scoped certificate can remain unchanged.

## Frozen real-effect tests
1. Register a benign `swap75` adapter, issue and locally approve an unscoped ticket, replace the registration with a real loopback HTTP POST adapter of the same name/action, and execute the old ticket. **Prepatch prediction:** one unauthorized-by-ticket HTTP effect; **patched requirement:** zero effects, denial before adapter entry.
2. Repeat with a valid transaction and identical certified authorization scopes across both registrations. **Prepatch prediction:** one HTTP effect despite unchanged scope certificate; **patched requirement:** zero effects.
3. After replacement, a *new* ticket approved against the new registration must execute exactly once. Replacing a different adapter must not invalidate unrelated tickets.
4. Independent failure control: no ticket should execute before approval.
5. Do not infer that registration-generation binding prevents malicious in-process adapters, network side channels, provider effects after dispatch, crash/restart races or cross-process revocation.

## Candidate enforcement consequence
Assign each trusted adapter registration an unpredictable local generation token, snapshot it on ticket issuance, and require exact match at **every pre-dispatch scope check** (including unscoped tickets). Re-registering the same adapter name invalidates previously issued tickets; it does not revoke effects already dispatched. The token is a local TOCTOU guard, **not** an authorization certificate, cryptographic code attestation or new information-flow theorem.

Freeze test results separately before applying a narrow patch. Keep Hush release `BLOCKED` and PR #45 draft/unmerged. No force-push or deployment.
