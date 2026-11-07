# HUSH-PCC-057 | Frozen broker-owned credential egress falsifier

Date: 2026-10-28. Secondary Hush kernel; same persistent branch and draft PR #45. Frozen **before** executing a new HUSH-057 adversarial runtime test or changing ActionBroker. This is a broker-implementation information-flow test, not a new theorem or an assertion of a deployed vulnerability.

## Hypothesis and prepatch predictions

Inspect the current ActionBroker: `replaceExactSecrets` redacts **string values** recursively but copies object property **keys** unchanged. In `execute` the catch block returns `error.message` directly, although the adapter may have received resolved credentials. Both channels are broker-owned return fields, not a malicious external wrapper's fabricated signal.

Use a real ActionBroker with one opaque credential reference, a local secretResolver that supplies a fixed synthetic token, an explicit approval, and a loopback HTTP response exposing only the broker's returned outcome. Freeze two worlds with distinct synthetic tokens and identical public request parameters.

1. An adapter returns an object with the secret as a property name. Predict the returned `result` exposes the token as a JSON key despite redaction of values.
2. An adapter throws `Error('provider rejected '+token)`. Predict the returned `reason` exposes the token.
3. Before approval, `execute` must not call the adapter or secretResolver; public responses should contain no token.
4. After a fix, both output channels must suppress raw token bytes and any provider-controlled exception text. An explicit fixed generic error is acceptable. A benign public object key/value must remain intact. If distinct keys collapse to the same redacted key, fail closed rather than silently overwrite.
5. Verify actual HTTP response bodies and broker receipt status; preserve the prepatch negative and postpatch tests independently.

## Claim boundary and enforcement

This tests only two explicit output channels for a **cooperating trusted local adapter that accidentally echoes secrets**. It does not mediate arbitrary adapter-owned sockets, DNS, files, logs, timing, crashes or provider side effects. Redacting known credentials is not complete information-flow security. Any positive result is an implementation bug/fix under established noninterference principles, not scientific novelty. Production remains BLOCKED until OS/runtime egress closure, crash/restart, cancellation, provider idempotency and external security review are independently verified. Lucent PR #26 must remain untouched.
