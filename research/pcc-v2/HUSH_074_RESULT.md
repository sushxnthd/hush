# HUSH-PCC-074 | Mandatory-certificate omission permits real adapter effects

Date: 2026-11-01. Secondary Hush kernel, separate from Lucent. [Frozen protocol](HUSH_074_FROZEN.md) was committed at `297a1f2` before the test or patch.

## Verified prepatch counterexample

[Hosted run 41263159355](https://github.com/sushxnthd/hush/actions/runs/41263159355), exact unpatched source SHA `3a7a879ac28d910f891cbcf762541c3735c2c532`, completed **success**. Actual job steps and logs were inspected: 5/5 Node tests passed in **expected-bypass** mode. These are expected-counterexample assertions, **not** proof of secure behavior.

- An actual `ActionBroker` ticket requested `requireObservableClosureCertificate:true` with no `transactionId`; after local approval it dispatched a real loopback HTTP POST. **One effect.**
- The same omission with `requireLifecycleTraceCertificate:true` also dispatched. **One effect.**
- Two separately constructed legacy tickets, each requiring one certificate after ticket creation but lacking a transaction, also dispatched. **Two effects.**
- An ordinary unscoped action remained blocked before local approval, then produced exactly one expected legitimate effect after approval. A nonexistent explicit transaction was rejected.

The source-level cause is precise: certificate evaluation in `request` was conditional on `transactionId!=null`, while `_scopeVerdict` returned `UNSCOPED` before considering required-certificate flags. This violates the local composition invariant `require(C) => transactionPresent && certificateValid(C)`. This is an ordinary conditional-guard bypass, not a new information-flow theorem. The tested observer is an actual local HTTP receiver; this is **not** a production exploit claim.

## Narrow enforcement patch

[Patch eb7281a](https://github.com/sushxnthd/hush/commit/eb7281a326c748ad6f4d1ef3059da51e43a86c2e) adds two fail-closed guards:

1. `request` rejects any mandatory lifecycle or observable-closure certificate request without a transaction **before issuing a ticket** (`MANDATORY_CERTIFICATE_REQUIRES_TRANSACTION`).
2. `_scopeVerdict` independently rejects a legacy/forged unscoped ticket with either required flag (`REQUIRED_CERTIFICATE_WITHOUT_TRANSACTION`) before credentials, adapter entry or HTTP egress.

Ordinary unscoped actions with neither mandatory flag are deliberately unchanged; existing scoped-certificate behavior is not weakened. [Patched workflow](../../.github/workflows/hush-074-required-certificate.yml) includes the same real HTTP test, an independent Python trace oracle with five tamper controls, and previous broker regressions. [Hosted patched run 41263213372](https://github.com/sushxnthd/hush/actions/runs/41263213372) subsequently completed **success**; its job logs were independently inspected on 2026-11-01. The patched five-test broker suite passed 5/5; real loopback HTTP effects for mandatory-certificate omission and forged/legacy unscoped required tickets were **0**, while the approved ordinary-action control produced **1** expected effect. Independent Python trace replay passed its self-test and five tamper controls; 11 existing broker regression tests also passed. This verifies the narrow local fix under the tested harness, **not** arbitrary runtime noninterference. The intermediate `eb7281a` run used the still-prepatch expected-bypass workflow and failed as expected after the fix; it is not a regression verdict.

## Limits and release consequence

This establishes a concrete, narrow certificate-enforcement bug and a candidate patch. It does not establish compositional noninterference for arbitrary in-process adapters: independent runtime egress mediation, crash/restart and cancellation, provider commit semantics, timing/order side channels, and external review remain missing. **Production BLOCKED**; no merge, deployment, force-push or release-readiness claim.

**Lucent E002-371 remains the primary workstream**, its branch/PR untouched. No physiological measurements, shutter calibration, certified speed ceilings or held-out physical predictions were obtained in this Hush run.
