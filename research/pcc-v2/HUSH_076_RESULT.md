# HUSH-PCC-076 | Trusted mandatory-certification policy resists caller downgrade

Date: 2026-11-02. Secondary Hush workstream. Evidence tier: **REAL PREPATCH LOOPBACK HTTP COUNTEREXAMPLE CONFIRMED; PATCHED ADVERSARIAL AND SELECTED BROKER REGRESSIONS HOSTED-VERIFIED**.

## Observed counterexample (not a general theorem)

[Frozen protocol](HUSH_076_FROZEN.md) was committed at `bc6e81f` before the adversarial test. The real [prepatch GitHub Actions run #41433489457](https://github.com/sushxnthd/hush/actions/runs/41433489457) completed **success**, including the specifically pinned `HUSH076_EXPECT_BYPASS=1` step. The test registered an adapter with an authorization-scope map, lifecycle-trace map, broker-owned observable-closure map and a proposed trusted `enforcement` object, then issued an *unscoped* request with all caller certificate flags omitted. The prepatch broker ignored the new trusted-policy field, approved the request locally, returned `allow`, and dispatched exactly **one real loopback HTTP POST**. Its receipt had `transactionId=null`. These effects were asserted in the executed test, not inferred from a mock decision. The remaining prepatch-mode test bodies were intentionally not run; the reported 5/5 Node test summary is **not** evidence of the postpatch controls.

This is a **configuration downgrade**, not evidence that all legacy unscoped actions are unsafe. It matters only when the trusted operator intends transaction/trace/closure certification to be mandatory. The HUSH-074 guard prevents explicitly mandatory caller flags without a transaction, but cannot protect against a caller simply omitting the flags.

## Enforcement change

[Patch `ba03f37`](https://github.com/sushxnthd/hush/commit/ba03f376ce91797e29e95154d81ef7202ac32e6a) adds a trusted `registerAdapter(..., enforcement)` policy with strictly boolean `transactionRequired`, `lifecycleTraceRequired` and `observableClosureRequired` keys. The two certificate requirements are invalid without `transactionRequired=true`. All default false for backward compatibility.

- A protected adapter rejects missing transaction at request time, before ticket creation or secret resolution.
- Required lifecycle and observable-closure checks are **forced on** by the trusted adapter registration even when the AI-facing request omits its flags.
- The dispatch/completion scope verifier rejects forged or legacy tickets that omit a trusted-required transaction or certificate. HUSH-075's registration-generation check remains in place.
- A missing broker-owned closure must deny before adapter execution. A correctly certified scoped request and an ordinary unscoped adapter must remain functional.

The [real HTTP adversarial test](../../test/action-broker-trusted-enforcement-076.test.js) and [dedicated workflow](../../.github/workflows/hush-076-trusted-enforcement.yml) include positive, negative, malformed-policy, legacy-tampering and compatibility cases, plus the existing broker, HUSH-074/075, transaction and observable-closure regression suites. The patched workflow was committed at `61f303c`. [First patched hosted run #41433603947](https://github.com/sushxnthd/hush/actions/runs/41433603947) executed the five HUSH-076 real-HTTP and tampering tests **successfully (5/5)**. The broader regression step **failed (1/28)** because a pre-HUSH-075 test demanded the older `LOCAL_AUTHORIZATION_COMMITMENT_MISMATCH` error even though the newer adapter-generation guard correctly denied first with `ADAPTER_REGISTRATION_CHANGED`; no unauthorized HTTP effect was observed in that failed assertion. [Test expectation correction `5e911cb`](https://github.com/sushxnthd/hush/commit/5e911cb7d17913bc61a377e2db12e0e5ad7868f5) accepts either fail-closed reason while retaining the zero-effect assertion. The [corrected hosted rerun #41433860506](https://github.com/sushxnthd/hush/actions/runs/41433860506) **completed successfully**: 5/5 HUSH-076 adversarial tests and 28/28 selected existing broker/scope regressions passed, as confirmed by job steps and logs. The earlier failed run is preserved as a historical test-expectation mismatch. This is scoped local loopback enforcement evidence, **not** a full repository test suite, external security review or production certification.

## Compositional interpretation and release consequence

An authorization certificate is only a meaningful enforcement premise when its *requirement* is bound by the trusted execution context, rather than selected by the potentially adversarial caller. In this local broker, the policy floor is now a trusted registration attribute. This is a conventional security principle, not a claim of novel noninterference theory. The result says nothing about OS egress mediation, malicious trusted adapters, provider-side idempotency, crash/restart, cancellation, external clock trust, or side channels.

**Release remains BLOCKED**, pending successful patched CI and independent runtime/security review. Existing Hush draft PR #45 remains unmerged. Lucent's independent E002-371 branch and PR #26 were not modified; no new human or physical Lucent evidence was obtained during this bounded secondary experiment.
