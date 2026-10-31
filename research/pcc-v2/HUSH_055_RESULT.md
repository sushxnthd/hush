# HUSH-PCC-055 — transitive disclosure through a redacted receipt hash

**Date:** 2026-10-26. **Frozen before implementation:** [HUSH_055_FROZEN.md](HUSH_055_FROZEN.md), commit `76a553091987407a9b3dc4a1468ce46b9c8c4cc2`. **Evidence tier:** hosted-verified adversarial real-broker/loopback-HTTP test and independent offline dictionary replay (2026-10-25 UTC). This is a conditional insecure application projection, not a shipped Hush endpoint exploit or novel cryptographic result.

## Precise mechanism and frozen predictions

In the existing ActionBroker, the receipt contains `resultDigest=SHA256(canonicalize(result))`, and the receipt `hash=SHA256(canonicalize(receiptBody))` authenticates the body **including** `resultDigest`. An application that deletes only `resultDigest` but returns `hash` and the other receipt fields still exposes a low-entropy dictionary oracle. The observer can reconstruct the hidden digest for each candidate private result, insert it into the visible receipt body, and compare the reconstructed hash to the visible hash. Public random receipt IDs and timestamps do not prevent this: the attacker knows their actual values from the exposed receipt.

The [test](../../test/action-broker-receipt-hash-transitive-channel.test.js) runs a real broker with one approved execution per world and a loopback HTTP projection that omits both the raw private result and the immediate resultDigest. It enumerates `{privateFlag:'zero'}` and `{privateFlag:'one'}` using independent `sha256(canonicalize(...))` calculations, not a broker helper. Frozen prediction: **2/2 exact recovery** if the exposed hash is calculated as expected; zero explicit private-result or resultDigest fields in the HTTP body. A strict constant-status projection is the negative control, predicted byte-identical across the two worlds.

**Observed hosted result:** [GitHub Actions run 40231171291](https://github.com/sushxnthd/hush/actions/runs/40231171291) completed successfully at 2026-10-25 21:07 UTC on commit `c9186cfa71095346a42dd44c3a433bd393199438`. Its job logs show **2/2 HUSH-055 tests passed**: the actual ActionBroker/HTTP redacted-receipt test recovered both low-entropy private flags via the visible receipt hash, while the constant allowlisted HTTP projection was byte-identical across both private worlds. The same run passed the HUSH-054 direct-digest and HUSH-053 preapproval-hash adversarial controls (1/1 each). The production-readiness script returned nonzero with `status=block`, as required. A passing adversarial test here confirms a **negative security finding in an intentionally unsafe application wrapper**, not a positive privacy guarantee or an exploit of a shipped Hush endpoint.

## What this adds beyond HUSH-054

HUSH-054 established direct `resultDigest` dictionary leakage. HUSH-055 tests a *transitive* leak through the receipt's enclosing hash after the obvious field has already been redacted. This is a concrete compositional declassification failure. It is not a new hash attack or new general information-flow theorem. The general known rule is that a lower-trust projection must not reveal functions of non-declassified private values; removing a sensitive leaf field is insufficient when derived parent commitments remain.

## Enforcement and release consequence

The [release blocker](../pcc-runtime-product/HUSH_046_RELEASE_BLOCKER.md) and [production gate](../../scripts/production-readiness.mjs) now explicitly require independent proof against derived receipt-hash disclosure. Lower-trust applications must use a **positive allowlist** of independently declassified fields, rather than stripping `resultDigest` while retaining `receipt.hash`. The broker's internal authenticated receipt remains useful for authorized local audit; it must not be assumed safe for an unauthorized public observer.

The negative control does **not** validate network, timing, error, length, ordering, crash/restart, cancellation, subprocess, filesystem or OS-level egress noninterference. External security review and independently mediated runtime egress remain mandatory. Production stays **BLOCKED**, draft PR #45 remains unmerged. Lucent E002-371's physical human-validation blocker is unaffected.

## Reproduction

```bash
node --test test/action-broker-receipt-hash-transitive-channel.test.js
node --test test/action-broker-postapproval-result-digest-channel.test.js
node --test test/action-broker-preapproval-hash-channel.test.js
node scripts/production-readiness.mjs --json
```

Dedicated [hosted workflow](../../.github/workflows/hush-055-receipt-hash.yml) and [successful verification run 40231171291](https://github.com/sushxnthd/hush/actions/runs/40231171291). This does not verify crash/restart, cancellation, network egress, timing, or external deployment safety. Preserve the negative result and release blockers.
