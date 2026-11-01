# HUSH-PCC-074 | Required certificate without transaction: frozen real-broker bypass test

Frozen 2026-11-01 before implementation or code changes. Secondary Hush workstream; Lucent E002-371 remains primary. Existing branch and draft PR #45 only.

## Hypothesis / expected prepatch counterexample

In `ActionBroker.request`, `requireLifecycleTraceCertificate` and `requireObservableClosureCertificate` are accepted even when `transactionId` is absent. Their certification blocks run only inside `if(transactionId!=null)`; `_scopeVerdict` returns `{safe:true,reason:'UNSCOPED'}` for a missing transaction before checking either required flag. Thus an explicitly required certificate can be silently bypassed by omitting the transaction.

Test using the actual ActionBroker and a loopback HTTP POST adapter. Under two separate configurations (lifecycle required, observable-closure required), request without transaction, locally approve, execute, and count real receiver requests. **Prepatch prediction:** request succeeds and one HTTP effect occurs for each required-but-unscoped case. **After patch:** request is rejected before ticket creation, with zero adapter calls and zero HTTP effects.

## Locked controls and negative criteria

1. Unscoped action with *neither* certificate required retains its existing explicit-local-approval path and produces exactly one authorized HTTP effect. Do not silently change legacy behavior in this narrowly scoped patch.
2. A denied/unapproved ordinary action produces zero HTTP effects.
3. The fail-closed guard is enforced at request and independently at dispatch for an already-created/legacy ticket with required certificate but no transaction; no credential resolver, adapter or HTTP call may run.
4. A request with a supplied but nonexistent transaction must still reject.
5. A valid scoped/certified transaction's behavior must not be weakened. Existing scoped-certificate tests remain regression gates.
6. Do not infer that local broker checks constrain arbitrary adapter network egress, provider effects, crash/restart or cross-process revocation. No deployment-readiness claim.

## Composition rule and consequence

For each requested mandatory certificate `C`, the minimum local safety invariant is `require(C) => transactionPresent && certificateValid(C)` at request and again at dispatch. A policy that only checks `transactionPresent => certificateValid(C)` admits the vacuous bypass `!transactionPresent`. This is elementary logical implication, not a new information-flow theorem. It matters because an actual approved broker adapter can perform external effects under a claimed certificate requirement that was never evaluated.

Freeze before implementation. Record expected prepatch evidence separately from patched CI; preserve failures. Release stays BLOCKED pending OS/runtime mediation, independent replay, cancellation/restart/provider semantics and external review.
