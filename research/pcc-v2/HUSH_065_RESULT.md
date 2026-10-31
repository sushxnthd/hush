# HUSH-065 RESULT | Pre-dispatch authorization check can race with durable revocation

2026-10-30. Secondary Hush workstream, established research branch and draft PR #45. Preregistered at commit `58dfe8cbc495dc72f4a0ddba2ffa17bb20a5a339` **before** adding the attack. Executable committed at `a0fb4370bd3373a40bff02afbf033ef75368ac7e`, CI workflow at `5bbc420a3c963267ccd34024f190a5975b7111ee`.

## Targeted source-level failure

`ActionBroker.execute()` invokes `_scopeVerdict()` before adapter dispatch, but the latter reads durable state without holding the HUSH-064 exclusive write lock across the read and subsequent provider invocation. A second OS process can durably close the authorization transaction **after the first process has read an open snapshot but before its adapter sends a credential**. The existing completion recheck suppresses the broker-to-agent result, but cannot undo an HTTP provider effect. This is a standard time-of-check/time-of-use effect-boundary limitation, not a new universal information-flow theorem.

## Frozen runtime counterexample and controls

The committed Node 22 test uses an encrypted real filesystem store, two private synthetic credential worlds, an independent child process for durable closure, a real loopback HTTP POST adapter, and an interposition only at the store's final pre-dispatch `load()` snapshot. The adapter itself and its authorization scope are not modified after ticket approval. The child must finish durable closure before the HTTP adapter starts. The expected counterexample is one POST containing the synthetic private credential per world after revocation, while the broker's completion-time verdict is deny and its receipt has no private-result digest. A separate control closes authorization before the first scope check and expects zero HTTP effects.

**Evidence status at initial report:** code and exact interleaving committed; hosted run [40951444501](https://github.com/sushxnthd/hush/actions/runs/40951444501) was queued. The predicted HTTP leakage must not be reported as observed until the dedicated hosted test passes. A passing test would mean the **attack succeeded**, not that security is proven. No real private data, production provider or non-loopback network is involved.

## Compositional consequence and enforcement scope

Let `B` denote broker-visible output and `P` denote provider-visible effects. Completion-time reauthorization can enforce a limited `B` suppression rule after revocation, but it does **not** imply suppression of `P` for an already-started or racing dispatch. Any compositional privacy claim must explicitly include adapter dispatch and provider effects in its observation boundary, rather than proving only that the broker returned `deny`.

The security objective must be specified relative to a **linearization point**: whether a revocation committed before an effect begins, before the provider accepts it, or before an irreversible effect completes. A generic broker cannot roll back a completed HTTP POST. A production design therefore needs adapter/provider cooperation, e.g. a revocation-epoch-bound capability checked at the effect-commit boundary, or a carefully specified exclusive lease that orders revocation against dispatch and handles cancellation, crash/restart, lock recovery, retries and idempotency. These are design requirements, **not implemented fixes or proven sufficient mechanisms**.

## Release blocker

Hush remains BLOCKED: effect-boundary revocation, cancellation, restart, multi-process coordination, hostile local process assumptions, replay and independent security review are not closed. HUSH-064's durable-write serialization remains useful but does not establish end-to-end noninterference. No merge, force-push or deployment. Lucent's primary branch and PR #26 remain untouched; physical shutter calibration and independent blinded anatomical ratings are still missing, so Lucent stays ABSTAIN_UNCALIBRATED and BLOCKED.

## Hosted adversarial verification (2026-10-29 20:43 UTC)

[GitHub Actions run 40951557208](https://github.com/sushxnthd/hush/actions/runs/40951557208) **completed successfully** on the research PR merge checkout. Node 22.23.4 executed the frozen two-world real-HTTP counterexample and its before-first-check control: **2/2 tests passed, 0 failed**. The attack test asserts, separately in both synthetic private worlds, that an independent OS process durably closed authorization before adapter dispatch, the provider nevertheless received exactly one HTTP POST containing that world's private credential, and the broker returned deny with no private-result digest. The control verifies zero HTTP effects when revocation precedes the first scope check. These assertions ran against the repository's actual ActionBroker and encrypted store, not a mocked broker.

**Interpretation:** Hosted success confirms the **security counterexample**, not an enforcement fix. The affected boundary is provider-visible effects after durable revocation, while completion-time broker output suppression still held in this test. A patch with a precisely specified revocation/effect linearization point remains required; deployment stays BLOCKED. This does not establish that every provider or timing interleaving leaks, and it does not constitute an externally reviewed security assessment.
