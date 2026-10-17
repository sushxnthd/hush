# PCC connector source-ID rotation result

## Verdict

**FAIL.** A replacement connector snapshot that changed only the provider-controlled source ID reset PCC composition accounting and enabled exact recovery of the synthetic bounded integer.

## Frozen prediction and observation

| Condition | First predicate | Second predicate | Joint inference |
|---|---:|---:|---:|
| Stable source ID | allowed (`s >= 500`) | denied | no exact recovery |
| Rotated source ID | allowed (`s >= 500`) | allowed (`s <= 500`) | exact `[500]` |

The stable-ID control updated the existing connector path. The rotated-ID intervention created one path and removed one path even though label, category, domain, and private value were unchanged. After restart, the second predicate was treated as belonging to a fresh logical-path ledger.

## Mechanism

Connector paths are derived from `provider + collection + sourceId`. PCC v3 correctly survives storage-record replacement at a stable logical path, but a provider-controlled identifier rotation changes that path. The privacy ledger therefore tracks connector naming rather than durable private evidence identity.

## Belief update

- **FALSIFIED:** logical path plus field is sufficient identity across realistic connector replacement.
- **KNOWN:** stable source IDs preserve composition in this probe.
- **ANOMALOUS / product-critical:** a metadata-only upstream rename can reset privacy state.
- **UNTESTED:** real provider ID churn rates and adapter-specific durable aliases.

## Constraint exposed by the failure

No automatic rule based only on the new snapshot can safely infer that two differently named records contain the same protected fact without additional trusted identity information. Content/value matching would recreate the previously falsified value-derived authorization oracle. A safe correction therefore needs a trusted, value-independent durable privacy identity supplied or maintained by the connector boundary, with fail-closed behavior when identity continuity is ambiguous.

## Evidence

- Preregistration: `CONNECTOR_ID_ROTATION_PREREGISTRATION.md`
- Executable probe: `run_connector_id_rotation_probe.mjs`
- Frozen output: `connector_id_rotation_failure.json`
- SHA-256: `f9069ca31b060b4608fda48d9a05c783751deffe7179b62fcdbad1be8eb4dc18`

## Limitations

This is a deterministic generic-connector simulation using the actual Hush normalization, replacement-ingestion, encrypted restart, PCC preparation, approval, and consumption paths. It does not establish that Gmail, Calendar, Drive, or GitHub currently rotate identifiers this way, nor that a remote provider observed the reconstructed value. It does establish a product-boundary composition failure whenever an adapter maps unchanged private evidence to a new source ID without a durable trusted alias.

## Cheapest next discriminating experiment

Introduce an adapter-supplied, value-independent `privacyKey`, freeze its semantics and collision behavior, and replay this probe with source ID rotation while holding `privacyKey` fixed. Then adversarially test missing, duplicated, and maliciously changed keys; ambiguous continuity must fail closed.
