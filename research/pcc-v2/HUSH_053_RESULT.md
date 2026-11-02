# HUSH-PCC-053 — preapproval public request-hash dictionary channel

**Date:** 2026-10-25. **Frozen before implementation:** [HUSH_053_FROZEN.md](HUSH_053_FROZEN.md), commit `da0ef8f6fe71351e06b080538079a64e1c128935`. **Evidence tier:** new real-ActionBroker loopback-HTTP adversarial test committed; hosted CI status must be checked separately. This is an **intentionally insecure application projection**, not a demonstrated vulnerability in a shipped Hush endpoint.

## Causal hypothesis and test design

`ActionBroker.request` creates `requestHash=SHA256(canonicalize(requestBinding))` and includes it in the returned `safeTicket`. The binding includes request `arguments`, while `safeTicket` excludes their raw values. Under the explicit threat model where **trusted server code** injects a private low-entropy argument (`privateFlag` equal to `zero` or `one`) and publishes the safe-ticket hash through an HTTP wrapper, the observing client can calculate the two candidate hashes offline. A SHA-256 digest is not a hiding commitment for a two-element private domain.

The [test](../../test/action-broker-preapproval-hash-channel.test.js) uses a real `ActionBroker` instance and local HTTP listener in each world. It exposes only `decision`, `approved` and `requestHash`, never the private argument itself. An **independently implemented** candidate-binding hash calculation (using the repository's public `canonicalize` and `sha256` primitives, without calling `ActionBroker`) is compared against the observed digest. The test predicts exact **2/2 recovery** with zero approval, zero adapter execution, zero credential resolution and zero provider effects. A projection that suppresses the hash and all other private-dependent fields must give identical HTTP bodies for both worlds.

This is a different leakage mechanism from HUSH-052's response-completion order: a **deterministic value channel** exists even when the observer ignores ordering and latency. Together, they demonstrate that a compositional authorization/noninterference claim must cover both public *values* and whole runtime *traces*. The observation projection is part of the security contract, not a cosmetic API decision.

## Enforcement consequence

The existing `runtime-observable-order.json` independently reviewed release attestation remains absent and required. The release gate label in `scripts/production-readiness.mjs` now explicitly includes **public-hash** along with order/timing noninterference; no attestation has been forged and the strict release result must remain `BLOCK`. An actual mitigation requires a reviewed public/private schema, removal of private-derived unkeyed digests from lower-trust responses, and independent end-to-end verification across adapters, HTTP surfaces, cancellation and crash/restart. A keyed commitment or secret salt may change the offline attack but is not by itself a general whole-runtime noninterference proof.

## Reproduction and limitations

```bash
node --test test/action-broker-preapproval-hash-channel.test.js
node --test test/action-broker-preapproval-order-channel.test.js
node --test test/action-broker-real-network-counterexample.test.js
node scripts/production-readiness.mjs --json
```

The dedicated [HUSH-053 workflow](../../.github/workflows/hush-053-preapproval-hash.yml) runs the real broker test, HUSH-052 and HUSH-046 negative controls, and verifies that the production release remains blocked. The tests use no third-party providers or real credentials. No actual private customer data, arbitrary OS process confinement, timing leakage bound, crash-restart idempotency proof or deployment-ready system is established here.

**Threat-model boundary:** If the observing agent itself supplied `privateFlag`, it already knows the value and this test does not show a new confidentiality violation. Likewise, the intentionally constructed wrapper is not evidence that an existing shipped Hush API injects and exposes this exact private input. The result is a concrete **compositional API-design counterexample** against treating deterministic hashes as private-safe solely because they hide raw arguments. Standard dictionary attacks and observational noninterference are established theory; no novelty claim is made.

**Status:** implementation and independent reproduction instructions committed on existing Hush branch; hosted CI pending verification. Draft PR #45 must remain open and unmerged. Lucent's primary human-validation workflow was not replaced or rescheduled.
