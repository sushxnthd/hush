# HUSH-PCC-056 FROZEN — real-process crash-after-effect replay boundary

Date: 2026-10-27. **Status: frozen before implementation.** Secondary workstream only; Lucent E002-371 remains primary. This is a known distributed-systems failure window applied to Hush's real ActionBroker, not a new general exactly-once theorem or evidence of a deployed vulnerability.

## Question and threat model
An authorized request can dispatch a provider-side effect, then the broker process can die before returning a receipt or recording durable ticket consumption. Does restarting the application and reapproving the same logical request repeat that external effect? The lower-trust observer is the requester who sees no receipt from the crashed process; the durable external provider ledger is independently inspected. The adapter is trusted local code; the broker is not assumed to own provider idempotency.

## Frozen experiment and predictions
Use a real Node child process, a real ActionBroker, a loopback-local file as an external side-effect ledger, and a fixed request binding. Child A requests/approves/executes, adapter durably appends an effect, sends an IPC acknowledgment, then deliberately blocks before returning. Parent kills child with SIGKILL **after** verifying the effect is durable. Start fresh child B with a new ActionBroker, issue the *same logical request*, approve and execute.

Prediction A (provider with no idempotency): identical requestHash across processes, **two** durable provider effects, despite one logical user intent; first child produces no completed receipt. This is a failure of exactly-once effect semantics, not an authorization bypass.
Prediction B (durable provider idempotency keyed to requestHash): one durable provider effect after restart and replay, despite two broker dispatches. This control assumes provider honors the stable key atomically; a local test ledger cannot prove real provider semantics.
Prediction C: no retry after crash leaves one effect, but no completed receipt to the requester; lack of receipt cannot be interpreted as absence of side effect.

Kill criteria: missing durable first effect before kill; child not actually killed; request hashes differ; no duplicate in unprotected replay; duplicate under the idempotent control; or any report treating this as production deployment readiness. Preserve logs without secrets. Do not change Lucent branch, alter its workflow, force-push, merge, or deploy.

## Enforcement
Release remains BLOCKED until each real provider has independently verified idempotency semantics (key scope, atomicity, collision, retention and replay after crash), durable intent/attempt records, and cancellation/race testing. The broker's one-use in-memory ticket reservation cannot substitute for provider-side exactly-once evidence.
