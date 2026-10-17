# MCP GET now crosses a durable pre-dispatch mediation boundary

Status: **SCOPED SYSTEM MECHANISM — PASS**

Frozen protocol: `5206a96305774843a5a63e7e1f887b8135999487`

## Smallest supported claim

For configured MCP GET transport, Hush now durably appends a signed
`approved/attempt` receipt before exercising the brokered credential or
dispatching upstream. It then appends a terminal `allow/outcome` receipt after
successful upstream response headers, or an `error/outcome` receipt if the
connection fails. Successful responses are bound to the outcome receipt hash.

This is a scoped complete-mediation correction for GET transport. It does not
show user-specific semantic authorization, absence of disclosure, safety of an
upstream stream, or product-wide mediation across every external-effect path.
The authorization basis here is the administrator-configured MCP upstream.

## Prospective evidence

| Frozen gate | Result |
|---|---:|
| Attempt receipt present when upstream request arrived | 1 |
| Success receipt delta | 2 |
| Success order | `approved/attempt → allow/outcome` |
| Failure receipt delta | 2 |
| Failure order | `approved/attempt → error/outcome` |
| Brokered credential used upstream | yes |
| Client credential forwarded | no |
| Raw brokered secret in receipts | no |
| Exact SSE status/body forwarding | pass |
| Response bound to terminal receipt | pass |
| Receipt chain valid in both scenarios | pass |
| Independent source-order audit | pass |
| Fresh-process byte-identical repeat | pass |

The successful observation upstream made a concurrent call to Hush's receipt
API before sending its response. It observed one valid-chain receipt, directly
testing persistence before provider-boundary execution rather than inferring
ordering from final state.

## SCIENCE ledger

- **TRUE:** a pre-dispatch durable attempt record can coexist with MCP GET/SSE
  response forwarding and brokered credentials.
- **TRUE:** terminal closure can cover both returned upstream headers and
  connection failure without placing raw credentials in the audit chain.
- **TRUE:** the former zero-receipt GET counterexample no longer reproduces;
  the same real-server path now has receipt delta two.
- **LIMITATION:** configured-upstream presence is a static authorization basis,
  not a per-user permission decision. Stream events arriving after response
  headers are not individually receipted by this mechanism.

## CONSEQUENCE ledger

Hush no longer treats MCP GET as an unclassified direct transport exception.
The runtime now provides:

1. signed pre-dispatch evidence carrying agent, purpose, method, and static
   authorization basis;
2. a terminal outcome record for success or connection failure;
3. response-to-receipt binding; and
4. explicit proof that the brokered secret is absent from receipt payloads.

Product-wide complete mediation remains unclaimed. Remaining POST paths and
long-lived stream event semantics require their own classification and tests.

## Reproduction

```bash
node research/pcc-runtime-product/run_mcp_get_fail_closed_correction.mjs /tmp/get.json
python3 research/pcc-runtime-product/audit_mcp_get_fail_closed_correction.py
node --test test/mcp-get-mediation.test.js test/mcp-proxy.test.js
```

Dynamic artifact SHA-256:
`36a0284be75aef928ec687030b504331236f62f61a1f21103c8bb9685d6711c4`

Static artifact SHA-256:
`b1f894f7b75fa35d803d790f650e95b9ab03ad667938d8e44f71f3a5304ed02b`
