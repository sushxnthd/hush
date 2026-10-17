# PCC diagnostic-digest dictionary probe: frozen failure

## Verdict

The diagnostic non-disclosure gate **FAILED**. After one harmless comparison,
the public partition footprint included:

`pcc:1d0cc0e26676ac6bbabba4f0883338a58b7c89ea228530744265acdf35a7dfc6`

An independent enumerator hashed the 1,024 declared integer candidates and
matched exactly one value: **500**, the private scalar.

| Check | Result |
|---|---:|
| Candidates enumerated | 1,024 |
| Digest matches | 1 |
| Matched value | 500 |
| Encrypted state or record value read | No |
| Diagnostic non-disclosure | **FAIL** |

## Mechanism

Plain SHA-256 is collision resistant but not a hiding commitment for a small
known domain. Publishing a deterministic digest of `{kind, value}` turns the
diagnostic identifier into an offline dictionary oracle. This is a recurring
mechanism across the PCC failures: metadata that appears opaque can still carry
the equivalence class needed for exact inference.

## Provenance

- Preregistration/source freeze: `aa468a03dc1b10f5a063e6755c6f18de99c2734a`
- Raw artifact: `digest_dictionary_probe.json`
- Raw SHA-256: `2325869354c41e8b84c9056a324bdb04afe8cb5578301b561a4d03920c8dc503`
- Actual ContextKernel comparison, approval, consumption, and public
  `partitionExposure()` path
- Independent local SHA-256/canonicalization enumerator

## Boundary and correction

This is an authenticated local diagnostic/owner-surface disclosure, not a
remote model/provider disclosure. The owner may know the value, but companion
and diagnostic surfaces are intentionally metadata-only and should not make
bounded values mechanically recoverable.

The internal scalar digest is still useful for composition. The correction is
to keep it internal and replace PCC field identifiers in the public footprint
with a fixed non-secret derived-field label. Candidate counts and knowledge
statistics can remain observable. The immutable probe and full suite must then
pass.
