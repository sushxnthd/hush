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

## HUSH-055 transitive hash redaction blocker (2026-10-26)

Even when an application suppresses `receipt.resultDigest`, exposing the receipt's unkeyed `hash` **together with its other preimage fields** may allow a lower-trust observer to enumerate low-entropy private adapter results. The hash commits to `resultDigest`, which itself commits to the private result. See [frozen HUSH-055 protocol](../pcc-v2/HUSH_055_FROZEN.md) and [adversarial real-broker test](../../test/action-broker-receipt-hash-transitive-channel.test.js). The real-broker/HTTP experiment was hosted-verified in [HUSH-055 run 40231171291](https://github.com/sushxnthd/hush/actions/runs/40231171291), with 2/2 adversarial tests passing. This verifies a deliberately unsafe application projection, not a shipped vulnerability. The release reviewer must explicitly reject **transitive derived-field disclosure**, not merely raw results, request hashes, or result digests. An application that projects a broker receipt to an unauthorized reader must use a strict independently authorized positive allowlist and suppress result-dependent hashes and their metadata; do not treat a signed or hashed receipt as confidentiality-preserving. Full runtime release remains BLOCKED pending external evidence.

## HUSH-056 crash-after-effect replay blocker (2026-10-27)

A broker's one-use **in-memory** ticket reservation does not prove exactly-once **external provider effects** across process death. The [frozen HUSH-056 protocol](../pcc-v2/HUSH_056_FROZEN.md) and [real SIGKILL/restart test](../../test/action-broker-crash-replay-effect.test.js) exercise a crash after a fsynced simulated-provider effect but before the broker returns a receipt, followed by reapproval of the same logical request. The test also models a provider with durable idempotency keyed by stable requestHash. **The new hosted test is pending; do not claim the predictions observed until CI succeeds.** This is not an authorization bypass or a claim about real provider idempotency.

A release reviewer must independently verify, **for each real provider and effect type**, atomic idempotency key scope, collision handling, retention window, duplicate suppression after process death, cancellation during in-flight dispatch, concurrent retries, unknown outcome reconciliation, and audit visibility. Absence of a broker receipt must be treated as **outcome unknown**, never proof that an external effect did not occur. Production readiness remains **BLOCKED** regardless of synthetic control success.

## HUSH-056 hosted verification update (2026-10-28)

The previously pending [real-process HUSH-056 hosted run 40428809747](https://github.com/sushxnthd/hush/actions/runs/40428809747) passed all **three** SIGKILL/restart simulated-provider tests, as well as **two** HUSH-055 and **one** HUSH-053 leakage controls. The production readiness gate itself returned `block`, as required. This upgrades the crash/replay *software counterexample* from pending to hosted-verified, **not** the provider's real-world idempotency guarantee. External provider semantics, concurrent retries, network partitions, effect reconciliation, cancellation, independent security review and OS-level egress mediation remain release blockers. **Production remains BLOCKED.**


## HUSH-058 asynchronous-expiry dispatch blocker (2026-10-28)

A source-level lifecycle gap was identified in `ActionBroker.execute`: ticket expiry was checked by `_ticket()` before the asynchronous credential resolver, but the post-resolution `_scopeVerdict()` did not recheck expiry, including for unscoped tickets. A resolver completing after expiration could therefore enter the adapter despite an expired approval. [Frozen experiment](../pcc-v2/HUSH_058_FROZEN.md) defines a controlled-clock real-broker/loopback-HTTP witness, a valid-delay control, a concurrent retry control and a pre-expired control. The implementation now rechecks `this.now() >= ticket.expiresAt` inside every pre-dispatch `_scopeVerdict()`, returning `ACTION_TICKET_EXPIRED` fail-closed. [Test](../../test/action-broker-expiry-after-await.test.js) and [hosted workflow](../../.github/workflows/hush-058-expiry-after-await.yml) were committed; **hosted prepatch and patched verification are pending** at the time of this update. Do not report observed HTTP effect counts until the pinned CI runs finish.

Release reviewers must additionally verify that a pending asynchronous resolution never extends a ticket's effective lifetime, that expiration and closure are enforced at the dispatch boundary, and that clock rollback or untrusted wall clocks are outside the current guarantee unless independently controlled. This is a scoped lifecycle safety fix, not a novel noninterference law, OS-level containment, provider-side cancellation or production readiness. **Production remains BLOCKED.**
