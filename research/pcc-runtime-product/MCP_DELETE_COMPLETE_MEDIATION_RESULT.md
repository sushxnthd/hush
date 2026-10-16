# MCP DELETE bypass falsifies product-wide complete mediation

Status: **DECISIVE FALSIFICATION**

The frozen end-to-end probe executed the real Hush server against a deterministic
local MCP upstream. An authenticated `DELETE /mcp?session=probe` produced:

- upstream observations: 1
- upstream method: `DELETE`
- upstream status returned through Hush: 204
- Hush receipt count before: 0
- Hush receipt count after: 0
- receipt delta: **0**
- repeat: byte-identical from a fresh server process

The upstream also received the configured brokered credential rather than the
client-visible token. This confirms that the request traversed Hush's actual MCP
proxy, not a side fixture.

An independent source-order audit found the same missing edge: the GET/DELETE
branch dispatches through `fetchMcpUpstream` before JSON parsing,
`evaluateMcpCall`, and the allow/error receipt append. Its audit source digest is
`5adcb1dff2834ef97f902d863838225c80f7d1da7d646790f2b43f0bc8eab805`.

## SCIENCE ledger

The earlier standalone full-trace theorem survives for executions that use
`TracePolicyMonitor`, but it does **not** establish complete mediation for the
current product. At this revision, at least one externally effectful transport
edge is outside both the trace monitor and Hush's durable receipt chain.

Smallest supported claim:

> At this revision, authenticated MCP DELETE reaches the configured upstream
> without a Hush policy decision or receipt.

This is not a claim that every MCP DELETE is harmful, that MCP itself is unsafe,
or that other Hush action paths are unmediated. It is a concrete counterexample
to the product-wide complete-mediation claim.

## CONSEQUENCE ledger

Product-wide assurance is blocked. Hush must not describe the current runtime as
complete-mediation architecture. The correction must route transport-level MCP
effects through one pre-dispatch policy/receipt boundary or reject unsupported
methods locally. Because upstream DELETE semantics are server-defined, treating
it as harmless session cleanup is not a safe universal assumption.

The next prospective correction must preserve this failure artifact, add a
pre-dispatch attempt receipt, and prove that denial prevents upstream dispatch.
GET/list handling should be audited separately; this result does not authorize
changing it by analogy.

## Reproduction

```bash
node research/pcc-runtime-product/run_mcp_delete_mediation_probe.mjs \
  research/pcc-runtime-product/mcp_delete_mediation_result.json
python3 research/pcc-runtime-product/audit_mcp_delete_mediation.py
```

Canonical dynamic artifact SHA-256:
`243e23bf2e5fe8f7323cbb16209146c061d3c6f5848a692ef52d0bc35a8dc099`

Independent static artifact SHA-256:
`02ebd6586fac1ac11aad4c5896c2485ad93abcad31cda86b6d10b72093bb8aa3`

No external provider, paid service, private data, or frozen task holdout was used.
