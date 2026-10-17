# PCC diagnostic-digest dictionary correction

## Verdict

The unchanged frozen dictionary probe now **PASSES**. Public partition
footprints expose the fixed label `pcc:derived`, while the scalar digest remains
inside the encrypted runtime's composition state.

| Check | Before | Corrected |
|---|---:|---:|
| Candidate digests enumerated | 1,024 | 1,024 |
| Matches from public identifier | **1** | **0** |
| Exact scalar recovered | **500** | No |
| Candidate/knowledge statistics retained | Yes | Yes |

## Correction and verification

`ContextKernel.partitionExposure()` now replaces every internal PCC field key
with `pcc:derived`. It preserves domain, candidate-count, fragment, and realized
knowledge summaries. Internal transactions continue to use the scalar digest,
so the extractor-alias and field-alias composition fixes remain intact.

- Frozen failure SHA-256:
  `2325869354c41e8b84c9056a324bdb04afe8cb5578301b561a4d03920c8dc503`
- Corrected replay SHA-256:
  `805f8db6f7ed504a47a48336f29606df611da42117db39964747e13380ccad80`
- Second correction replay: byte-identical
- Focused PCC tests: 15/15 passed
- Full repository suite: 304/304 passed

## Smallest supported claim

The corrected local diagnostic footprint preserves aggregate bounded-integer
privacy accounting without publishing a brute-forceable deterministic scalar
digest. This closes the tested 1,024-candidate dictionary attack. It does not
establish protection after local runtime compromise, arbitrary side-channel
safety, semantic privacy, or remote-model validation.
