# HUSH-PCC-059 | Broker-owned oversized-result digest oracle

Date: 2026-10-28. Secondary Hush workstream; existing branch and draft PR #45.

## Prior work and novelty correction

HUSH-054 already demonstrated a dictionary attack on a **deliberately insecure application projection** of a postapproval receipt digest. HUSH-055 showed that removing `resultDigest` while retaining a transitive receipt hash can preserve that leak. HUSH-059 is **not a new general information-flow theorem**. Its distinct question is whether the *actual ActionBroker's own* oversized-result suppression path directly returns a commitment to data that it withholds. No intentionally insecure application projection is required.

## Frozen two-world attack and enforcement

[Frozen before code change](HUSH_059_FROZEN.md) at commit `7e15a34`. [Real-broker loopback HTTP test](../../test/action-broker-truncated-result-digest.test.js) makes an explicitly approved adapter fetch a >128-KiB predictable JSON result from a local HTTP provider. The two private worlds differ only by one low-entropy bit. The original broker returned a truncation object containing `digest: sha256(canonicalize(full_private_result))`; an attacker with the known candidate set can identify the bit by digest lookup. This is a concrete code-path vulnerability, not a cryptographic break. The test also checks that unapproved requests do not dispatch and approved small public results remain readable.

[Patch a5c028e](https://github.com/sushxnthd/hush/commit/a5c028e88e3eabc0553a9c110d7bb06bfbcdd306) removes the digest of the suppressed full result. The receipt continues to hash the **released public truncation object** and retains its normal integrity commitment. The truncated flag and reason still disclose a size class. The patch cannot prevent timing, provider-side, process-crash, side-channel or adapter bypass leakage.

## Verification status

- [Prepatch hosted expected-leak test](https://github.com/sushxnthd/hush/actions/runs/40729665009): **queued at report creation**, not verified.
- [Postpatch hosted two-world test](https://github.com/sushxnthd/hush/actions/runs/40729735715): **queued at report creation**, not verified.
- A workflow typo in the name of the existing HUSH-057 regression test was fixed before final verification. Preserve that failed workflow attempt if it occurs; do not report a pass without exact run confirmation.
- The patch and tests are committed but not independently verified yet. No actual production provider, external reviewer or deployment involved.

## Enforcement consequence and limits

**Release projection principle:** a suppressed result must not be committed into any lower-trust observable, including a hash of the full result. A safe public receipt can commit to the public projection; this does not establish complete noninterference over time, resource usage, crash/retry, cancellation or out-of-process egress. A complete compositional law must account for those observables and provider-side effects.

**Hush production: BLOCKED** pending independent hosted verification, full egress mediation, crash/restart/cancellation controls and external security review. Lucent E002-371 remains primary; its separate branch and PR are not modified by this Hush experiment. No merge, force-push or deployment.
