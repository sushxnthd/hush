# HUSH-PCC-052 — real-HTTP preapproval response-order channel: implementation and verification status

**Date:** 2026-10-24. **Frozen before implementation:** [HUSH_052_FROZEN.md](HUSH_052_FROZEN.md), commit `f2a7ef2c8403f1d05c1d00d37a25d5b583593c71`. **Evidence tier:** deterministic loopback-HTTP adversarial test harness; hosted CI with the *actual* ActionBroker is **pending at report creation**. The local HTTP barrier was tested with a minimal ActionBroker stub, so local success must not be described as an integration pass.

## Hypothesis and exact distinguishing trace

Consider two private worlds, secret bit `s=0` and `s=1`, with the same global authorization. Two requests `/a` and `/b` are sent to a local HTTP wrapper that calls the existing Hush `ActionBroker.request` and leaves both tickets in `ask` state. Each endpoint returns exactly `{"decision":"ask","approved":false}`, independently of `s`. No ticket is approved, executed or credential-resolved. The deliberately insecure wrapper nonetheless releases the two HTTP responses in the secret-dependent order:

| World | Per-path HTTP payloads | External completion order | Private-bit recovery |
|---|---|---|---|
| `s=0` | same constant bodies | `/a,/b` | 0 |
| `s=1` | same constant bodies | `/b,/a` | 1 |
| `s=0`, fixed-order control | same constant bodies | `/a,/b` | no distinguishing transcript |
| `s=1`, fixed-order control | same constant bodies | `/a,/b` | no distinguishing transcript |

The observer acknowledges the first received HTTP response before the server releases the second. This creates a deterministic **completion-order** channel without relying on unreliable wall-clock latency comparisons. The private bit is recoverable from order even though each individual response body is noninterfering.

**Important limitation:** the private bit is introduced into an *intentionally insecure surrounding scheduler*. This is **not** evidence that a shipped Hush endpoint branches on secrets or leaks via timing. It shows that per-response payload closure alone cannot justify a compositional runtime information-flow certificate unless observable order/scheduling is included in the threat model.

## Frozen controls and reproduction

`test/action-broker-preapproval-order-channel.test.js` invokes the real `ActionBroker` in CI and checks equal per-path payloads, reversed order, 2/2 distinguishing recovery, zero approvals/executions/credential resolutions/effects, and identical traces under fixed-order scheduling. The test is isolated from external providers and uses built-in Node HTTP and fetch.

```bash
node --check test/action-broker-preapproval-order-channel.test.js
node --test test/action-broker-preapproval-order-channel.test.js
```

The dedicated `.github/workflows/hush-052-preapproval-order.yml` also executes earlier HUSH-046 and HUSH-049 negative controls. At report creation, the workflow has not been independently confirmed green; do not count it as a verified real-broker experiment yet.

## Literature priority and general law

Noninterference and whole-observation equivalence are classical, beginning with Goguen and Meseguer, *Security Policies and Security Models*, IEEE S&P (1982), DOI 10.1109/SP.1982.10014. Scheduler/refinement attacks and **observational determinism** for concurrent programs were analyzed by Zdancewic and Myers, *Observational Determinism for Concurrent Program Security*, CSFW (2003), DOI 10.1109/CSFW.2003.1212703. More recent work on abstract commutativity in concurrent information-flow proofs includes Eilers, Dardinier and Müller, *CommCSL* (2022/2023), arXiv:2211.08459. HUSH-052 claims **no new information-flow theorem**.

The relevant compositional condition is equality of **whole externally observable traces**, not equality of each payload separately. The runtime boundary must include response ordering, timing, queue contention, cancellations, retries, crash/restart and all broker-mediated and unmediated effects. This finite test does not address continuous timing, cache effects, scheduler fairness, OS-level mediation, malicious adapters, network jitter or real provider commits.

## Enforced product consequence

`scripts/production-readiness.mjs` now requires a separately artifact-backed, independently reviewed `release/attestations/runtime-observable-order.json` in the **Authority & real actions** release dimension, in addition to existing runtime egress mediation and provider idempotency attestations. The new attestation is deliberately absent; release remains **BLOCK**. A passing finite HTTP test cannot create the attestation or authorize deployment. The test's CI includes a check that the release blocker remains missing.

## Next decisive Hush step

Independent hosted CI confirmation of the actual broker integration; then extend to a **real deployed-style broker-owned effect boundary** with crash/restart/cancellation and externally observed scheduling, and obtain external security review. Do not infer whole-runtime security from finite trace parity or local wrapper tests. Preserve draft PR #45 and avoid merge.
