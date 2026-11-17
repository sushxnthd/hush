# HUSH-PCC-075 | Adapter-registration substitution after approval

Date: 2026-11-02. Bounded Hush secondary workstream. [Frozen protocol](HUSH_075_FROZEN.md) committed at `eb1f7ee` before the test and patch. Evidence tier: **SOURCE_LEVEL_COUNTEREXAMPLE_WITH_REAL_HTTP_TEST_COMMITTED; HOSTED_EXECUTION_PENDING**.

## Failure mode and predicted real-effect witness

The previous `ActionBroker.registerAdapter` overwrote the executable under a previously registered name. A ticket was bound to adapter name, action and authorization scope, **not the particular executable registered when the ticket was approved**. Therefore a replacement implementation with the same declared scope could receive an old approved ticket. This is a classic local time-of-check/time-of-use problem, not a new information-flow theorem.

The frozen [real loopback HTTP test](../../test/action-broker-adapter-generation-075.test.js) creates a benign adapter, issues and approves a ticket, re-registers a new adapter of the same name/action and identical declared scope that POSTs to an actual local HTTP receiver, then executes the old ticket. Both unscoped and scoped/certified paths are exercised. **Predicted prepatch result:** one POST in each old-ticket scenario; new approved tickets remain functional. Prepatch [workflow](../../.github/workflows/hush-075-adapter-generation.yml) was committed with `HUSH075_EXPECT_BYPASS=1` at `0951491`, preserving a pinned prepatch CI attempt. Hosted prepatch outcome had **not** been verified when this report was written; do not describe expected effects as observed until the run passes.

## Narrow patch and controls

[Patch `52f672d`](https://github.com/sushxnthd/hush/commit/52f672d20c51ce2750a55469d174d5bfb58e3d1b) assigns an unpredictable 128-bit registration generation to each trusted adapter registration, snapshots that generation in each ticket and includes it in the request commitment. The `_scopeVerdict` check now fails closed with `ADAPTER_REGISTRATION_CHANGED` if the executable's registration generation differs from the approved ticket, including on the unscoped path and at the post-credential pre-dispatch recheck. A missing adapter returns `ADAPTER_REGISTRATION_MISSING`. Registration epochs are not exposed through `listAdapters`.

The [patched workflow](../../.github/workflows/hush-075-adapter-generation.yml) now requires zero old-ticket HTTP effects, one authorized new-ticket effect and unaffected unrelated adapter registrations, plus existing mandatory-certificate, revocation-race and observable-closure regression suites. The workflow change was committed at `81415bf`. **Hosted patched verification is pending**. The implementation was not independently replayed in a local checkout in this run; this is a committed candidate fix, not a confirmed secure deployment.

## Limits and release consequence

The generation token binds the approval to a trusted in-process registration event; it is **not** code attestation, an OS egress fence, a provider-side idempotency guarantee or a compositional noninterference certificate. A hostile in-process adapter can still perform external effects after dispatch, and crash/restart/cancellation/provider-commit limitations remain. External review remains required. Hush release **BLOCKED**, PR #45 draft/unmerged. Lucent primary branch/PR not modified by this Hush experiment.
