# HUSH-PCC-076 | Trusted enforcement cannot depend on caller-supplied certificate flags (frozen protocol)

Date: 2026-11-02. Secondary Hush workstream. Existing branch `breakthrough-engine/transaction-scope-recovery-20261021`, draft PR #45. This is a scoped enforcement/product experiment, **not** a novel general information-flow theorem.

## Hypothesis and threat boundary
The current broker deliberately preserves backward-compatible unscoped actions. A caller can omit `transactionId`, `requireLifecycleTraceCertificate` and `requireObservableClosureCertificate`, even when a trusted adapter declares authorization maps and a broker-owned observable boundary. The action may still dispatch after local approval. This is a **configuration downgrade** only where the operator intended those certificates to be mandatory; ordinary unscoped actions are not inherently vulnerabilities.

A trusted adapter needs a policy independent of untrusted request flags. Test a new optional trusted registration policy `enforcement: {transactionRequired, lifecycleTraceRequired, observableClosureRequired}`. Default all false for compatibility. Require transaction whenever any certificate is mandatory. Enforce mandatory certificates at request and at the last pre-dispatch/completion checks; silently omitted caller flags must not weaken the trusted policy. A malformed policy must be rejected at registration. A legacy/tampered ticket lacking a required field must not dispatch. Existing HUSH-075 adapter-generation guard must remain effective.

## Frozen adversarial predictions
1. **Prepatch**: A configured adapter with safe scope/trace and broker-owned closure, but *no trusted mandatory-policy field*, accepts an explicitly approved unscoped request and makes one actual loopback HTTP POST. This demonstrates that mere presence of certification metadata is not a mandatory enforcement mechanism.
2. **Patched protected adapter**: With `enforcement.transactionRequired=true` and the two required certificate booleans true, a request omitting transaction is rejected before ticket creation, credential resolution and HTTP effects. A request with valid transaction but omitted caller certificate flags must be evaluated under **both** trusted-required certificates, not downgraded to ordinary scoped evaluation.
3. If the broker-owned closure boundary is absent, a protected scoped request must deny before adapter entry and make zero HTTP effects. An injected legacy ticket with required certificate flags cleared must fail at dispatch.
4. A valid scoped transaction with complete broker-owned closure and trace maps can make exactly one loopback HTTP POST after local approval. An ordinary adapter without enforcement requirements still supports an approved unscoped action.
5. Reject unknown policy keys, nonboolean policy values and lifecycle/closure requirements with `transactionRequired=false`. Never infer security from a caller-provided claim alone.

## Evidence and release criteria
Execute a real ActionBroker plus localhost HTTP receiver; count actual POSTs and adapter entries, not merely returned decisions. Run the full existing broker/certification regression suite. Preserve prepatch behavior and negative results; never merge or deploy automatically. This patch does not mediate hostile adapter egress, provider commit, crash/restart, cancellation or OS-level channels. Release remains **BLOCKED** pending external review. Lucent's primary branch and PR #26 must not be modified.
