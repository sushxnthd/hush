# HUSH-PCC-059 | Frozen oversized-result digest information-flow attack

Frozen 2026-10-28 **before executing the new real-broker test or changing broker code**. Existing Hush branch `breakthrough-engine/transaction-scope-recovery-20261021` and draft PR #45; Lucent E002-371 remains primary.

## Hypothesis and adversarial worlds

The current ActionBroker truncates sanitized results above 128 KiB and returns a deterministic SHA-256 digest of the **unreturned full result**. An approved but output-size-restricted agent can use that digest as a low-entropy private-result oracle. This violates the narrower contract that truncation suppresses *content*, although a truncation indicator already leaks the size class. It is not an exploit of cryptographic SHA-256 and does not claim that approval itself was bypassed.

Freeze two worlds, identical except for a hidden one-bit provider value `privateChoice = 0` or `1`, embedded in a >128 KiB JSON response with public, known padding. An actual loopback HTTP provider returns the JSON; a registered trusted adapter fetches and parses it; ActionBroker executes after explicit approval. The agent observes **only** the broker's returned result and receipt, never the raw provider response. Attack reconstructs the two possible full-result digests and guesses the hidden bit.

### Prespecified kill and fix

- Prepatch prediction: both worlds yield `decision=allow`, `truncated=true`, a 64-character `digest` field; digest lookup identifies the hidden bit in **2/2** worlds.
- Patch: remove the digest of the suppressed full result from the truncated broker output. Keep `truncated=true` and a fixed public reason. The receipt may hash only the **released public truncation object**, never the private full result. Do not remove the receipt integrity hash or normal, explicitly authorized small-result behavior.
- Postpatch prediction: 2/2 worlds yield identical public result payloads (apart from receipt nonce/time), with no raw-result digest, no private bit, and zero credential leakage. The public result digest in the receipt, if present, must equal the hash of the **public** truncation object in both worlds. The attacker cannot distinguish the worlds using these outputs.
- Controls: a small result remains readable after approval; an unapproved action does not dispatch; the actual HTTP effect occurs exactly once in each approved world. Do not claim timing, memory, request size, provider logging or all side channels are covered.
- Independent test of the before/after behavior on the actual broker. No production deployment. Keep Hush release blocked pending external review and full runtime mediation.

## Security meaning

The experiment is a **finite two-world end-to-end noninterference counterexample and enforcement correction**, not a general compositional theorem or novel cryptography. The stronger proposed rule is: every observable returned after a suppression boundary must be a function of the explicitly released projection, not a digest or commitment of suppressed material. A complete law requires additional timing, crash/restart, cancellation and egress observables. No false readiness claim.
