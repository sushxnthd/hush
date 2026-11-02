# HUSH-073 RESULT | Post-revocation provider rejection is a broker-status channel

Date: 2026-10-31. Frozen before implementation at [HUSH_073_FROZEN.md](HUSH_073_FROZEN.md), commit `f5e5a8ff46500fb6ca44b12ecb6d8a2e7e9fb114`. Bounded Hush secondary run; Lucent E002-371 remains primary and unmodified.

## Exact new failure mode

HUSH-060 guarded the successful `await adapter.execute` path: if durable authorization closes during the await, its private result becomes a generic `deny`. The separate exception path previously returned `error` regardless of the now-closed authorization. In two worlds with the same public authorization, a provider that returns HTTP 200 in one world and HTTP 503 in the other can therefore reveal one private bit through the broker-owned decision and receipt status **after revocation**, even though the exception message is redacted. This is a code-path counterexample, not a claimed observation of an external provider.

The frozen [actual-broker adversarial test](../../test/action-broker-postclose-error-channel-073.test.js) uses a real loopback HTTP provider, encrypted durable authorization store, a fresh broker that independently confirms closure before provider release, and private-dependent provider success/rejection. It also tests approved-open success/error and unapproved zero-dispatch controls. Prepatch expected-leak workflow SHA: `a92a6d3f49377be8953bdece251614b9e166d463`.

## Enforcement patch

[HUSH-073 broker patch](https://github.com/sushxnthd/hush/commit/750824b95bf80fb58814b2e08e1513a8129be2e8) rechecks `_scopeVerdict(ticket)` in the catch path before publishing an outcome-dependent status. If scope is closed, expired, unavailable or the verifier throws, the broker returns the **same** generic post-dispatch `deny` reason and null result digest as the successful-result suppression path. Authorized open-scope provider errors remain generic `error`; no raw exception text is returned. This changes only broker-owned result/status release, not the provider's request, side effects or response timing.

### Predicted and required matrix

| Condition | Prepatch status | Patched required status | Provider request |
| --- | --- | --- | ---: |
| Approved, close durably, provider 200 (private world 0) | deny | deny | 1 |
| Approved, close durably, provider 503 (private world 1) | **error (leak)** | **deny** | 1 |
| Approved, remains open, provider 200 | allow | allow | 1 |
| Approved, remains open, provider 503 | error | error | 1 |
| Unapproved | ask | ask | 0 |

**Verification tier at report creation:** static inspection of source and pre-registered test/patch only. Both the [prepatch expected-leak workflow](https://github.com/sushxnthd/hush/actions/runs/41214196702) and the [postpatch three-OS workflow](https://github.com/sushxnthd/hush/actions/runs/41214246601) were **queued**, not completed. Do not claim either counterexample reproduced or patch verified until the actual job logs pass. The postpatch workflow additionally reruns HUSH-060, HUSH-072 and scope-expiry controls. A future failure must be preserved and fixed before promoting the result.

## Scientific boundary and release blockers

This is a *new tested code path and enforcement consequence*, not a new general compositional information-flow theorem. A useful necessary condition is that every outcome-dependent observable must pass a final authorization check on **all asynchronous settlement branches**, including rejection. That condition is insufficient for egress confidentiality: the external provider already sees the request, and response timing, headers, length, errors, retries, cancellation and irreversible effects can still leak. Broker-side checks are not atomic with remote provider commits.

Production **BLOCKED** until externally reviewed provider-enforced commit authorization, authenticated idempotency and reconciliation, crash/restart and cancellation-race coverage, complete runtime/OS egress mediation and independent security review. Do not merge or deploy. Lucent remains `ABSTAIN_UNCALIBRATED`, production `BLOCKED`; no new human ratings or physical shutter evidence were obtained in this bounded secondary run.

## Hosted verification (2026-10-31, independently inspected)

**Prepatch attack reproduced:** [run 41214196702](https://github.com/sushxnthd/hush/actions/runs/41214196702), SHA `a92a6d3f49377be8953bdece251614b9e166d463`, completed successfully on Ubuntu, macOS and Windows. The frozen `HUSH073_EXPECT_LEAK=1` test passed **3/3 cases on each OS** (9 test executions). Its expected-leak assertion specifically requires world 0 to return `deny` and world 1 to return `error` after independently confirmed durable closure. This is a passing **attack reproduction**, not evidence of security.

**Patched closure verified:** [run 41214490180](https://github.com/sushxnthd/hush/actions/runs/41214490180), SHA `99c3637514b0de6142fad5aa76848f05b46aaa44`, completed successfully on the same three operating systems. Actual job logs were inspected: each OS passed **3/3 HUSH-073 tests** and **10/10 prior post-dispatch, cancellation and expiry regressions**. Aggregate: 39 successful Node test executions. Each OS also passed the [independent standard-library Python replay](hush_073_independent_replay.py) on **five sanitized real-broker scenarios** in `PATCHED_CLOSURE` mode and **seven deliberate negative controls** (21 independent tamper rejections across three OS runs). No raw private HTTP response or credential was uploaded.

**Interpretation:** A concrete private-dependent **broker-owned status channel** was reproduced before the patch and closed under the tested durable-revocation/HTTP-settlement interleavings after the patch. This is stronger than static code inspection, but does not prove general information-flow noninterference, end-to-end provider confidentiality, timing noninterference, malicious-adapter safety, crash-durable atomicity or production readiness. Release remains **BLOCKED**.
