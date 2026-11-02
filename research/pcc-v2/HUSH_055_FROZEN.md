# HUSH-PCC-055 — frozen transitive receipt-hash disclosure experiment

**Date:** 2026-10-26. **Evidence tier planned:** adversarial real-ActionBroker + loopback HTTP, two low-entropy private-result worlds, independent offline replay. **Status:** FROZEN BEFORE TEST IMPLEMENTATION.

## Scientific question
HUSH-054 showed direct `receipt.resultDigest` leakage under an intentionally insecure public wrapper. Does removing that field suffice if the wrapper still exposes `receipt.hash` and the remaining receipt fields? The broker computes `resultDigest=SHA256(canonicalize(result))` and `hash=SHA256(canonicalize(receipt-without-hash))`. The composition can leak a low-entropy result even if the immediate digest is redacted.

## Frozen prediction and independent oracle
Construct two otherwise identical authorized requests, each with exactly one approval and one real broker execution. Adapter results differ only in private `{privateFlag:'zero'}` vs `{privateFlag:'one'}`. The HTTP observer has **no private-result authorization**. An intentionally unsafe wrapper returns all receipt fields except `resultDigest`, including `hash`, and never returns `result`.

An independent offline oracle (not invoking ActionBroker) enumerates the two possible private results, computes `candidateDigest=SHA256(canonicalize({privateFlag:candidate}))`, inserts it into the observed receipt fields, and computes `SHA256(canonicalize(candidateReceiptBody))`. **Prediction: 2/2 correct private-flag recovery** by matching the exposed receipt hash. A public-safe control emits only a constant allow/completed status, with no receipt hash, digest, IDs, timing, or any result-dependent metadata; **prediction: identical public bodies** across the two worlds. Verify identical public request hash internally and one approval/execution/receipt per world.

## Falsification and limits
Reject the claimed transitive channel if the independent oracle cannot recover both values or if the exposed wrapper actually includes the private result/digest. Reject the safe-control claim if its HTTP response differs across the two worlds. This experiment demonstrates a **conditional application-projection leak**, not a shipped HTTP vulnerability or a new cryptographic primitive. Random receipt IDs and timestamps are allowed: the attack conditions on the observed public receipt fields. The control does not establish timing, length, error, logging, network, cancellation, or crash/restart noninterference.

## Product consequence
For lower-trust observers, dropping `resultDigest` is **insufficient** if a derived `receipt.hash` and its preimage metadata remain observable. Enforce a strict positive allowlist of independently authorized public outputs; do not expose private-result-dependent commitments to unauthorized observers. Keep production readiness BLOCKED pending independent OS/runtime mediation and external review. Do not modify or merge Lucent PR #26; preserve Hush PR #45 as draft.
