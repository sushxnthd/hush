# HUSH-PCC-052 — freeze: preapproval completion-order compositional leak

Date 2026-10-24. Existing branch and PR #45. **Secondary bounded experiment; no deployed vulnerability claimed.**

## Hypothesis
Per-response payload noninterference does not compose into whole-runtime noninterference when two unapproved broker operations share a scheduler. Two worlds with identical global authorization and identical individual public HTTP response bodies can still be distinguished by the **order** in which the responses complete, even if no adapter executes and no credential is resolved. The scheduler is part of the observable runtime boundary.

## Frozen predictions
P1: Two local real-HTTP requests /a and /b, each calling Hush ActionBroker.request without approve/execute, return identical constant public bodies in worlds with secret bit 0 and 1, but their completion order reverses deterministically.
P2: An independent observer recovering the bit from completion order achieves 2/2 exact discrimination; payload-only comparison sees no difference.
P3: Both worlds have exactly zero approvals, zero adapter executions, zero credential resolutions and zero externally committed effects. This is an intentionally insecure wrapper/scheduler model, not proof of a flaw in a shipped Hush endpoint.
P4: An enforcement control that serializes completion in a fixed, secret-independent order makes the observed transcript identical across the two worlds.
P5: The production release remains BLOCK pending independent review of whole-trace scheduling/timing channels. A local finite test is insufficient to certify OS-level noninterference.

## Method
Use Node built-in test and loopback HTTP only; no API, GPU, browser, or paid resources. Construct two requests through the real ActionBroker, hold both responses at a deterministic barrier, and release in a secret-dependent order. Independently observe the socket-response order. Repeat with fixed-order mitigation. The payload is fixed and contains no private bits; log order only, not timing values. Commit the negative result, reproduction, release consequence and exact threat-model limits. Preserve HUSH-046/048/049/050/051 evidence; do not merge or claim novelty for classical scheduler noninterference.
