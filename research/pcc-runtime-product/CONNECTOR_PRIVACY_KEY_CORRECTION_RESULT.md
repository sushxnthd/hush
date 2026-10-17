# PCC durable connector privacy identity — correction result

Status: **PASS** for the frozen synthetic differential; breakthrough gate remains **INCONCLUSIVE**.

## Smallest supported claim

For the tested bounded integer comparisons, a trusted adapter-supplied,
value-independent `privacyKey` preserved PCC composition when the provider
source ID rotated. The same identifying second predicate was denied in both
the stable-ID control and rotated-ID condition. Missing and duplicate durable
identities failed closed.

## Frozen result

The first approved result was `secret >= 500` for secret `500` in domain
`0..1023`. After restart, preparing `secret <= 500` produced a generic denial:

| Condition | Provider path changed | Second predicate | Protected value released |
|---|---:|---:|---:|
| Stable source ID + stable privacy key | No | Deny | No |
| Rotated source ID + stable privacy key | Yes | Deny | No |
| Missing privacy key | N/A | Reject | No |
| Duplicate privacy key | N/A | Reject snapshot | No |

All three preregistered correction gates passed. The prior non-connector
record-recreation differential also remained PASS. The focused suite passed
28/28 tests and the complete repository suite passed 313/313 tests.

The raw result is `connector_privacy_key_correction.json`, with SHA-256:

`bc471f90dfb0067262433eab946af5d2751e2feb45f7fba63f4e8a363cf10082`

An independent rerun of the frozen runner was byte-identical.

## Mechanism and residual risk

Connector paths still derive from provider source IDs for storage and sync.
Only the PCC composition ledger uses provider + collection + durable privacy
key + private field. PCC identity was versioned to `pcc:v4`; earlier PCC state
fails closed instead of silently allocating a fresh ledger.

This does not discover semantic aliases automatically. It assumes the adapter
assigns a stable, value-independent key correctly. A malicious or mistaken
adapter can rotate a key and force refusal, or reuse a key and conservatively
co-account unrelated records. No live provider or third-party implementation
was tested.

## Reproduce

```bash
node research/pcc-runtime-product/run_connector_privacy_key_correction.mjs \
  --output /tmp/connector_privacy_key_correction.json
sha256sum /tmp/connector_privacy_key_correction.json
node research/pcc-runtime-product/run_record_recreation_probe.mjs \
  --output /tmp/record_recreation_v4.json
node --test test/connectors.test.js test/private-constraint-kernel.test.js
npm test
```

## Product and HAA implication

The correction turns an observed connector lifecycle privacy reset into an
explicit adapter contract with fail-closed behavior. It materially strengthens
the end-to-end Hush evidence package because connector-backed PCC can no longer
silently treat source-ID replacement as a fresh privacy budget in this tested
regime. It is a rigorous scoped correction, not evidence of universal privacy.
