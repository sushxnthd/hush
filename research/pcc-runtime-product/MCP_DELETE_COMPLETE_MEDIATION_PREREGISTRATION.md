# MCP DELETE complete-mediation falsification

Protocol frozen: 2026-10-16 UTC, after source reconnaissance identified the
candidate transport route and before executing the end-to-end probe.

## Active HUSH breakthrough kernel

- **Precise question:** Does every externally effectful MCP request reachable
  through Hush cross a policy decision and append a durable Hush receipt before
  dispatch?
- **Best-known frontier:** The standalone `TracePolicyMonitor` is exact for its
  explicit event model, and JSON-RPC `tools/call` is separately approval-gated.
  Complete mediation of the actual runtime call graph has not been established.
- **Exact objective:** Exercise an authenticated HTTP `DELETE /mcp` against a
  real Hush server and a deterministic local upstream. Record whether the
  upstream observes the request, and whether Hush's receipt log grows.
- **Strongest alternative explanation:** The early transport path is harmless
  protocol/session cleanup, or another layer records/authorizes it despite the
  apparent early return.
- **Cheapest decisive falsification:** One accepted DELETE that reaches the
  upstream while the Hush receipt count is unchanged.
- **Publishable success condition:** Either (a) all reachable MCP methods are
  shown to pass a common pre-dispatch monitor, or (b) a minimal reproducible
  bypass identifies the exact missing edge and a prospective correction closes
  it without breaking normal MCP behavior.
- **Project-relevance threshold:** The result must change the runtime boundary:
  remove DELETE support, or route it through an explicit policy/receipt gate.
- **Kill condition:** If DELETE is rejected before dispatch or creates a bound
  pre-dispatch receipt, abandon this candidate and continue the exhaustive
  external-effect inventory.

## Frozen probe

1. Start a local upstream that records method, path, authorization header and
   body, and answers DELETE with status 204.
2. Start the repository's real `src/server.js` with that upstream and the same
   test-mode local-auth configuration used by the MCP integration suite.
3. Read `/api/status` and `/api/receipts` before the probe.
4. Send `DELETE /mcp?session=probe` with agent, purpose and client-visible
   authorization headers.
5. Read status and receipts afterward.
6. Emit canonical JSON. The scientific gate fails iff the upstream observed
   exactly one DELETE and Hush added zero receipts.
7. Repeat from a fresh process and require byte-identical canonical output.

No external provider, benchmark holdout, paid service or private user data is
used. The local upstream is a controlled effect witness, not a claim about a
specific third-party MCP server.

## Ledgers

### SCIENCE

Pending the frozen probe. A standalone monitor theorem does not imply product
complete mediation unless every effectful runtime edge is connected to it.

### CONSEQUENCE

Pending the frozen probe. A surviving bypass blocks any product-wide
complete-mediation claim and requires a common transport dispatch gate.
