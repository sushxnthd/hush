# PCC diagnostic-digest dictionary probe: preregistration

## Classification

DISCRIMINATION / ADVERSARIAL SECURITY.

## Hypothesis and mechanism

PCC now uses `SHA-256(canonicalize({kind, value}))` as an internal scalar
identity. Bounded integer domains are intentionally small enough to enumerate.
If the raw PCC partition key appears in `partitionExposure()` or the owner
context API, an observer with local-client diagnostic access can compute the
digest for every declared candidate and recover the exact private scalar
offline, even though ordinary context listing omits values.

## Frozen prediction

Store secret 500 over domain 0..1023, execute one non-identifying comparison,
then obtain only the public partition footprint. Independently enumerate all
1,024 candidate digests from the documented compiler representation.

The security gate fails if exactly one candidate matches the exposed PCC field
identifier. The probe must not read encrypted state, ContextKernel records,
contract internals, or the compiled scalar.

## Boundary

This tests an authenticated local diagnostic/owner boundary, not the remote
model/provider boundary. It matters because Hush client surfaces are intended
to expose metadata and approvals without turning bounded private values into
recoverable identifiers.

## Cheapest correction if falsified

Keep the scalar digest exclusively internal. Public partition footprints must
replace PCC field identifiers with a fixed non-secret derived-field label while
preserving aggregate candidate and knowledge statistics. Re-run the immutable
probe and full suite.
