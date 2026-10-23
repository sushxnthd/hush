# HUSH-PCC-046 — runtime egress red gate and release blocker

**Evidence status:** frozen protocol at HUSH_046_FROZEN.md; Node HTTP test in test/action-broker-real-network-counterexample.test.js. This is an adversarial *negative* runtime result, not evidence of safe mediation. Do not call this a new noninterference theorem.

## Compositional rule under test
For two worlds w,w' with identical authorized output G(w)=G(w'), a whole-system noninterference claim requires equality of **joint externally visible traces** across all channels: return, HTTP egress, metadata, timing, absence, cancellation, retries, crashes and restart recovery. Per-channel declaration checks are sufficient only if channel enumeration is complete and each declaration is enforced or independently verified against actual execution. An adapter running arbitrary Node.js code can emit an HTTP request outside ActionBroker's return-value path. The existing `certifyObservableClosure` validates a configured trace map, not runtime network egress.

## Real runtime counterexample
The test executes actual loopback HTTP POSTs, not a synthetic trace array. Worlds 00 and 11 have equal parity authorization and equal broker return values. An adapter sends a private bit to a local receiver from inside `execute`. The configured network trace falsely declares parity-only output. Broker certificates allow both worlds, while the receiver sees different bits. A new broker instance reloaded from encrypted transaction state repeats the leak. Negative controls show no dispatch before approval and denial of missing declared closure.

**Interpretation:** passing this test confirms a security gap. The declaration-only certificate must not be presented as a runtime privacy guarantee. The test does not show pre-approval leakage, cancellation-race safety, arbitrary-network containment, or production exploitation. Those require separate experiments.

## Explicit release blocker (now wired to production-readiness.mjs)
`release/attestations/runtime-egress-mediation.json` must be independently reviewed and backed by scoped real artifacts before the Authority & real actions release domain can pass. No fabricated attestation. The reviewer must verify:
1. Actual process/OS-level egress mediation for adapter HTTP, sockets, DNS, file writes, subprocesses, logs and side effects; reject unknown channels.
2. Denied and unapproved actions emit no externally distinguishing signal, including response timing and absence to the extent the threat model requires.
3. Authorization and egress controls survive fresh-process restart, cancellation, concurrent approve/deny/execute races and failed persistence.
4. Raw private results and credentials cannot be emitted through any unmediated adapter-owned channel; demonstrate this with adversarial end-to-end tests, not trace declarations.
5. Independent replay with two same-authorization private worlds yields observationally indistinguishable joint traces under the explicitly enumerated observer.
6. State exact limitations (e.g. side channels, trusted OS, local process compromise) and fail closed when runtime mediation cannot be verified.

**Immediate product policy:** disable public claims of broker-enforced full observable closure for arbitrary in-process adapters. Keep the research feature experimental. A future sandboxed adapter execution boundary may enable a narrower certified claim only after the above tests pass and independent review.
