# MCP DELETE fail-closed correction

Status: **SCOPED SYSTEM MECHANISM PASS**

The prospective correction closes the exact bypass preserved at commit
`3dcb201f75cf85392c6d022dc42b0949d9d9e39b`.

For authenticated `DELETE /mcp?session=probe`, the real Hush server now:

- returns HTTP 405 with `Allow: GET, POST`;
- produces zero upstream observations;
- appends exactly one signed `deny` receipt;
- binds the response to that receipt's hash;
- records agent, purpose, category `mcp-transport`, action `http_delete`,
  resource `/mcp`, and transport method `DELETE` without query values;
- retains a valid signed receipt chain.

Two fresh-process runs produced byte-identical normalized evidence. An
independent source-order audit confirmed that receipt persistence and rejection
precede the first possible upstream transport dispatch. Existing approved MCP
POST tool-call behavior remained green.

## SCIENCE ledger

The frozen counterexample is eliminated by a minimal fail-closed boundary:
unsupported transport effects are denied and durably recorded before any
provider credential can be exercised. This is externally checkable systems
evidence for one runtime edge, not a novel reference-monitor theorem and not a
proof of product-wide complete mediation.

Smallest supported claim:

> At this revision, Hush rejects MCP transport DELETE locally, emits a signed
> denial receipt bound to the response, and does not dispatch the request to the
> configured upstream.

## CONSEQUENCE ledger

MCP DELETE is removed from Hush's supported proxy surface. The correction also
establishes the required pattern for remaining effect edges: persist an attempt
decision before dispatch and bind the response to its receipt. Hush still must
not claim product-wide complete mediation until GET, OAuth/token operations,
connector reads, provider actions, browser launch and platform-command paths are
classified and tested.

## Evidence

- Dynamic result SHA-256:
  `1d77e1f0b93834e73d16c0a4fed17fa6efc9a489ef3059ed4e251165bc66f550`
- Independent static audit SHA-256:
  `337913f333f2ca015653751ebe11f067565c50472d7b6e13a1d0d0c8cafb1465`
- Focused regression: 2/2 tests pass.
- Full repository result is recorded in the PR/CI state after commit.

## Reproduce

```bash
node research/pcc-runtime-product/run_mcp_delete_fail_closed_correction.mjs \
  research/pcc-runtime-product/mcp_delete_fail_closed_correction_result.json
python3 research/pcc-runtime-product/audit_mcp_delete_fail_closed_correction.py
node --test test/mcp-delete-mediation.test.js test/mcp-proxy.test.js
```

No external provider, paid service, private data or task holdout was used.
