# HUSH-PCC-058 | Frozen expiry-after-await authorization falsifier

Date: 2026-10-28. Secondary Hush kernel on existing draft PR #45. Frozen **before** writing the experiment or patch. This is a lifecycle safety counterexample under an explicitly controlled test clock, not a novel noninterference theorem or evidence of an exploited deployment.

## Hypothesis and independent oracle

An approval ticket with expiration E authorizes adapter dispatch only if the broker's clock is strictly earlier than E **at the actual dispatch boundary**, not merely at the beginning of an asynchronous execution. The broker currently checks expiry in `_ticket()` before awaiting `secretResolver`, while the later `_scopeVerdict()` recheck appears not to enforce ticket expiry. A delayed resolver can therefore let an initially valid ticket dispatch after expiration.

Freeze one clock-controlled, real-ActionBroker/loopback-HTTP experiment with TTL=1000 ms and a deferred credential resolver:

1. **Expired during resolution**: ticket requested and approved at t0, execute starts at t0, resolver blocks, clock advances to t0+1001 ms, resolver returns, adapter tries to POST to loopback HTTP receiver. **Predicted pre-patch:** one HTTP effect and `allow` despite expiry. **Required after patch:** zero effects, `deny` with `ACTION_TICKET_EXPIRED`, no adapter entry, no untrusted credential in return.
2. **Unexpired control**: resolver returns at t0+500 ms. Exactly one HTTP effect and `allow` are expected. Do not disable valid actions.
3. **Concurrent retry control**: while resolver blocks, a second execute of the same ticket must fail one-use reservation; after expiration and resolver release, neither invocation may dispatch.
4. **Pre-expired ticket control**: execute initiated after expiry must reject without credential resolution or effect.
5. The HTTP receiver must be an actual local socket and return an explicit count; no fixture may pretend an HTTP effect occurred.

The independent oracle is the elementary temporal predicate `dispatch_time < expiresAt`, checked against the controlled test clock, plus the receiver's observed POST count. A pass on patched code demonstrates only the **modeled** race is closed, not arbitrary OS scheduling, malicious clock rollback, external provider cancellation or end-to-end information-flow security.

## Product consequence and release

Recheck expiration after every asynchronous credential-resolution segment and immediately before adapter dispatch, together with existing transaction closure and observable-closure rechecks. Preserve fail-closed receipt and no effect on expiry. Do not force-push, merge or deploy. Production remains BLOCKED pending real runtime egress mediation, restart/cancellation and independent external review. Lucent E002-371 remains the primary workstream, unchanged.
