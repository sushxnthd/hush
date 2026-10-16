# MCP DELETE fail-closed correction

Protocol frozen: 2026-10-16 UTC, before modifying runtime code or executing the
corrected end-to-end probe. It follows the preserved bypass at commit
`3dcb201f75cf85392c6d022dc42b0949d9d9e39b`.

## Active HUSH breakthrough kernel

- **Precise question:** Can Hush close the demonstrated MCP transport bypass by
  rejecting DELETE locally while adding a signed, chain-valid pre-dispatch deny
  receipt?
- **Best-known frontier:** The bypass is exactly reproduced. JSON-RPC tool calls
  have their own gate, but transport DELETE dispatches before it.
- **Exact objective:** For authenticated `DELETE /mcp?session=probe`, require
  HTTP 405, zero upstream observations, receipt delta one, a `deny` receipt bound
  to MCP transport DELETE, and a valid signed receipt chain.
- **Strongest alternative explanation:** Local rejection can stop the effect but
  still leave the assurance trace incomplete; therefore upstream non-dispatch
  alone is insufficient.
- **Cheapest decisive falsification:** Any upstream observation, missing receipt,
  non-deny receipt, invalid chain, or changed successful POST tool-call behavior.
- **Publishable success condition:** The frozen bypass is closed twice from fresh
  processes with byte-identical normalized evidence, the independent source
  audit confirms denial precedes dispatch, and the complete repository suite
  passes.
- **Project-relevance threshold:** The actual Hush server boundary changes, not
  merely the standalone monitor or research harness.
- **Kill condition:** If a signed pre-dispatch receipt cannot be persisted before
  responding without destabilizing MCP, retain local rejection but do not claim
  trace-complete correction.

## Frozen correction

1. Treat MCP transport DELETE as unsupported and fail closed locally.
2. Before responding, append a signed `deny` receipt with category
   `mcp-transport`, action `http_delete`, resource `/mcp`, agent and purpose from
   the authenticated request headers, and no query values or credential data.
3. Return 405 with `Allow: GET, POST`.
4. Do not call `fetchMcpUpstream`.
5. Preserve the original failure artifact and runner unchanged.

## Frozen controls

- Original bypass runner remains evidence for the vulnerable revision.
- Corrected dynamic runner uses the real server and local upstream.
- Independent source-order audit checks that the DELETE denial and receipt occur
  before the first transport dispatch.
- Existing MCP POST approval integration test must pass.
- Full repository test suite must pass.

## Ledgers

### SCIENCE

Pending. The claim is a scoped systems correction, not novelty for reference
monitors or a proof that all Hush effect paths are mediated.

### CONSEQUENCE

Pending. Success removes one demonstrated bypass but leaves the product-wide
complete-mediation gate open until the remaining effect inventory is exhausted.
