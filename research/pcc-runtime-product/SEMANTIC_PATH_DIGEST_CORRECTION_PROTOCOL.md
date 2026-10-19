# Frozen semantic path-digest correction protocol

Frozen after preservation of the 32/32 failure artifact and before modifying production code.

## Intervention

Only the agent-facing semantic sanitizer may change: remove `receipt.privatePathsHash` from `runSemantic` output and add the fixed Boolean `receipt.privateCapabilitiesBound=true`. The low-level `run` receipt remains unchanged for trusted clients that already supplied the private paths.

## Unchanged probe

Repeat the same 32 worlds, metadata, values, semantic MCP request, agent, and sink used by `run_semantic_path_digest_probe.mjs`.

## Gates

1. All 32 authorized results remain unchanged and identical.
2. No semantic response contains `privatePathsHash` or any raw candidate path.
3. The projected semantic observation `(decision,result,privateCapabilitiesBound)` has exactly one distinct value.
4. Low-level compatibility output still contains `privatePathsHash`.
5. Focused and full repository tests pass.
6. Independent source/artifact audit passes and duplicate correction artifacts are byte-identical.

Any failure preserves the correction as failed; no post-observation weakening of these gates is permitted.
