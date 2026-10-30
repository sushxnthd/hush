# HUSH-067 RESULT | Provider-accepted work survives local abort and broker death

Date: 2026-10-30. Existing Hush secondary branch and draft PR #45. Protocol frozen at `b2ffe825` before executable tests. **Current evidence tier: executable adversarial runtime protocol and independent trace verifier, with hosted results pending. No hosted success is claimed in this initial report.**

## Scientific question

HUSH-066 proved that a local cooperative effect fence cannot prevent a provider from committing work queued before a durable authorization closure. HUSH-067 tests a stronger operational failure: **what if the HTTP client actually aborts or the broker process dies while waiting for the provider?** Neither event is a remote cancellation certificate.

The tests exercise a real loopback HTTP server that consumes the full credential-bearing request, retains a queued operation and withholds its response. The test controls when the provider subsequently commits. Synthetic credentials are never used outside the test. Two distinct credential worlds are run per interleaving.

## Frozen predictions and executable

| Interleaving | Required observation | What it does NOT prove |
| --- | --- | --- |
| Provider receives POST; client AbortController aborts fetch; broker returns error; independent closer durably closes; provider commits | Local abort and durable closure can precede a provider effect | Does not prove a real external provider ignores a cancellation API |
| Provider receives POST; separate broker OS process is killed; restarted broker denies orphan lock; independent closer reports LOCKED; provider commits | Crash fail-closed and post-crash provider effect can coexist | Does not prove remote commit ordering across real provider clocks |
| Two synthetic credential worlds for each case; sanitized NDJSON histories independently replayed in Python | Four histories and no raw credential in traces | Does not establish production noninterference or a security audit |

Files: [frozen protocol](HUSH_067_FROZEN.md), [Node adversarial test](../../test/action-broker-cancellation-crash-067.test.js), [Python independent replay](hush_067_independent_replay.py), [three-OS CI](../../.github/workflows/hush-067-cancellation-crash.yml).

## Compositional observability limitation

Consider two provider executions with identical broker-local observations through revocation: both accept a request, then the broker aborts or dies, and local authorization closes (or remains locked). In execution A, the provider discards the queued job. In execution B, it commits the queued job. The broker-local trace cannot distinguish A from B. Therefore no predicate over *only broker-local events* can certify absence of post-closure provider effects. This is an elementary indistinguishability argument, **not a novel general information-flow theorem**.

A necessary enforcement condition for a strong post-revocation provider-effect guarantee is that **every path from accepted work to irreversible effect passes through an enforceable provider commit-point authorization check**, with revocation ordered against that check. Merely cancelling a fetch, suppressing a result, serializing dispatch, or denying restart is insufficient. This is an engineering cut-set criterion, not a sufficient end-to-end proof without trustworthy provider enforcement and crash recovery.

RFC 9110 §9.2.2 independently cautions that clients cannot generally retry non-idempotent requests after ambiguous transport failures without knowledge that the original request was not applied: https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2

## Reproduction and evidence

```bash
HUSH067_TRACE_OUT=hush067-trace.ndjson node --test test/action-broker-cancellation-crash-067.test.js
python research/pcc-v2/hush_067_independent_replay.py hush067-trace.ndjson
```

The workflow runs Node 22 and Python 3.12 on Ubuntu, Windows and macOS, preserving sanitized trace artifacts. As of initial report, hosted CI is **queued**, and any failures must be investigated and recorded rather than treated as positive evidence. Trace events represent the test fixture's own event ordering; they are not externally authenticated remote provider timestamps.

## Enforcement consequence and release blockers

- Never represent `AbortController.abort()`, a broker error, an OS process exit or local durable revocation as successful cancellation of already accepted provider work.
- Require provider-supported operation IDs, commit-point revocation epochs, explicit cancellation acknowledgement, idempotency and post-crash reconciliation for any stronger claim. A client-side-only provider cannot guarantee post-revocation remote-effect absence.
- An orphan lock is a conservative denial mechanism, not an operator-safe recovery protocol. No automatic lock stealing.
- Do not use raw provider results or credential-bearing error strings as evidence, logs or receipts.
- Release blocker: independent adversarial replay against a real provider integration, audited commit-point policy, authenticated crash recovery, cancellation/race semantics, threat-model review and production integration all remain outstanding.

**Hush release remains BLOCKED; no merge or deployment.** Lucent primary E002-371 remains `ABSTAIN_UNCALIBRATED` and production BLOCKED. Lucent E002-540 hosted run 41017394685 completed successfully, verifying its synthetic code only. No new human anatomical ratings or authenticated physical camera measurements were obtained in this bounded Hush run.
