# HUSH-PCC-054 — frozen postapproval result-digest disclosure test

**Frozen:** 2026-10-25. **Evidence tier:** adversarial end-to-end loopback HTTP wrapper around a real ActionBroker, not an exploit of a shipped endpoint. **Primary workstream:** Lucent E002-371; Hush receives bounded secondary effort.

## Hypothesis

The broker's `safeReceipt` includes `resultDigest=SHA256(canonicalize(result))`. If trusted adapter code returns a **private low-entropy result** and a lower-trust HTTP wrapper suppresses the result but publishes its receipt digest, the observer can enumerate candidate results offline. Successful authorization of *execution* is not automatically authorization to disclose the *result*. This is the postapproval counterpart to HUSH-053's preapproval request-hash dictionary channel.

## Frozen test

- Two worlds differ only in private adapter result `{privateFlag:'zero'}` versus `{privateFlag:'one'}`; same public action metadata, consent and response schema.
- Each world uses a real ActionBroker, one approved request, one actual adapter execution, and a real loopback HTTP response. Wrapper returns only `decision:'allow'`, `resultVisible:false`, `status:'allow'`, and `resultDigest`. No private result or credentials in HTTP body.
- Independently compute `SHA256(canonicalize({privateFlag:candidate}))` for two candidates, without calling ActionBroker, and require exact 2/2 recovery. Verify exactly one approval and one adapter execution per world.
- Negative control: suppress resultDigest and all other result-dependent fields; public bodies must be identical. Do not infer anything from timing, action IDs or randomized receipt hashes.
- A deliberately public-result control must not be labeled a confidentiality violation. Test must not claim that a shipped Hush endpoint has this wrapper.
- Production release blocker must explicitly cover **postapproval result-digest** disclosure and remain BLOCK; no external security attestation may be forged.

## Scientific and enforcement boundary

This is standard low-entropy hash dictionary disclosure and compositional information-flow accounting, not novel cryptography. Enforcement consequence: define public/private result-schema labels, treat digest/length/error/truncation as potential declassifications, and only publish broker-owned approved projections. End-to-end audit must include restart, cancellation, timing/order, logs and provider side effects. Do not merge or claim deployment readiness without independent review.
