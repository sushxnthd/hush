# HUSH-PCC-054 — postapproval result-digest dictionary channel

**Date:** 2026-10-25. **Frozen first:** [HUSH_054_FROZEN.md](HUSH_054_FROZEN.md), commit `45ad310`. **Evidence tier:** adversarial real-ActionBroker + loopback HTTP test, not a deployed vulnerability or a novel cryptographic result.

## Hypothesis and end-to-end experiment

The broker's `safeReceipt` contains `resultDigest=SHA256(canonicalize(result))`. An approved *execution* need not authorize disclosure of its *private result* to every observer of the receipt. The [test](../../test/action-broker-postapproval-result-digest-channel.test.js) constructs two worlds with identical public requests, one approved broker execution each, and trusted adapter results `{privateFlag:'zero'}` versus `{privateFlag:'one'}`.

An **intentionally insecure application HTTP wrapper** hides the result itself but returns `decision:'allow'`, `status:'allow'`, `resultVisible:false`, and the receipt's `resultDigest`. The observer independently enumerates `SHA256(canonicalize({privateFlag:candidate}))` for the two possible private results. The frozen prediction is exact **2/2 dictionary recovery**, despite never receiving the result. A wrapper suppressing the digest and every other result-dependent field is the indistinguishable control. The test explicitly checks that the request hashes are the same across worlds, no credentials resolve, and each world has exactly one approval, execution and receipt.

This is **not** evidence that an existing shipped Hush HTTP API publishes such receipts, nor that an observer with legitimate result-read permission has been harmed. The vulnerability exists **only under the specified trust split**: execution approval is granted to one principal, but the receipt projection is exposed to another who lacks result authorization. Result-digest leakage is a classical dictionary attack, not a new information-theoretic law.

## General lifecycle consequence

HUSH-053 shows that a *preapproval request hash* can disclose a low-entropy private input. HUSH-054 tests the dual *postapproval result hash* disclosure. A compositional noninterference contract must specify authorized declassification separately for request inputs, action execution, result payload, receipts, logs, errors, length, timing, ordering and crash/cancellation effects. A cryptographic digest is not inherently a confidentiality-preserving projection. A broker-owned receipt may be authentic yet still reveal information to a lower-trust reader.

The [production-readiness blocker](../../scripts/production-readiness.mjs) now explicitly requires independent evidence covering **postapproval private-result digests**, in addition to preapproval hash/order/timing channels. The existing external attestation is still missing. Strict production status must remain **BLOCK**. No deployed fix or external security review is claimed.

## Reproduction and limitations

```bash
node --test test/action-broker-postapproval-result-digest-channel.test.js
node --test test/action-broker-preapproval-hash-channel.test.js
node scripts/production-readiness.mjs --json
```

[Dedicated CI](../../.github/workflows/hush-054-result-digest.yml) verifies the negative control and strict release blocker. Hosted status must be checked independently. No real credentials, third-party providers, independent OS-level egress confinement, crash/restart proof or deployment readiness is established. Preserve the established research branch, draft PR #45 and separate Lucent primary workflow; no merge.
